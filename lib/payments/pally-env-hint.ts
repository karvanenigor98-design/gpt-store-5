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
  if (/url_not_allowed|настройками магазина|магазин неактивен|неактивн/i.test(message)) return false;
  return /pally|fetch failed|PALLY_|не настроен|связаться с pally|ENOTFOUND|ip_access|белом списке|relay недоступен/i.test(
    message,
  );
}

export function formatPallyCheckoutError(message: string): string {
  if (/url_not_allowed|настройками магазина/i.test(message)) {
    return `${message} Заказ сохранён — повторите оплату после правки ссылок в Pally.`;
  }
  if (/ip_access|белом списке/i.test(message)) {
    return `${message} Заказ сохранён — оплату можно повторить после настройки Pally.`;
  }
  if (/магазин неактивен|неактивн/i.test(message)) {
    return `${message} Заказ сохранён в админке — повторите оплату после активации магазина в Pally.`;
  }
  if (isPallyConfigError(message)) {
    return `${message}${getPallyEnvSetupHint()}`;
  }
  return message;
}
