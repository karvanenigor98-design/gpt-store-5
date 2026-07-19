import type { SpotifyPlan } from "@/lib/content/spotify";

/** Cheapest individual plan — matches hero «от N ₽» and checkout CTA. */
export function resolveHeroCheckoutPlan(plans: readonly SpotifyPlan[]): SpotifyPlan | null {
  const individual = plans.filter((p) => p.tab === "individual" && p.price > 0);
  if (!individual.length) return null;
  return individual.reduce((best, p) => (p.price < best.price ? p : best));
}
