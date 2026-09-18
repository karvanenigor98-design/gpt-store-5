import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

const MISSING_COLUMN_RE = /column profiles\.(\w+) does not exist/i;

type ProfileRow = Record<string, unknown>;

export function isMissingProfilesColumn(message: string, column: string): boolean {
  return new RegExp(`column profiles\\.${column} does not exist`, "i").test(message);
}

export type SelectProfilesFlexibleOptions = {
  limit?: number;
  /** 0-based offset for .range() */
  offset?: number;
  orderBy?: string;
  roleEq?: string | null;
  /** When set, include these roles via .in() instead of roleEq */
  roleIn?: string[] | null;
  excludeId?: string | null;
  countExact?: boolean;
};

/**
 * Читает profiles, автоматически убирая колонки, которых нет в Subs/GPT Supabase
 * (например telegram_username в старой схеме Subs Store).
 */
export async function selectProfilesFlexible(
  db: SupabaseClient<Database>,
  desiredColumns: string[],
  options?: SelectProfilesFlexibleOptions,
): Promise<{ rows: ProfileRow[]; error: string | null; count: number | null }> {
  const limit = Math.min(Math.max(options?.limit ?? 500, 1), 500);
  const offset = Math.max(options?.offset ?? 0, 0);
  const orderBy = options?.orderBy ?? "created_at";
  let columns = [...new Set(desiredColumns.filter(Boolean))];

  let lastError: string | null = null;

  for (let attempt = 0; attempt < 12 && columns.length > 0; attempt += 1) {
    let q = db
      .from("profiles")
      .select(columns.join(", "), options?.countExact ? { count: "exact" } : undefined)
      .order(orderBy, { ascending: false })
      .range(offset, offset + limit - 1);

    if (options?.roleIn?.length) {
      q = q.in("role", options.roleIn as Database["public"]["Enums"]["user_role"][]);
    } else if (options?.roleEq) {
      q = q.eq("role", options.roleEq as Database["public"]["Enums"]["user_role"]);
    }
    if (options?.excludeId) {
      q = q.neq("id", options.excludeId);
    }

    const { data, error, count } = await q;

    if (!error) {
      const rows = (data ?? []).map((row) => {
        const out: ProfileRow = { ...(row as unknown as ProfileRow) };
        for (const col of desiredColumns) {
          if (!(col in out)) out[col] = null;
        }
        return out;
      });
      return { rows, error: null, count: typeof count === "number" ? count : null };
    }

    lastError = error.message;
    const match = error.message.match(MISSING_COLUMN_RE);
    if (match?.[1] && columns.includes(match[1])) {
      columns = columns.filter((c) => c !== match[1]);
      continue;
    }

    break;
  }

  return { rows: [], error: lastError, count: null };
}

/** Одна строка profiles по id; убирает отсутствующие колонки (Subs без telegram_username). */
export async function selectProfileByIdFlexible(
  db: SupabaseClient<Database>,
  id: string,
  desiredColumns: string[],
): Promise<{ row: ProfileRow | null; error: string | null }> {
  let columns = [...new Set(desiredColumns.filter(Boolean))];
  let lastError: string | null = null;

  for (let attempt = 0; attempt < 12 && columns.length > 0; attempt += 1) {
    const { data, error } = await db
      .from("profiles")
      .select(columns.join(", "))
      .eq("id", id)
      .maybeSingle();

    if (!error) {
      if (!data) return { row: null, error: null };
      const out: ProfileRow = { ...(data as unknown as ProfileRow) };
      for (const col of desiredColumns) {
        if (!(col in out)) out[col] = null;
      }
      return { row: out, error: null };
    }

    lastError = error.message;
    const match = error.message.match(MISSING_COLUMN_RE);
    if (match?.[1] && columns.includes(match[1])) {
      columns = columns.filter((c) => c !== match[1]);
      continue;
    }

    break;
  }

  return { row: null, error: lastError };
}
