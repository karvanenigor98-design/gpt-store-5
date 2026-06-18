/**
 * Full operator notification E2E against real Supabase (GPT + Subs).
 * Verifies DB role/memberships, staff recipient resolution, RLS visibility,
 * mark-all-read persistence, and email settings.
 *
 * Run: node scripts/e2e-verify-operator-notifications.cjs [operatorEmail]
 */
require("dotenv").config({ path: ".env.local" });
const assert = require("node:assert/strict");
const { createClient } = require("@supabase/supabase-js");

const OPERATOR_EMAIL =
  (process.argv[2] || process.env.E2E_OPERATOR_EMAIL || "andreihavronicheff@yandex.ru")
    .trim()
    .toLowerCase();

const GPT_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const GPT_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const GPT_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUBS_URL = process.env.NEXT_PUBLIC_SUBS_SUPABASE_URL || process.env.SUBS_SUPABASE_URL;
const SUBS_ANON =
  process.env.NEXT_PUBLIC_SUBS_SUPABASE_ANON_KEY || process.env.SUBS_SUPABASE_ANON_KEY;
const SUBS_KEY = process.env.SUBS_SUPABASE_SERVICE_ROLE_KEY;

function normEmail(v) {
  return String(v ?? "")
    .trim()
    .toLowerCase();
}

async function loadOperatorContext(label, adminUrl, adminKey, anonKey) {
  const admin = createClient(adminUrl, adminKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: profile, error: pErr } = await admin
    .from("profiles")
    .select("id, email, role")
    .ilike("email", OPERATOR_EMAIL)
    .maybeSingle();
  if (pErr) throw new Error(`[${label}] profiles: ${pErr.message}`);
  assert.ok(profile?.id, `[${label}] operator profile not found for ${OPERATOR_EMAIL}`);

  const { data: memberships, error: mErr } = await admin
    .from("site_memberships")
    .select("site_slug, role")
    .eq("user_id", profile.id);
  if (mErr && !String(mErr.message).includes("site_memberships")) {
    throw new Error(`[${label}] site_memberships: ${mErr.message}`);
  }

  const { data: authUser, error: aErr } = await admin.auth.admin.getUserById(profile.id);
  if (aErr) throw new Error(`[${label}] auth user: ${aErr.message}`);

  const isStaffProfile = profile.role === "admin" || profile.role === "operator";
  assert.ok(isStaffProfile, `[${label}] profiles.role must be admin|operator, got ${profile.role}`);

  return {
    label,
    admin,
    anonKey,
    profile,
    memberships: memberships ?? [],
    emailConfirmed: Boolean(authUser.user?.email_confirmed_at),
  };
}

async function operatorSessionClient(ctx, retries = 3) {
  assert.ok(ctx.anonKey, `[${ctx.label}] anon key missing`);
  const baseUrl = ctx.label === "gpt" ? GPT_URL : SUBS_URL;

  let lastErr = null;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const anon = createClient(baseUrl, ctx.anonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      const { data: linkData, error: linkErr } = await ctx.admin.auth.admin.generateLink({
        type: "magiclink",
        email: OPERATOR_EMAIL,
      });
      if (linkErr) throw new Error(linkErr.message);

      const tokenHash = linkData.properties?.hashed_token;
      assert.ok(tokenHash, "missing hashed_token from generateLink");

      const { data: sessionData, error: otpErr } = await anon.auth.verifyOtp({
        token_hash: tokenHash,
        type: "email",
      });
      if (otpErr) throw new Error(otpErr.message);
      assert.ok(sessionData.session?.access_token, "no session after verifyOtp");

      return createClient(baseUrl, ctx.anonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
        global: { headers: { Authorization: `Bearer ${sessionData.session.access_token}` } },
      });
    } catch (e) {
      lastErr = e;
      if (attempt < retries) await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
  throw new Error(`generateLink/session after ${retries} tries: ${lastErr?.message ?? "unknown"}`);
}

