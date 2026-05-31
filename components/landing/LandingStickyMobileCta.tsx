"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { reachLandingGoal, type LandingGoalSite } from "@/lib/analytics/reach-landing-goal";
import { scrollToSpotifyPricing } from "@/lib/spotify/scroll-to-pricing";

type LandingStickyMobileCtaProps = {
  site: LandingGoalSite;
  label: string;
  accentColor: string;
  accentHover?: string;
  /** dark theme bar background for Spotify */
  variant?: "light" | "dark";
};

function scrollToGptPricing(): void {
  const el = document.getElementById("pricing");
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  window.location.hash = "pricing";
}

export function LandingStickyMobileCta({
  site,
  label,
  accentColor,
  accentHover,
  variant = "light",
}: LandingStickyMobileCtaProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const hero = document.getElementById("hero");
    const pricing = document.getElementById("pricing");
    if (!pricing) return;

    const mq = window.matchMedia("(max-width: 767px)");
    let heroVisible = true;
    let pricingVisible = false;

    const recompute = () => {
      if (!mq.matches) {
        setVisible(false);
        return;
      }
      setVisible(!heroVisible && !pricingVisible);
    };

    const heroObserver = hero
      ? new IntersectionObserver(
          ([entry]) => {
            heroVisible = Boolean(entry?.isIntersecting);
            recompute();
          },
          { threshold: 0.08, rootMargin: "-56px 0px 0px 0px" },
        )
      : null;

    const pricingObserver = new IntersectionObserver(
      ([entry]) => {
        pricingVisible = Boolean(entry?.isIntersecting);
        recompute();
      },
      { threshold: 0.12, rootMargin: "-56px 0px 0px 0px" },
    );

    const onMq = () => recompute();
    mq.addEventListener("change", onMq);

    if (hero && heroObserver) heroObserver.observe(hero);
    pricingObserver.observe(pricing);
    recompute();

    return () => {
      mq.removeEventListener("change", onMq);
      heroObserver?.disconnect();
      pricingObserver.disconnect();
    };
  }, []);

  const handleClick = () => {
    reachLandingGoal("landing_sticky_cta_click", { site, source: "sticky_bar" });
    reachLandingGoal("landing_scroll_to_pricing", { site, source: "sticky_bar" });
    if (site === "subs-store") scrollToSpotifyPricing();
    else scrollToGptPricing();
  };

  const isDark = variant === "dark";

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="pointer-events-none fixed inset-x-0 bottom-0 z-[45] md:hidden"
          style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0.5rem)" }}
        >
          <div
            className="pointer-events-auto mx-auto flex max-w-lg items-center gap-2 px-3 pt-2"
            style={{
              paddingRight: "max(0.75rem, env(safe-area-inset-right))",
              paddingLeft: "max(0.75rem, env(safe-area-inset-left))",
            }}
          >
            <button
              type="button"
              onClick={handleClick}
              className="flex min-h-[3rem] w-[calc(100%-9.5rem)] max-w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-lg"
              style={{
                background: accentColor,
                boxShadow: `0 6px 24px ${accentColor}55`,
              }}
              onMouseEnter={(e) => {
                if (accentHover) e.currentTarget.style.background = accentHover;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = accentColor;
              }}
            >
              {label}
              <ArrowRight size={16} />
            </button>
          </div>
          <div
            className="pointer-events-none mt-1 h-3 w-full"
            style={{
              background: isDark
                ? "linear-gradient(to top, rgba(10,10,10,0.95), transparent)"
                : "linear-gradient(to top, rgba(255,255,255,0.95), transparent)",
            }}
            aria-hidden
          />
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
