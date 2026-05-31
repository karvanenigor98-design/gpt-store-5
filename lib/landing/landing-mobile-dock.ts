export const LANDING_MOBILE_CHAT_SLOT_ID = "landing-mobile-chat-slot";

export const LANDING_STICKY_VISIBLE_EVENT = "landing-sticky-visible";

export type LandingStickyVisibleDetail = {
  visible: boolean;
};

export function dispatchLandingStickyVisible(visible: boolean): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<LandingStickyVisibleDetail>(LANDING_STICKY_VISIBLE_EVENT, {
      detail: { visible },
    }),
  );
}