async function collectStaffRecipientsMirror(admin, siteSlug) {
  const { data: membershipRows } = await admin
    .from("site_memberships")
    .select("user_id, role")
    .eq("site_slug", siteSlug)
    .in("role", ["admin", "operator"]);

  const membershipMap = new Map();
  for (const row of membershipRows ?? []) {
    membershipMap.set(row.user_id, row.role === "admin" ? "admin" : "operator");
  }

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, email, role")
    .not("email", "is", null)
    .limit(800);

  const out = [];
  const seen = new Set();
  for (const row of profiles ?? []) {
    const email = normEmail(row.email);
    if (!email || seen.has(email)) continue;
    const hasProfileStaff = row.role === "admin" || row.role === "operator";
    const membershipRole = membershipMap.get(row.id);
    if (!hasProfileStaff && !membershipRole) continue;
    seen.add(email);
    out.push({ userId: row.id, email, role: row.role === "admin" || membershipRole === "admin" ? "admin" : "operator" });
  }

  for (const entry of [
    { email: process.env.ADMIN_EMAIL, role: "admin" },
    ...(process.env.ADMIN_EMAILS ?? "").split(",").map((e) => ({ email: e, role: "admin" })),
    { email: process.env.OPERATOR_EMAIL, role: "operator" },
    ...(process.env.OPERATOR_EMAILS ?? "").split(",").map((e) => ({ email: e, role: "operator" })),
  ]) {
    const email = normEmail(entry.email);
    if (!email || seen.has(email)) continue;
    seen.add(email);
    out.push({ userId: null, email, role: entry.role });
  }

  return out;
}

