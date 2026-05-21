"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

type Payload = {
  plans?: unknown[];
  landingDiscounts?: unknown[];
  promoCodes?: unknown[];
};

function snapshot(payload: Payload): string {
  return JSON.stringify({
    plans: payload.plans ?? [],
    landingDiscounts: payload.landingDiscounts ?? [],
    promoCodes: payload.promoCodes ?? [],
  });
}

/** Подтягивает скидки/тарифы из админки на SSR-лендинг /spotify (как StoreConfigAutoRefresh на GPT). */
export function SpotifyStoreConfigAutoRefresh() {
  const router = useRouter();
  const lastRef = useRef("");
  const firstRef = useRef(true);

  useEffect(() => {
    let cancelled = false;

    async function sync() {
      try {
        const res = await fetch("/api/public/subs-store-config", {
          cache: "no-store",
          credentials: "same-origin",
        });
        if (!res.ok) return;
        const json = (await res.json()) as Payload;
        const next = snapshot(json);

        if (firstRef.current) {
          firstRef.current = false;
          lastRef.current = next;
          return;
        }

        if (!cancelled && next !== lastRef.current) {
          lastRef.current = next;
          router.refresh();
        }
      } catch {
        /* silent */
      }
    }

    void sync();
    const id = window.setInterval(() => void sync(), 5000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [router]);

  return null;
}
