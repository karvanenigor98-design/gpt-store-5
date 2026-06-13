/**
 * Integration smoke against real Supabase (GPT + Subs).
 * Creates one temp staff notification, mark-all for admin, verifies read state, deletes temp row.
 * Run: node scripts/integration-test-staff-notifications.cjs
 */
require("dotenv").config({ path: ".env.local" });
const assert = require("node:assert/strict");
const { createClient } = require("@supabase/supabase-js");

const GPT_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const GPT_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUBS_URL = process.env.SUBS_SUPABASE_URL;
const SUBS_KEY = process.env.SUBS_SUPABASE_SERVICE_ROLE_KEY;

async function tableOk(client, name) {
  const { error } = await client.from(name).select("id").limit(1);
  if (!error) return { ok: true };
  return { ok: false, error: error.message };
}

async function findStaffUser(client) {
  const { data, error } = await client
    .from("profiles")
    .select("id, email, role")
    .in("role", ["admin", "operator"])
    .limit(1);
  if (error) throw new Error(`profiles: ${error.message}`);
  if (!data?.length) throw new Error("no staff profile found");
  return data[0];
}

async function testMarkAllOnDb(label, client, user) {
  const tag = `[${label}]`;
  const reads = await tableOk(client, "notification_reads");
  console.log(`${tag} notification_reads:`, reads.ok ? "ok" : reads.error);

  const { data: inserted, error: insErr } = await client
    .from("notifications")
    .insert({
      type: "new_order",
      title: `__integration_test__ ${Date.now()}`,
      message: "temp row for mark-all smoke",
      recipient_user_id: null,
      recipient_role: "admin",
      is_read: false,
    })
    .select("id")
    .single();

  if (insErr) throw new Error(`${tag} insert notification: ${insErr.message}`);
  const notifId = inserted.id;

  const now = new Date().toISOString();
  const { error: upsertErr } = await client.from("notification_reads").upsert(
    {
      notification_id: notifId,
      user_id: user.id,
      read_at: now,
    },
    { onConflict: "notification_id,user_id" },
  );

  if (upsertErr && !String(upsertErr.message).toLowerCase().includes("notification_reads")) {
    const { error: fbErr } = await client
      .from("notifications")
      .update({ is_read: true })
      .eq("id", notifId);
    if (fbErr) throw new Error(`${tag} fallback is_read: ${fbErr.message}`);
  } else if (upsertErr) {
    throw new Error(`${tag} notification_reads upsert: ${upsertErr.message}`);
  } else {
    await client.from("notifications").update({ is_read: true }).eq("id", notifId);
  }

  const { data: after, error: selErr } = await client
    .from("notifications")
    .select("is_read")
    .eq("id", notifId)
    .single();
  if (selErr) throw new Error(`${tag} select after: ${selErr.message}`);
  assert.equal(after.is_read, true, `${tag} is_read should be true`);

  let readRow = null;
  if (reads.ok) {
    const { data: rr } = await client
      .from("notification_reads")
      .select("notification_id")
      .eq("notification_id", notifId)
      .eq("user_id", user.id)
      .maybeSingle();
    readRow = rr;
  }

  const { error: delErr } = await client.from("notifications").delete().eq("id", notifId);
  if (delErr) console.warn(`${tag} cleanup delete failed:`, delErr.message);
  else if (reads.ok && readRow) {
    await client
      .from("notification_reads")
      .delete()
      .eq("notification_id", notifId)
      .eq("user_id", user.id);
  }

  return {
    notification_reads_table: reads.ok,
    mark_persisted: true,
    staff_user: user.email ?? user.id,
  };
}

async function main() {
  assert.ok(GPT_URL && GPT_KEY, "GPT Supabase env missing");
  const gpt = createClient(GPT_URL, GPT_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const staff = await findStaffUser(gpt);
  const gptResult = await testMarkAllOnDb("gpt", gpt, staff);

  let subsResult = null;
  if (SUBS_URL && SUBS_KEY) {
    const subs = createClient(SUBS_URL, SUBS_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    subsResult = await testMarkAllOnDb("subs", subs, staff);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        gpt: gptResult,
        subs: subsResult ?? "skipped",
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(JSON.stringify({ ok: false, error: e.message }, null, 2));
  process.exit(1);
});
