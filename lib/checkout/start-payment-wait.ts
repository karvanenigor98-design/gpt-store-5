import type { SiteSlug } from "@/lib/auth/siteUiSession";

type RouterLike = { push: (href: string) => void };

/** Сразу на страницу выбора оплаты Pally (без промежуточного pending + popup). */
export function startCheckoutPaymentWait(params: {
  orderId: string;
  siteSlug: SiteSlug;
  paymentUrl: string;
  router?: RouterLike;
}): void {
  const { orderId, siteSlug, paymentUrl } = params;

  try {
    sessionStorage.setItem(
      siteSlug === "subs-store" ? "subs-checkout-order" : "gpt-checkout-order",
      orderId,
    );
  } catch {
    /* ignore */
  }

  window.location.assign(paymentUrl);
}

/** @deprecated pending-страница больше не пишет URL; оставлено для старых сессий */
export const CHECKOUT_PAYMENT_URL_STORAGE_KEY = "pally-payment-url";
