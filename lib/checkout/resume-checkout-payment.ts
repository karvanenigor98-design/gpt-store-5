import type { SiteSlug } from "@/lib/auth/siteUiSession";

import { CHECKOUT_PAYMENT_URL_STORAGE_KEY } from "@/lib/checkout/start-payment-wait";

/** Получить paymentUrl для неоплаченного заказа (subs: только orderId). */
export async function fetchCheckoutPaymentUrl(
  orderId: string,
  siteSlug: SiteSlug,
): Promise<string | null> {
  if (siteSlug === "subs-store") {
    const res = await fetch("/api/payments/subs-store/pally/create", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId }),
    });
    const json = (await res.json().catch(() => ({}))) as { paymentUrl?: string };
    return json.paymentUrl?.trim() || null;
  }
  return null;
}

/** sessionStorage → API resume → redirect на Pally. */
export async function redirectToCheckoutPayment(
  orderId: string,
  siteSlug: SiteSlug,
): Promise<boolean> {
  try {
    const cached = sessionStorage.getItem(CHECKOUT_PAYMENT_URL_STORAGE_KEY);
    if (cached?.trim()) {
      sessionStorage.removeItem(CHECKOUT_PAYMENT_URL_STORAGE_KEY);
      window.location.replace(cached.trim());
      return true;
    }
  } catch {
    /* ignore */
  }

  const paymentUrl = await fetchCheckoutPaymentUrl(orderId, siteSlug);
  if (!paymentUrl) return false;

  window.location.replace(paymentUrl);
  return true;
}
