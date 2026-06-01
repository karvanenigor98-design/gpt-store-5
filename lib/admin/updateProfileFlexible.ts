import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

const MISSING_COLUMN_RE = /column profiles\.(\w+) does not exist/i;
const SCHEMA_CACHE_RE = /could not find the '(\w+)' column of 'profiles' in the schema cache/i;

/**
 * Updates profiles, dropping keys PostgREST rejects (missing column / stale schema cache).
 */
export async function updateProfileFlexible(
  db: SupabaseClient<Database>,
  id: string,
  patch: Record<string, unknown>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  let fields = Object.entries(patch).filter(([, v]) => v !== undefined);

  for (let attempt = 0; attempt < 12 && fields.length > 0; attempt += 1) {
    const payload = Object.fromEntries(fields) as Database["public"]["Tables"]["profiles"]["Update"];
    const { error } = await db.from("profiles").update(payload).eq("id", id);

    if (!error) return { ok: true };

    const msg = error.message;
    const missing = msg.match(MISSING_COLUMN_RE) ?? msg.match(SCHEMA_CACHE_RE);
    if (missing?.[1]) {
      const col = missing[1];
      if (fields.some(([k]) => k === col)) {
        fields = fields.filter(([k]) => k !== col);
        continue;
      }
    }

    return { ok: false, error: msg };
  }

  return { ok: false, error: "Нет полей для обновления профиля" };
}
