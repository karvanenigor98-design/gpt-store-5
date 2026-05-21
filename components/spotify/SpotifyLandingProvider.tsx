"use client";

import { createContext, useContext, type ReactNode } from "react";

import type { SpotifyLandingPayload } from "@/lib/landing/spotify-landing-types";
import { getStaticSpotifyLandingPayload } from "@/lib/landing/spotify-landing-static-payload";

const defaultPayload = getStaticSpotifyLandingPayload();

const SpotifyLandingContext = createContext<SpotifyLandingPayload>(defaultPayload);

export function SpotifyLandingProvider({
  children,
  payload,
}: {
  children: ReactNode;
  payload: SpotifyLandingPayload;
}) {
  return <SpotifyLandingContext.Provider value={payload}>{children}</SpotifyLandingContext.Provider>;
}

export function useSpotifyLanding(): SpotifyLandingPayload {
  return useContext(SpotifyLandingContext);
}
