import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function resolveManifestSite(req: NextRequest): "gpt-store" | "subs-store" {
  const explicit = req.nextUrl.searchParams.get("site");
  if (explicit === "subs-store") return "subs-store";
  if (explicit === "gpt-store") return "gpt-store";

  const host = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "").toLowerCase();
  if (host.includes("spotify-store.ru")) return "subs-store";

  const pathname = req.headers.get("x-invoke-pathname") ?? "";
  if (pathname.startsWith("/spotify") || pathname.startsWith("/checkout/spotify")) {
    return "subs-store";
  }

  const search = req.headers.get("x-invoke-search") ?? "";
  const sp = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  if (sp.get("site") === "subs-store") return "subs-store";

  return "gpt-store";
}

export async function GET(req: NextRequest) {
  const site = resolveManifestSite(req);
  const isSpotify = site === "subs-store";
  const iconBase = isSpotify ? "/icons/spotify" : "/icons/gpt";

  const payload = isSpotify
    ? {
        name: "SPOTIFY STORE",
        short_name: "SPOTIFY STORE",
        description: "Spotify Premium: подключение подписки и безопасная оплата.",
        start_url: "/spotify",
        display: "standalone",
        background_color: "#080808",
        theme_color: "#1DB954",
        icons: [
          { src: `${iconBase}/icon-192.png`, sizes: "192x192", type: "image/png" },
          { src: `${iconBase}/icon-512.png`, sizes: "512x512", type: "image/png" },
          { src: `${iconBase}/apple-touch-icon.png`, sizes: "180x180", type: "image/png" },
        ],
      }
    : {
        name: "GPT STORE",
        short_name: "GPT STORE",
        description: "Подписка ChatGPT Plus/Pro в России, безопасная оплата и подключение.",
        start_url: "/",
        display: "standalone",
        background_color: "#000000",
        theme_color: "#10a37f",
        icons: [
          { src: `${iconBase}/icon-192.png`, sizes: "192x192", type: "image/png" },
          { src: `${iconBase}/icon-512.png`, sizes: "512x512", type: "image/png" },
          { src: `${iconBase}/apple-touch-icon.png`, sizes: "180x180", type: "image/png" },
        ],
      };

  return NextResponse.json(payload, {
    headers: {
      "Content-Type": "application/manifest+json",
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}
