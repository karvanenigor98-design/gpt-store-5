import type { User } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { isSupabaseAuthCookieName } from "@/lib/auth/has-supabase-auth-cookie";

function decodeBase64Url(input: string): string {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(padded, "base64").toString("utf8");
}

function parseSessionJson(raw: string): Record<string, unknown> | null {
  let text = raw.trim();
  if (!text) return null;
  try {
    text = decodeURIComponent(text);
  } catch {
    /* already decoded */
  }
  if (text.startsWith("base64-")) {
    try {
      text = decodeBase64Url(text.slice("base64-".length));
    } catch {
      return null;
    }
  }
  try {
    const parsed = JSON.parse(text) as unknown;
    if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
  return null;
}

function userFromAccessToken(access: string): { user: User; expiresAt?: number } | null {
  const parts = access.split(".");
  if (parts.length < 2) return null;
  try {
    const payload = JSON.parse(decodeBase64Url(parts[1])) as Record<string, unknown>;
    const exp = typeof payload.exp === "number" ? payload.exp : undefined;
    if (exp && exp * 1000 <= Date.now() + 5_000) return null;
    const id = String(payload.sub ?? "");
    if (!id) return null;
    const meta =
      payload.user_metadata && typeof payload.user_metadata === "object"
        ? (payload.user_metadata as Record<string, unknown>)
        : {};
    const email =
      (typeof payload.email === "string" && payload.email) ||
      (typeof meta.email === "string" && meta.email) ||
      null;
    return {
      user: {
        id,
        email,
        aud: typeof payload.aud === "string" ? payload.aud : "authenticated",
        role: typeof payload.role === "string" ? payload.role : "authenticated",
        app_metadata:
          payload.app_metadata && typeof payload.app_metadata === "object"
            ? (payload.app_metadata as User["app_metadata"])
            : {},
        user_metadata: meta,
        created_at: "",
      } as User,
      expiresAt: exp,
    };
  } catch {
    return null;
  }
}

function userFromSession(session: Record<string, unknown>): { user: User; expiresAt?: number } | null {
  const expiresAt = typeof session.expires_at === "number" ? session.expires_at : undefined;
  if (expiresAt && expiresAt * 1000 <= Date.now() + 5_000) return null;

  const nested = session.user;
  if (nested && typeof nested === "object" && "id" in nested) {
    const user = nested as User;
    if (user.id) return { user, expiresAt };
  }

  const access = typeof session.access_token === "string" ? session.access_token : "";
  if (!access) return null;
  return userFromAccessToken(access);
}

/** JWT из cookie без getSession/сети — оператора не выкидываем из-за таймаута Auth. */
export async function readGptAuthUserFromCookies(): Promise<{
  user: User | null;
  expiresAt?: number;
}> {
  try {
    const store = await cookies();
    const groups = new Map<string, { index: number; value: string }[]>();
    for (const cookie of store.getAll()) {
      if (!isSupabaseAuthCookieName(cookie.name)) continue;
      if (cookie.name.includes("code-verifier")) continue;
      const chunkMatch = cookie.name.match(/^(.*-auth-token)(?:\.(\d+))?$/);
      if (!chunkMatch) continue;
      const base = chunkMatch[1];
      const index = chunkMatch[2] ? Number(chunkMatch[2]) : 0;
      const arr = groups.get(base) ?? [];
      arr.push({ index, value: cookie.value });
      groups.set(base, arr);
    }

    for (const chunks of groups.values()) {
      chunks.sort((a, b) => a.index - b.index);
      const session = parseSessionJson(chunks.map((c) => c.value).join(""));
      if (!session) continue;
      const parsed = userFromSession(session);
      if (parsed?.user) return parsed;
    }
  } catch {
    /* cookies() outside request */
  }
  return { user: null };
}
