"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useSafePathname } from "@/lib/client/useSafePathname";
import {
  getGptStoreYmId,
  isGptStoreMetrikaPath,
} from "@/lib/analytics/gpt-store-metrika";

declare global {
  interface Window {
    ym: (id: number, action: string, ...args: unknown[]) => void;
  }
}

const YM_ID = getGptStoreYmId();

export function YandexMetrika() {
  const pathname = useSafePathname();
  const searchParams = useSearchParams();
  const siteQuery = searchParams.get("site");
  const active = isGptStoreMetrikaPath(pathname, siteQuery);
  const scriptLoaded = useRef(false);
  const inited = useRef(false);

  useEffect(() => {
    if (!YM_ID || !active) return;

    const sendHit = () => window.ym?.(YM_ID, "hit", pathname);

    if (!scriptLoaded.current) {
      scriptLoaded.current = true;
      const script = document.createElement("script");
      script.src = "https://mc.yandex.ru/metrika/tag.js";
      script.async = true;
      document.head.appendChild(script);
      script.onload = () => {
        if (inited.current) return;
        inited.current = true;
        window.ym?.(YM_ID, "init", {
          clickmap: true,
          trackLinks: true,
          accurateTrackBounce: true,
          webvisor: true,
        });
        sendHit();
      };
      return;
    }

    if (inited.current) sendHit();
  }, [active, pathname]);

  if (!YM_ID || !active) return null;

  return (
    <noscript>
      <img
        src={`https://mc.yandex.ru/watch/${YM_ID}`}
        style={{ position: "absolute", left: "-9999px" }}
        alt=""
      />
    </noscript>
  );
}
