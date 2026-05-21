"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, User } from "lucide-react";
import { SPOTIFY_ACCENT } from "@/lib/content/spotify";
import { useSpotifyLanding } from "@/components/spotify/SpotifyLandingProvider";

export function SpotifyNav() {
  const { nav, hero } = useSpotifyLanding();
  const [open, setOpen] = useState(false);

  const handleAnchorClick = (href: string) => {
    setOpen(false);
    if (!href.startsWith("#")) return;
    const el = typeof document !== "undefined" ? document.getElementById(href.slice(1)) : null;
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <header
      className="fixed left-0 right-0 top-0 z-50 border-b transition-colors duration-150"
      style={{
        background: "rgba(10,10,10,0.92)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderColor: "rgba(255,255,255,0.08)",
      }}
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 md:px-6">
        <Link
          href="/spotify"
          className="font-heading text-base font-bold"
          style={{ color: "#ffffff" }}
        >
          {nav.brand}{" "}
          <span style={{ color: SPOTIFY_ACCENT }}>{nav.brandAccent}</span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm md:flex" style={{ color: "rgba(255,255,255,0.6)" }}>
          {nav.links.map((link) =>
            link.href.startsWith("#") ? (
              <button
                key={link.href}
                type="button"
                onClick={() => handleAnchorClick(link.href)}
                className="transition-colors duration-100 hover:text-white"
              >
                {link.label}
              </button>
            ) : (
              <Link
                key={link.href}
                href={link.href}
                className="transition-colors duration-100 hover:text-white"
              >
                {link.label}
              </Link>
            )
          )}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/login?site=subs-store&returnUrl=%2Fdashboard%3Fsite%3Dsubs-store"
            className="hidden items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors duration-100 sm:flex"
            style={{
              borderColor: "rgba(255,255,255,0.15)",
              color: "rgba(255,255,255,0.7)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.08)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            <User size={14} />
            Кабинет
          </Link>
          <a
            href="#pricing"
            onClick={(e) => {
              e.preventDefault();
              handleAnchorClick("#pricing");
            }}
            className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-opacity duration-100 hover:opacity-90 sm:px-4 sm:py-2 sm:text-sm"
            style={{ background: SPOTIFY_ACCENT, boxShadow: "0 4px 16px rgba(29,185,84,0.3)" }}
          >
            {hero.primaryCta}
          </a>
          <button
            className="flex h-9 w-9 items-center justify-center rounded-lg transition-colors duration-100 md:hidden"
            style={{ color: "rgba(255,255,255,0.7)" }}
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Закрыть меню" : "Открыть меню"}
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t md:hidden"
            style={{ borderColor: "rgba(255,255,255,0.08)", background: "#0a0a0a" }}
          >
            <nav className="flex flex-col gap-1 px-4 pb-4 pt-2">
              {nav.links.map((link) =>
                link.href.startsWith("#") ? (
                  <button
                    key={link.href}
                    type="button"
                    onClick={() => handleAnchorClick(link.href)}
                    className="rounded-lg px-3 py-2.5 text-left text-sm transition-colors duration-100"
                    style={{ color: "rgba(255,255,255,0.6)" }}
                  >
                    {link.label}
                  </button>
                ) : (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="rounded-lg px-3 py-2.5 text-sm transition-colors duration-100"
                    style={{ color: "rgba(255,255,255,0.6)" }}
                  >
                    {link.label}
                  </Link>
                )
              )}
              <Link
                href="/login?site=subs-store&returnUrl=%2Fdashboard%3Fsite%3Dsubs-store"
                onClick={() => setOpen(false)}
                className="mt-1 rounded-lg border px-3 py-2.5 text-center text-sm"
                style={{
                  borderColor: "rgba(255,255,255,0.15)",
                  color: "rgba(255,255,255,0.7)",
                }}
              >
                Личный кабинет
              </Link>
              <a
                href="#pricing"
                onClick={(e) => {
                  e.preventDefault();
                  handleAnchorClick("#pricing");
                }}
                className="mt-1 rounded-lg px-3 py-2.5 text-center text-sm font-semibold text-white"
                style={{ background: SPOTIFY_ACCENT }}
              >
                {hero.primaryCta}
              </a>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
