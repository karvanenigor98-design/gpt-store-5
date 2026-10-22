export const GPT_PLAN_SEARCH_EVENT = "gpt-store:plan-search";
export const GPT_LANDING_HEADER_OFFSET = 64;

export function scrollToGptPlans(): void {
  const el = document.getElementById("plans");
  if (!el) return;
  const top = el.getBoundingClientRect().top + window.scrollY - GPT_LANDING_HEADER_OFFSET;
  window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
}

export function dispatchGptPlanSearch(query: string): void {
  window.dispatchEvent(new CustomEvent(GPT_PLAN_SEARCH_EVENT, { detail: { q: query } }));
}

export function subscribeGptPlanSearch(onQuery: (query: string) => void): () => void {
  const handler = (event: Event) => {
    const q = (event as CustomEvent<{ q?: string }>).detail?.q ?? "";
    onQuery(typeof q === "string" ? q : "");
  };
  window.addEventListener(GPT_PLAN_SEARCH_EVENT, handler);
  return () => window.removeEventListener(GPT_PLAN_SEARCH_EVENT, handler);
}

export function readGptPlanSearchFromUrl(): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("q") ?? "";
}

export function matchesGptPlanQuery(haystack: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return haystack.toLowerCase().includes(q);
}
