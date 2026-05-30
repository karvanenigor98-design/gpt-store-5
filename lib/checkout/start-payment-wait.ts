import type { SiteSlug } from "@/lib/auth/siteUiSession";

const PAYMENT_URL_KEY = "pally-payment-url";

type RouterLike = { push: (href: string) => void };

/** ПК остаётся на «ожидании оплаты», Pally открывается в новой вкладке (QR с телефона). */
export function startCheckoutPaymentWait(params: {
  orderId: string;
  siteSlug: SiteSlug;
  paymentUrl: string;
  router: RouterLike;
}): void {
  const { orderId, siteSlug, paymentUrl, router } = params;

  try {
    sessionStorage.setItem(PAYMENT_URL_KEY, paymentUrl);
    sessionStorage.setItem(
      siteSlug === "subs-store" ? "subs-checkout-order" : "gpt-checkout-order",
      orderId,
    );
  } catch {
    window.location.href = paymentUrl;
    return;
  }

  const q = new URLSearchParams({ order: orderId });
  if (siteSlug === "subs-store") q.set("site", "subs-store");
  router.push(`/checkout/pending?${q.toString()}`);
}

export const CHECKOUT_PAYMENT_URL_STORAGE_KEY = PAYMENT_URL_KEY;
