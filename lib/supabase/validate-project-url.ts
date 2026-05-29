/** Нормализует Project URL: без /rest/v1, /graphql/v1 и trailing slash. */
export function normalizeSupabaseProjectUrl(raw: string | null | undefined): string {
  const trimmed = raw?.trim().replace(/^["']|["']$/g, "") ?? "";
  if (!trimmed) return "";
  try {
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const u = new URL(withProtocol);
    let path = u.pathname.replace(/\/$/, "");
    if (path === "/rest/v1" || path.startsWith("/rest/v1/")) path = "";
    if (path === "/graphql/v1" || path.startsWith("/graphql/v1/")) path = "";
    if (path === "/auth/v1") path = "";
    return `${u.protocol}//${u.host}${path}`;
  } catch {
    return trimmed.replace(/\/rest\/v1\/?$/i, "").replace(/\/$/, "");
  }
}

/** Проверка, что в env подставлен URL проекта Supabase, а не домен приложения. */
export function isValidSupabaseProjectUrl(raw: string | null | undefined): boolean {
  const normalized = normalizeSupabaseProjectUrl(raw);
  if (!normalized) return false;
  try {
    const u = new URL(normalized);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    const host = u.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1") return true;
    if (host.endsWith(".supabase.co")) {
      const path = u.pathname.replace(/\/$/, "");
      return path === "";
    }
    return false;
  } catch {
    return false;
  }
}

export function supabaseUrlConfigHint(varName: string): string {
  return (
    `${varName} = https://xxxxx.supabase.co (Project URL из Dashboard → API). ` +
    `Не добавляйте /rest/v1/ и не подставляйте домен gpt-store-5.vercel.app.`
  );
}

export function getGptPublicSupabaseUrl(): string {
  return normalizeSupabaseProjectUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
}
