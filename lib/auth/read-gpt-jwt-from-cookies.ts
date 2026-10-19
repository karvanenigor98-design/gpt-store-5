import type { User } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { readGptAuthUserFromCookieList } from "@/lib/auth/parse-gpt-auth-cookie";

export { readGptAuthUserFromCookieList } from "@/lib/auth/parse-gpt-auth-cookie";

/** JWT из cookie без getSession/сети — оператора не выкидываем из-за таймаута Auth. */
export async function readGptAuthUserFromCookies(): Promise<{
  user: User | null;
  expiresAt?: number;
}> {
  try {
    const store = await cookies();
    return readGptAuthUserFromCookieList(store.getAll());
  } catch {
    /* cookies() outside request */
  }
  return { user: null };
}
