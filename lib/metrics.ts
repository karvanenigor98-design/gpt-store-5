import { getGptStoreYmId } from "@/lib/analytics/gpt-store-metrika";
import { getSubsStoreYmId } from "@/lib/analytics/subs-store-metrika";

export type MetrikaStore = "gpt" | "spotify";

export type MetrikaGoalParams = {
  planId?: string;
  source?: string;
  orderId?: string;
};

const ONCE_STORAGE_PREFIX = "metrika:once:";
const memoryOnceKeys = new Set<string>();

function resolveYmId(store: MetrikaStore): number | null {
  return store === "gpt" ? getGptStoreYmId() : getSubsStoreYmId();
}

function logMetrika(goalName: string, params?: MetrikaGoalParams): void {
  if (process.env.NODE_ENV !== "development") return;
  if (params && Object.keys(params).length > 0) {
    console.log(`[METRIKA] ${goalName}`, params);
  } else {
    console.log(`[METRIKA] ${goalName}`);
  }
}

function currentPageKey(): string {
  if (typeof window === "undefined") return "";
  return `${window.location.pathname}${window.location.search}`;
}

/** Базовый reachGoal без дедупликации — только для явных действий (клик). */
export function trackGoal(
  store: MetrikaStore,
  goalName: string,
  params?: MetrikaGoalParams,
): boolean {
  if (typeof window === "undefined") return false;

  const ymId = resolveYmId(store);
  const ym = (window as { ym?: (id: number, action: string, ...args: unknown[]) => void }).ym;
  if (!ymId || typeof ym !== "function") return false;

  try {
    ym(ymId, "reachGoal", goalName, params ?? {});
    logMetrika(goalName, params);
    return true;
  } catch {
    return false;
  }
}

/**
 * reachGoal не чаще одного раза на dedupeKey (память + sessionStorage).
 * Защита: StrictMode, re-render, refresh страницы, два компонента на success.
 */
export function trackGoalOnce(
  dedupeKey: string,
  store: MetrikaStore,
  goalName: string,
  params?: MetrikaGoalParams,
): boolean {
  if (memoryOnceKeys.has(dedupeKey)) return false;

  try {
    if (sessionStorage.getItem(`${ONCE_STORAGE_PREFIX}${dedupeKey}`)) return false;
  } catch {
    /* private mode */
  }

  const sent = trackGoal(store, goalName, params);
  if (!sent) return false;

  memoryOnceKeys.add(dedupeKey);
  try {
    sessionStorage.setItem(`${ONCE_STORAGE_PREFIX}${dedupeKey}`, "1");
  } catch {
    /* private mode */
  }
  return true;
}

/** /checkout[?plan=…] — начало оформления GPT (1× на URL за сессию вкладки). */
export function trackGPTCheckout(params?: MetrikaGoalParams): boolean {
  const page = currentPageKey() || "/checkout";
  return trackGoalOnce(`gpt_checkout:${page}`, "gpt", "gpt_checkout", {
    ...params,
    source: params?.source ?? "checkout_page",
  });
}

/** /checkout/spotify[?plan=…] — начало оформления Spotify (1× на URL за сессию вкладки). */
export function trackSpotifyCheckout(params?: MetrikaGoalParams): boolean {
  const page = currentPageKey() || "/checkout/spotify";
  return trackGoalOnce(`spotify_checkout:${page}`, "spotify", "spotify_checkout", {
    ...params,
    source: params?.source ?? "checkout_page",
  });
}

export function trackGptSelectPlan(planId: string, source?: string): boolean {
  return trackGoal("gpt", "gpt_select_plan", { planId, source });
}

export function trackSpotifySelectPlan(planId: string, source?: string): boolean {
  return trackGoal("spotify", "spotify_select_plan", { planId, source });
}

/** Клик «Оплатить» на GPT checkout — только из обработчика кнопки. */
export function trackGPTPayClick(planId: string, source?: string): boolean {
  return trackGoal("gpt", "gpt_click_pay", { planId, source });
}

/** Клик «Оплатить» на Spotify checkout — только из обработчика кнопки. */
export function trackSpotifyPayClick(planId: string, source?: string): boolean {
  return trackGoal("spotify", "spotify_click_pay", { planId, source });
}

/** Успешная оплата GPT — dedupe по orderId. */
export function trackGPTPaymentSuccess(orderId?: string | null, source?: string): boolean {
  const dedupeKey = `gpt_payment_success:${orderId ?? "no-order"}`;
  return trackGoalOnce(dedupeKey, "gpt", "gpt_payment_success", {
    orderId: orderId ?? undefined,
    source,
  });
}

/** Успешная оплата Spotify — dedupe по orderId. */
export function trackSpotifyPaymentSuccess(orderId?: string | null, source?: string): boolean {
  const dedupeKey = `spotify_payment_success:${orderId ?? "no-order"}`;
  return trackGoalOnce(dedupeKey, "spotify", "spotify_payment_success", {
    orderId: orderId ?? undefined,
    source,
  });
}

export function trackSpotifyPaymentFail(source?: string): boolean {
  return trackGoal("spotify", "spotify_payment_fail", { source });
}

/** @deprecated используйте trackGPTPayClick / trackSpotifyPayClick */
export function trackPaymentClick(
  store: MetrikaStore,
  planId: string,
  source?: string,
): boolean {
  return store === "gpt"
    ? trackGPTPayClick(planId, source)
    : trackSpotifyPayClick(planId, source);
}

/** @deprecated используйте trackGPTPaymentSuccess / trackSpotifyPaymentSuccess */
export function trackSuccessfulPayment(
  store: MetrikaStore,
  orderId?: string | null,
  source?: string,
): boolean {
  return store === "gpt"
    ? trackGPTPaymentSuccess(orderId, source)
    : trackSpotifyPaymentSuccess(orderId, source);
}
