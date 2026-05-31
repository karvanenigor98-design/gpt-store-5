"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ChatGptMarkIcon } from "@/components/icons/ChatGptMarkIcon";
import { useSpotifyLanding } from "@/components/spotify/SpotifyLandingProvider";

export function SpotifyGptCrossSell() {
  const { projectsSection: s } = useSpotifyLanding();
  if (s.showOnLanding === false || !s.ctaHref?.trim()) {
    return null;
  }

  return (
    <div
      className="mx-auto mt-8 flex w-full max-w-3xl flex-col items-start justify-between gap-5 rounded-2xl p-5 text-left sm:flex-row sm:items-center sm:p-6"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div className="flex items-center gap-4">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl"
          style={{ background: "rgba(116,170,156,0.12)", border: "1px solid rgba(116,170,156,0.25)" }}
        >
          <ChatGptMarkIcon size={32} className="rounded-md" />
        </div>
        <div>
          <p
            className="text-xs font-semibold uppercase tracking-wide"
            style={{ color: "rgba(255,255,255,0.4)" }}
          >
            {s.eyebrow ?? "Наши проекты"}
          </p>
          <h3 className="font-heading text-lg font-bold text-white">{s.title}</h3>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
            {s.description}
          </p>
        </div>
      </div>
      <Link
        href={s.ctaHref}
        className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 sm:w-auto"
        style={{ background: "#10a37f" }}
      >
        {s.ctaLabel}
        <ArrowRight size={15} />
      </Link>
    </div>
  );
}
