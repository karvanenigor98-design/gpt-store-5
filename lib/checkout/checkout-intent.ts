import type { AuthSiteSlug } from "@/lib/auth/detectAuthSite";

export type CheckoutIntent = {
  siteSlug: AuthSiteSlug;
  planId: string;
  planName?: string | null;
  promoCode?: string | null;
  accountEmail?: string | null;
  returnPath: string;
  createdAt: number;
};

const STORAGE_KEY = "store_checkout_intent";
const TTL_MS = 24 * 60 * 60 * 1000;

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function buildCheckoutPath(siteSlug: AuthSiteSlug, planId: string): string {
  const base = siteSlug === "subs-store" ? "/checkout/spotify" : "/checkout";
  return `${base}?plan=${encodeURIComponent(planId)}`;
}

export function isCheckoutReturnPath(path: string | null | undefined): boolean {
  if (!path) return false;
  return path.startsWith("/checkout") || path.startsWith("/checkout/spotify");
}

export function parsePlanIdFromCheckoutPath(path: string): string | null {
  try {
    const url = new URL(path, "https://local.invalid");
    return url.searchParams.get("plan");
  } catch {
    return null;
  }
}

export function saveCheckoutIntent(
  intent: Omit<CheckoutIntent, "createdAt">,
): void {
  if (!isBrowser()) return;
  try {
    const payload: CheckoutIntent = { ...intent, createdAt: Date.now() };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* private mode / quota */
  }
}

export function readCheckoutIntent(
  siteSlug?: AuthSiteSlug,
): CheckoutIntent | null {
  if (!isBrowser()) return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CheckoutIntent;
    if (!parsed?.siteSlug || !parsed.planId || !parsed.returnPath) return null;
    if (Date.now() - (parsed.createdAt ?? 0) > TTL_MS) {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    if (siteSlug && parsed.siteSlug !== siteSlug) return null;
    if (!parsed.returnPath.startsWith("/") || parsed.returnPath.startsWith("//")) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearCheckoutIntent(): void {
  if (!isBrowser()) return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* noop */
  }
}

export function getCheckoutAuthMessage(
  returnUrl: string,
  siteSlug: AuthSiteSlug,
): string | null {
  if (!isCheckoutReturnPath(returnUrl)) return null;
  if (siteSlug === "subs-store") {
    return "Войдите или зарегистрируйтесь, чтобы продолжить оформление Spotify Premium";
  }
  return "Войдите или зарегистрируйтесь, чтобы продолжить оформление ChatGPT Plus";
}
