"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useSafePathname } from "@/lib/client/useSafePathname";
import { buildYandexMetrikaInlineScript } from "@/lib/analytics/yandex-metrika-snippet";
import {
  getSubsStoreYmId,
  isSubsStoreMetrikaPath,
} from "@/lib/analytics/subs-store-metrika";

declare global {
  interface Window {
    ym: (id: number, action: string, ...args: unknown[]) => void;
  }
}

const YM_ID = getSubsStoreYmId();
const SCRIPT_MARKER = "data-subs-store-metrika";

export function SubsStoreYandexMetrika() {
  const pathname = useSafePathname();
  const searchParams = useSearchParams();
  const siteQuery = searchParams.get("site");
  const active = isSubsStoreMetrikaPath(pathname, siteQuery);
  const injected = useRef(false);

  useEffect(() => {
    if (!YM_ID || !active) return;

    const sendHit = () => window.ym?.(YM_ID, "hit", pathname);

    if (!injected.current && !document.head.querySelector(`script[${SCRIPT_MARKER}]`)) {
      injected.current = true;
      const script = document.createElement("script");
      script.type = "text/javascript";
      script.setAttribute(SCRIPT_MARKER, "1");
      script.innerHTML = buildYandexMetrikaInlineScript(YM_ID);
      document.head.appendChild(script);
      return;
    }

    if (typeof window.ym === "function") sendHit();
  }, [active, pathname]);

  return null;
}
