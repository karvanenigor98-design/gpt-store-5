/**
 * Понятные сообщения, когда @supabase/supabase-js не может достучаться до проекта (DNS, TLS, URL, фаервол).
 */
export function humanizeSubsSupabaseError(raw: string | undefined | null): string {
  const m = (raw ?? "").trim();
  if (!m) {
    return "Нет соединения с базой Subs Store. Проверьте SUBS_SUPABASE_URL, интернет и VPN.";
  }
  const lower = m.toLowerCase();
  if (lower.includes("fetch failed") || lower.includes("networkerror") || lower.includes("failed to fetch")) {
    return "Не удалось подключиться к Supabase Subs Store (сеть или URL). Проверьте SUBS_SUPABASE_URL в .env.local (без кавычек и пробелов, формат https://….supabase.co), доступ в интернет и блокировки.";
  }
  if (lower.includes("enotfound") || lower.includes("getaddrinfo")) {
    return "Не найден хост в SUBS_SUPABASE_URL — проверьте опечатку в адресе проекта.";
  }
  if (lower.includes("econnrefused") || lower.includes("connection refused")) {
    return "Подключение к Supabase отклонено — проверьте URL и прокси/фаервол.";
  }
  if (lower.includes("certificate") || lower.includes("ssl") || lower.includes("tls")) {
    return "Ошибка TLS при подключении к Supabase — проверьте корпоративный прокси/антивирус.";
  }
  return m;
}
