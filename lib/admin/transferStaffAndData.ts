import type { SupabaseClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";

import { roleAfterGrant } from "@/lib/auth/staffRoleMerge";
import { normalizeAuthEmail } from "@/lib/auth/superAdmin";
import type { Database, UserRole } from "@/types/database";

type AdminDb = SupabaseClient<Database>;

export type TransferCounts = {
  orders: number;
  chat_sessions: number;
  chat_messages: number;
};

type ProfileSlice = {
  id: string;
  email: string | null;
  notes: string | null;
  tags: string[] | null;
  client_stage: string | null;
  role: UserRole | null;
};

async function loadProfile(
  db: AdminDb,
  id: string,
): Promise<{ profile: ProfileSlice | null; error: string | null }> {
  const columns = ["id", "email", "notes", "tags", "client_stage", "role"] as const;
  let selectCols = [...columns];

  for (let i = 0; i < 6 && selectCols.length > 0; i += 1) {
    const { data, error } = await db
      .from("profiles")
      .select(selectCols.join(", "))
      .eq("id", id)
      .maybeSingle();

    if (!error) {
      const row = data as Record<string, unknown> | null;
      if (!row?.id) return { profile: null, error: null };
      return {
        profile: {
          id: String(row.id),
          email: (row.email as string | null) ?? null,
          notes: (row.notes as string | null) ?? null,
          tags: (row.tags as string[] | null) ?? null,
          client_stage: (row.client_stage as string | null) ?? null,
          role: (row.role as UserRole | null) ?? null,
        },
        error: null,
      };
    }

    const match = error.message.match(/column profiles\.(\w+) does not exist/i);
    if (match?.[1] && selectCols.includes(match[1] as (typeof columns)[number])) {
      selectCols = selectCols.filter((c) => c !== match[1]);
      continue;
    }
    return { profile: null, error: error.message };
  }

  return { profile: null, error: "Не удалось прочитать профиль" };
}

/** Subs: UUID профиля админа по email из GPT-сессии. */
export async function resolveSubsProfileIdByEmail(
  db: AdminDb,
  email: string | null | undefined,
): Promise<string | null> {
  const n = normalizeAuthEmail(email);
  if (!n) return null;
  const { data } = await db.from("profiles").select("id").ilike("email", n).maybeSingle();
  return data?.id ?? null;
}

export async function executeTransferStaffAndData(options: {
  db: AdminDb;
  gptUser: User;
  site: "gpt-store" | "subs-store";
  targetUserId: string;
  grant: "admin" | "operator";
  migrateData: boolean;
}): Promise<
  | { ok: true; role: UserRole; counts: TransferCounts; migrateData: boolean }
  | { ok: false; status: number; error: string }
> {
  const { db, gptUser, site, targetUserId, grant, migrateData } = options;

  const actorId =
    site === "subs-store" ?
      await resolveSubsProfileIdByEmail(db, gptUser.email)
    : gptUser.id;

  if (targetUserId === actorId) {
    return { ok: false, status: 400, error: "Нельзя выбрать себя как получателя" };
  }

  const [{ profile: actorProf, error: actorErr }, { profile: targetProf, error: targetErr }] =
    await Promise.all([
      actorId ? loadProfile(db, actorId) : Promise.resolve({ profile: null, error: null }),
      loadProfile(db, targetUserId),
    ]);

  if (actorErr || targetErr) {
    return { ok: false, status: 400, error: actorErr ?? targetErr ?? "Ошибка чтения профиля" };
  }
  if (!targetProf?.id) {
    return { ok: false, status: 404, error: "Получатель не найден" };
  }

  if (migrateData && site === "subs-store" && !actorId) {
    return {
      ok: false,
      status: 400,
      error:
        "Для переноса заказов и чатов нужен ваш профиль в Subs Store с тем же email, что у входа в админку. Зарегистрируйтесь на subs-store или создайте строку в profiles.",
    };
  }

  const nextRole = roleAfterGrant((targetProf.role ?? "client") as UserRole, grant);

  const profilePatch: {
    role: UserRole;
    notes?: string | null;
    tags?: string[] | null;
    client_stage?: string | null;
  } = { role: nextRole };

  if (migrateData && actorProf) {
    const mergedNotes = [targetProf.notes, actorProf.notes].filter(Boolean).join("\n---\n");
    if (targetProf.notes !== undefined || actorProf.notes !== undefined) {
      profilePatch.notes = mergedNotes || null;
    }
    if (targetProf.tags !== undefined || actorProf.tags !== undefined) {
      profilePatch.tags = Array.from(new Set([...(targetProf.tags ?? []), ...(actorProf.tags ?? [])]));
    }
    if (targetProf.client_stage !== undefined || actorProf.client_stage !== undefined) {
      profilePatch.client_stage = targetProf.client_stage ?? actorProf.client_stage;
    }
  }

  const { error: upErr } = await db.from("profiles").update(profilePatch).eq("id", targetUserId);
  if (upErr) return { ok: false, status: 400, error: upErr.message };

  const counts: TransferCounts = { orders: 0, chat_sessions: 0, chat_messages: 0 };

  if (migrateData && actorId) {
    const { data: ord } = await db
      .from("orders")
      .update({ user_id: targetUserId })
      .eq("user_id", actorId)
      .select("id");
    counts.orders = ord?.length ?? 0;

    if (site === "subs-store") {
      // Subs Store: chat_threads / chat_messages — схема не в GPT Database types
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const subsDb = db as any;
      const { data: threads } = await subsDb
        .from("chat_threads")
        .update({ user_id: targetUserId })
        .eq("user_id", actorId)
        .select("id");
      counts.chat_sessions = threads?.length ?? 0;

      try {
        const { data: msg } = await subsDb
          .from("chat_messages")
          .update({ author_id: targetUserId })
          .eq("author_id", actorId)
          .select("id");
        counts.chat_messages = msg?.length ?? 0;
      } catch {
        counts.chat_messages = 0;
      }
    } else {
      const { data: sess } = await db
        .from("chat_sessions")
        .update({ user_id: targetUserId })
        .eq("user_id", actorId)
        .select("id");
      counts.chat_sessions = sess?.length ?? 0;

      const { data: msg } = await db
        .from("chat_messages")
        .update({ sender_id: targetUserId })
        .eq("sender_id", actorId)
        .select("id");
      counts.chat_messages = msg?.length ?? 0;
    }
  }

  const auditActorId = site === "subs-store" ? actorId : gptUser.id;
  const { error: auditErr } = await db.from("role_audit").insert({
    actor_id: auditActorId ?? null,
    target_id: targetUserId,
    action: "transfer_staff_and_data",
    payload: { grant, migrateData, counts, newRole: nextRole, site },
  });
  if (auditErr && site === "gpt-store") {
    return { ok: false, status: 400, error: auditErr.message };
  }

  return { ok: true, role: nextRole, counts, migrateData };
}
