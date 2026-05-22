"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { SPOTIFY_ACCENT, SPOTIFY_BORDER } from "@/lib/content/spotify";

const STORAGE_KEY = "cookie_consent";

function useSubsStoreCookieTheme(): boolean {
  const pathname = usePathname() ?? "";
  const profile = process.env.NEXT_PUBLIC_STORE_PROFILE?.trim();
  if (profile === "subs-store") return true;
  return (
    pathname.startsWith("/spotify") ||
    pathname.startsWith("/checkout/spotify")
  );
}

export function CookieBanner() {
  const [show, setShow] = useState(false);
  const isSubs = useSubsStoreCookieTheme();

  useEffect(() => {
    const consent = localStorage.getItem(STORAGE_KEY);
    if (!consent) setShow(true);
  }, []);

  function accept() {
    localStorage.setItem(STORAGE_KEY, "accepted");
    setShow(false);
    // Инициализируем Метрику если она ещё не запущена
    if (typeof window !== "undefined" && window.ym && process.env.NEXT_PUBLIC_YM_ID) {
      window.ym(Number(process.env.NEXT_PUBLIC_YM_ID), "init", {
        clickmap: true,
        trackLinks: true,
        accurateTrackBounce: true,
        webvisor: true,
      });
    }
  }

  function decline() {
    localStorage.setItem(STORAGE_KEY, "declined");
    setShow(false);
  }

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.3 }}
          className={cn(
            "fixed bottom-4 left-4 right-4 z-[100] mx-auto max-w-lg rounded-2xl p-4 md:left-auto md:right-6 md:max-w-sm",
            isSubs
              ? "border bg-[#141414]/95 shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(29,185,84,0.08)] backdrop-blur-md"
              : "border border-black/[0.08] bg-white shadow-lg"
          )}
          style={isSubs ? { borderColor: SPOTIFY_BORDER } : undefined}
        >
          <div className="flex items-start justify-between gap-3">
            <p
              className={cn(
                "text-xs leading-relaxed",
                isSubs ? "text-white/70" : "text-gray-600"
              )}
            >
              Мы бережно относимся к вашим данным. Используем только необходимые технические данные
              и обезличенную аналитику для стабильной работы сервиса. Подробнее — в{" "}
              <a
                href="/privacy"
                className={cn(
                  "hover:underline",
                  isSubs ? "font-medium text-[#1DB954]" : "text-[#10a37f]"
                )}
                style={isSubs ? { color: SPOTIFY_ACCENT } : undefined}
              >
                политике конфиденциальности
              </a>
              .
            </p>
            <button
              type="button"
              onClick={decline}
              className={cn(
                "shrink-0 transition-colors",
                isSubs
                  ? "text-white/40 hover:text-white/80"
                  : "text-gray-400 hover:text-gray-600"
              )}
              aria-label="Закрыть"
            >
              <X size={14} />
            </button>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={accept}
              className={cn(
                "flex-1 rounded-lg py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90",
                !isSubs && "bg-[#10a37f]"
              )}
              style={isSubs ? { backgroundColor: SPOTIFY_ACCENT } : undefined}
            >
              Принять
            </button>
            <button
              type="button"
              onClick={decline}
              className={cn(
                "flex-1 rounded-lg py-2 text-xs font-semibold transition-colors",
                isSubs
                  ? "border text-white/70 hover:bg-white/[0.06]"
                  : "border border-black/[0.1] text-gray-600 hover:bg-gray-50"
              )}
              style={isSubs ? { borderColor: SPOTIFY_BORDER } : undefined}
            >
              Отклонить
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
