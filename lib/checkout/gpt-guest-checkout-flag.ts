/**
 * GPT guest checkout (email → pay → session + access email).
 * Production is off unless GPT_GUEST_CHECKOUT / NEXT_PUBLIC_GPT_GUEST_CHECKOUT is 1.
 * Preview is on by default. Override: GPT_GUEST_CHECKOUT=0/1.
 */
export function isGptGuestCheckoutEnabled(): boolean {
  const v = (
    process.env.GPT_GUEST_CHECKOUT?.trim() ||
    process.env.NEXT_PUBLIC_GPT_GUEST_CHECKOUT?.trim() ||
    ""
  ).toLowerCase();
  if (v === "0" || v === "false") return false;
  if (v === "1" || v === "true") return true;
  if (process.env.VERCEL_ENV === "production") return false;
  return process.env.VERCEL_ENV === "preview";
}