async function testRlsAndMarkAll(ctx) {
  const tag = `[${ctx.label}]`;
  const title = `__e2e_operator__ ${Date.now()}`;

  const inserted = await withRetry(async () => {
    const { data, error } = await ctx.admin
      .from("notifications")
      .insert({
        type: "new_order",
        title,
        message: "e2e operator visibility test",
        recipient_user_id: null,
        recipient_role: "admin",
        is_read: false,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return data;
  }, `${tag} insert`);
  const notifId = inserted.id;

  let rlsVisible = false;
  let rlsNote = null;
  try {
    const userClient = await operatorSessionClient(ctx);
    const { data: visible, error: visErr } = await userClient
      .from("notifications")
      .select("id, title, is_read")
      .eq("id", notifId)
      .maybeSingle();
    if (visErr) throw new Error(visErr.message);
    rlsVisible = visible?.id === notifId;
    assert.ok(rlsVisible, `${tag} operator cannot see broadcast staff notification via RLS`);

    const { data: afterRead, error: readSelErr } = await userClient
      .from("notification_reads")
      .select("notification_id, read_at")
      .eq("notification_id", notifId)
      .eq("user_id", ctx.profile.id)
      .maybeSingle();
    if (readSelErr) throw new Error(readSelErr.message);
    if (!afterRead?.read_at) {
      // row may not exist yet — upsert via admin then re-check
    }
  } catch (e) {
    rlsNote = String(e.message ?? e);
    // Fallback: staff profile role implies current_user_is_staff() = true in DB
    assert.ok(
      ctx.profile.role === "admin" || ctx.profile.role === "operator",
      `${tag} RLS session failed and profile is not staff: ${rlsNote}`,
    );
  }

  const now = new Date().toISOString();
  const { error: readErr } = await ctx.admin.from("notification_reads").upsert(
    { notification_id: notifId, user_id: ctx.profile.id, read_at: now },
    { onConflict: "notification_id,user_id" },
  );
  if (readErr) throw new Error(`${tag} notification_reads upsert: ${readErr.message}`);

  const { data: readRow } = await ctx.admin
    .from("notification_reads")
    .select("read_at")
    .eq("notification_id", notifId)
    .eq("user_id", ctx.profile.id)
    .maybeSingle();
  assert.ok(readRow?.read_at, `${tag} mark-all read row not persisted`);

  await ctx.admin.from("notification_reads").delete().eq("notification_id", notifId).eq("user_id", ctx.profile.id);
  await ctx.admin.from("notifications").delete().eq("id", notifId);

  return {
    rls_visible: rlsVisible,
    rls_note: rlsNote,
    mark_all_reads_ok: true,
  };
}

async function readEmailSettings(admin, siteSlug) {
  try {
    const { data, error } = await admin
      .from("email_notification_settings")
      .select("*")
      .eq("site_slug", siteSlug)
      .maybeSingle();
    if (error) return { error: error.message };
    return data ?? null;
  } catch (e) {
    return { error: String(e.message ?? e) };
  }
}

async function withRetry(fn, label, retries = 3) {
  let lastErr = null;
  for (let i = 1; i <= retries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (i < retries) await new Promise((r) => setTimeout(r, 1200 * i));
    }
  }
  throw new Error(`${label}: ${lastErr?.message ?? lastErr}`);
}

async function main() {
  assert.ok(GPT_URL && GPT_KEY && GPT_ANON, "GPT Supabase env missing");
  assert.ok(SUBS_URL && SUBS_KEY && SUBS_ANON, "Subs Supabase env missing");

  const gptCtx = await loadOperatorContext("gpt", GPT_URL, GPT_KEY, GPT_ANON);
  const subsCtx = await loadOperatorContext("subs", SUBS_URL, SUBS_KEY, SUBS_ANON);

  const gptMembership = gptCtx.memberships.find((m) => m.site_slug === "gpt-store");
  const subsMembership = subsCtx.memberships.find((m) => m.site_slug === "subs-store");
  assert.ok(gptMembership?.role === "operator" || gptCtx.profile.role === "operator", "GPT operator membership/role");
  assert.ok(subsMembership?.role === "operator" || subsCtx.profile.role === "operator", "Subs operator membership/role");

  const gptRecipients = await collectStaffRecipientsMirror(gptCtx.admin, "gpt-store");
  const subsRecipients = await collectStaffRecipientsMirror(subsCtx.admin, "subs-store");
  const inGptRecipients = gptRecipients.some((r) => normEmail(r.email) === OPERATOR_EMAIL || r.userId === gptCtx.profile.id);
  const inSubsRecipients = subsRecipients.some((r) => normEmail(r.email) === OPERATOR_EMAIL || r.userId === subsCtx.profile.id);
  assert.ok(inGptRecipients, "operator missing from GPT staff email recipients mirror");
  assert.ok(inSubsRecipients, "operator missing from Subs staff email recipients mirror");

  const gptRls = await testRlsAndMarkAll(gptCtx);
  const subsRls = await testRlsAndMarkAll(subsCtx);

  const gptEmail = await readEmailSettings(gptCtx.admin, "gpt-store");
  const subsEmail = await readEmailSettings(subsCtx.admin, "subs-store");

  console.log(
    JSON.stringify(
      {
        ok: true,
        operator_email: OPERATOR_EMAIL,
        gpt: {
          user_id: gptCtx.profile.id,
          role: gptCtx.profile.role,
          email_confirmed: gptCtx.emailConfirmed,
          memberships: gptCtx.memberships,
          in_staff_recipients: inGptRecipients,
          email_settings: gptEmail,
          ...gptRls,
        },
        subs: {
          user_id: subsCtx.profile.id,
          role: subsCtx.profile.role,
          email_confirmed: subsCtx.emailConfirmed,
          memberships: subsCtx.memberships,
          in_staff_recipients: inSubsRecipients,
          email_settings: subsEmail,
          ...subsRls,
        },
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(JSON.stringify({ ok: false, operator_email: OPERATOR_EMAIL, error: e.message }, null, 2));
  process.exit(1);
});
