"use client";

const ACCENT = "#1DB954";

/** Лого в checkout — полный переход на лендинг /spotify (не client-side внутри overlay). */
export function SubsCheckoutBrandLink() {
  return (
    <a
      href="/spotify"
      className="relative z-30 font-heading text-base font-bold text-white transition-opacity hover:opacity-90"
      aria-label="На главную SPOTIFY STORE"
    >
      SPOTIFY <span style={{ color: ACCENT }}>STORE</span>
    </a>
  );
}
