"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export type UrlSiteSlug = "gpt-store" | "subs-store";

function readSiteFromUrl(defaultSlug: UrlSiteSlug): UrlSiteSlug {
  if (typeof window === "undefined") return defaultSlug;
  const raw = new URLSearchParams(window.location.search).get("site");
  if (raw === "subs-store") return "subs-store";
  if (raw === "gpt-store") return "gpt-store";
  return defaultSlug;
}

/** Читает ?site= из URL без useSearchParams (не требует Suspense). */
export function useUrlSiteSlug(defaultSlug: UrlSiteSlug = "gpt-store"): UrlSiteSlug {
  const pathname = usePathname();
  const [siteSlug, setSiteSlug] = useState<UrlSiteSlug>(defaultSlug);

  useEffect(() => {
    setSiteSlug(readSiteFromUrl(defaultSlug));
  }, [pathname, defaultSlug]);

  return siteSlug;
}
