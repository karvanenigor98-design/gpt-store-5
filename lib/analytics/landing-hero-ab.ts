"use client";

import { useEffect, useState } from "react";
import { reachLandingGoal, type LandingGoalSite } from "@/lib/analytics/reach-landing-goal";

/** A: срок в badge. B: срок в H1 (accent). */
export type LandingHeroAbVariant = "badge" | "h1";

const STORAGE_PREFIX = "landing_hero_ab_";

function storageKey(site: LandingGoalSite): string {
  return `${STORAGE_PREFIX}${site}`;
}

export function readLandingHeroAbVariant(site: LandingGoalSite): LandingHeroAbVariant | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(storageKey(site));
  return raw === "badge" || raw === "h1" ? raw : null;
}

export function assignLandingHeroAbVariant(site: LandingGoalSite): LandingHeroAbVariant {
  const existing = readLandingHeroAbVariant(site);
  if (existing) return existing;

  const variant: LandingHeroAbVariant = Math.random() < 0.5 ? "badge" : "h1";
  try {
    window.localStorage.setItem(storageKey(site), variant);
  } catch {
    /* private mode */
  }
  return variant;
}

export function useLandingHeroAb(site: LandingGoalSite): LandingHeroAbVariant {
  const [variant, setVariant] = useState<LandingHeroAbVariant>("badge");

  useEffect(() => {
    const assigned = assignLandingHeroAbVariant(site);
    setVariant(assigned);
    reachLandingGoal("landing_hero_ab_assigned", { site, source: assigned });
    reachLandingGoal(assigned === "h1" ? "landing_hero_ab_h1" : "landing_hero_ab_badge", {
      site,
      source: "hero_mount",
    });
  }, [site]);

  return variant;
}
