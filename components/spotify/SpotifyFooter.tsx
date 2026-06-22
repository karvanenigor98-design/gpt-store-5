"use client";

import Link from "next/link";
import { SPOTIFY_ACCENT } from "@/lib/content/spotify";
import { useSpotifyLanding } from "@/components/spotify/SpotifyLandingProvider";
import { SpotifyStoreLogo } from "@/components/spotify/SpotifyStoreLogo";

export function SpotifyFooter() {
  const { footer: f } = useSpotifyLanding();
  return (
    <footer
      className="border-t px-6 py-10"
      style={{
        background: "#090909",
        borderColor: "rgba(255,255,255,0.07)",
      }}
    >
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col gap-6 md:flex-row md:justify-between">
          <div className="max-w-xs">
            <SpotifyStoreLogo height={44} />
            <p className="mt-2 text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
              {f.tagline}
            </p>
            <a
              href={f.telegramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 text-sm transition-colors"
              style={{ color: SPOTIFY_ACCENT }}
            >
              {f.telegramLabel}
            </a>
          </div>

          <nav className="flex flex-wrap gap-x-6 gap-y-3">
            {f.links.map((link) =>
              link.href.startsWith("#") ? (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-sm transition-colors"
                  style={{ color: "rgba(255,255,255,0.4)" }}
                  onMouseEnter={(e) => {
                    (e.target as HTMLElement).style.color = "rgba(255,255,255,0.8)";
                  }}
                  onMouseLeave={(e) => {
                    (e.target as HTMLElement).style.color = "rgba(255,255,255,0.4)";
                  }}
                >
                  {link.label}
                </a>
              ) : (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm transition-colors"
                  style={{ color: "rgba(255,255,255,0.4)" }}
                >
                  {link.label}
                </Link>
              )
            )}
          </nav>
        </div>

        <div
          className="flex flex-col items-start justify-between gap-3 border-t pt-6 text-sm sm:flex-row sm:items-center"
          style={{ borderColor: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.3)" }}
        >
          <p>© {new Date().getFullYear()} {f.copyrightLine}</p>
          {f.crossLinkHref?.trim() && f.crossLinkLabel?.trim() ? (
            <Link
              href={f.crossLinkHref}
              className="transition-colors"
              style={{ color: "rgba(255,255,255,0.3)" }}
              onMouseEnter={(e) => {
                (e.target as HTMLElement).style.color = "rgba(255,255,255,0.6)";
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLElement).style.color = "rgba(255,255,255,0.3)";
              }}
            >
              {f.crossLinkLabel}
            </Link>
          ) : null}
        </div>
      </div>
    </footer>
  );
}
