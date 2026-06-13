"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

type StoreConfigPayload = {
  plans?: unknown[];
  landingSections?: Record<string, unknown>;
  landingDiscounts?: unknown[];
};

function normalizeSnapshot(payload: StoreConfigPayload): string {
  return JSON.stringify({
    plans: payload.plans ?? [],
    landingSections: payload.landingSections ?? {},
    landingDiscounts: payload.landingDiscounts ?? [],
  });
}

export function StoreConfigAutoRefresh() {
  const router = useRouter();
  const lastSnapshotRef = useRef<string>("");
  const firstRunRef = useRef(true);

  useEffect(() => {
    let cancelled = false;

    async function syncConfig() {
      try {
        const res = await fetch("/api/public/store-config", {
          cache: "no-store",
          credentials: "same-origin",
        });
        if (!res.ok) return;
        const json = (await res.json()) as StoreConfigPayload;
        const snapshot = normalizeSnapshot(json);

        if (firstRunRef.current) {
          firstRunRef.current = false;
          lastSnapshotRef.current = snapshot;
          return;
        }

        if (!cancelled && snapshot !== lastSnapshotRef.current) {
          lastSnapshotRef.current = snapshot;
          router.refresh();
        }
      } catch {
        // silent fallback
      }
    }

    void syncConfig();
    const id = window.setInterval(() => {
      void syncConfig();
    }, 60_000);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [router]);

  return null;
}
