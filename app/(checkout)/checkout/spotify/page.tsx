import type { Metadata } from "next";
import { Suspense } from "react";
import { CheckoutVisitMetrika } from "@/components/analytics/CheckoutVisitMetrika";
import { SpotifyCheckoutFlow } from "./SpotifyCheckoutFlow";

export const metadata: Metadata = { title: "Оформление Spotify Premium" };

export default function SpotifyCheckoutPage() {
  return (
    <>
      <Suspense fallback={null}>
        <CheckoutVisitMetrika store="spotify" />
      </Suspense>
      <Suspense
        fallback={
          <div
            className="h-64 w-full animate-pulse rounded-2xl"
            style={{ background: "rgba(255,255,255,0.06)" }}
          />
        }
      >
        <SpotifyCheckoutFlow />
      </Suspense>
    </>
  );
}
