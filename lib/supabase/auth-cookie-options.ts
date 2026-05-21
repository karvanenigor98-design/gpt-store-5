/**
 * Общие auth-cookie для GPT + Subs на одном хосте (dev: 127.0.0.1:3055 и :3056).
 * Задайте NEXT_PUBLIC_AUTH_COOKIE_DOMAIN=127.0.0.1 в .env.local
 */
export function getAuthCookieOptions(): {
  path: string;
  sameSite: "lax";
  domain?: string;
} {
  const domain = process.env.NEXT_PUBLIC_AUTH_COOKIE_DOMAIN?.trim();
  return {
    path: "/",
    sameSite: "lax",
    ...(domain ? { domain } : {}),
  };
}
