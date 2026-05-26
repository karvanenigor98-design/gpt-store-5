/** Подсказка для UI: где настроить Pally (локально vs Vercel). */
export function getPallyEnvSetupHint(): string {
  if (process.env.NODE_ENV === "production") {
    return (
      " Настройте PALLY_SHOP_ID, PALLY_SECRET_KEY и NEXT_PUBLIC_APP_URL " +
      "в Vercel → Settings → Environment Variables и сделайте Redeploy."
    );
  }
  return (
    " Настройте PALLY_SHOP_ID и PALLY_SECRET_KEY в .env.local и перезапустите npm run dev:gpt."
  );
}

export function isPallyConfigError(message: string | undefined): boolean {
  if (!message) return false;
  return /pally|fetch failed|PALLY_|не настроен|временно недоступна|связаться с pally|ENOTFOUND/i.test(
    message,
  );
}
