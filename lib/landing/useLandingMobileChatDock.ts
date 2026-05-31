"use client";

import { useEffect, useState } from "react";
import {
  LANDING_MOBILE_CHAT_SLOT_ID,
  LANDING_STICKY_VISIBLE_EVENT,
  type LandingStickyVisibleDetail,
} from "@/lib/landing/landing-mobile-dock";

export function useLandingMobileChatDock(enabled: boolean) {
  const [stickyVisible, setStickyVisible] = useState(false);
  const [chatSlot, setChatSlot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!enabled) {
      setStickyVisible(false);
      setChatSlot(null);
      return;
    }

    const onSticky = (event: Event) => {
      const detail = (event as CustomEvent<LandingStickyVisibleDetail>).detail;
      setStickyVisible(Boolean(detail?.visible));
    };

    window.addEventListener(LANDING_STICKY_VISIBLE_EVENT, onSticky as EventListener);
    return () => {
      window.removeEventListener(LANDING_STICKY_VISIBLE_EVENT, onSticky as EventListener);
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !stickyVisible) {
      setChatSlot(null);
      return;
    }

    const mq = window.matchMedia("(max-width: 767px)");
    const syncSlot = () => {
      if (!mq.matches) {
        setChatSlot(null);
        return;
      }
      setChatSlot(document.getElementById(LANDING_MOBILE_CHAT_SLOT_ID));
    };

    syncSlot();
    const raf = requestAnimationFrame(syncSlot);
    mq.addEventListener("change", syncSlot);

    return () => {
      cancelAnimationFrame(raf);
      mq.removeEventListener("change", syncSlot);
    };
  }, [enabled, stickyVisible]);

  const docked = enabled && stickyVisible && chatSlot !== null;

  return { docked, chatSlot, stickyVisible };
}
