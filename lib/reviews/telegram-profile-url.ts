/** Ссылка на профиль пользователя в Telegram; иначе — исходное сообщение в канале. */
export function telegramProfileUrl(
  authorUsername: string | null | undefined,
  sourceUrl?: string | null,
): string | null {
  const username = authorUsername?.replace(/^@+/, "").trim();
  if (username && username.length >= 3 && !/^\d+$/.test(username)) {
    if (!/digital_sub|subs_store|gpt_store|reviews$/i.test(username)) {
      return `https://t.me/${username}`;
    }
  }
  const src = sourceUrl?.trim();
  if (src && /t\.me\//i.test(src)) return src;
  return null;
}
