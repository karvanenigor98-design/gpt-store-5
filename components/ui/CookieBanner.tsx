"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

const STORAGE_KEY = "cookie_consent";

export function CookieBanner() {
  const [show, setShow] = useState(false);

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
          className="fixed bottom-4 left-4 right-4 z-[100] mx-auto max-w-lg rounded-2xl border border-black/[0.08] bg-white p-4 shadow-lg md:left-auto md:right-6 md:max-w-sm"
        >
          <div className="flex items-start justify-between gap-3">
            <p className="text-xs text-gray-600 leading-relaxed">
              Мы бережно относимся к вашим данным. Используем только необходимые технические данные
              и обезличенную аналитику для стабильной работы сервиса. Подробнее — в{" "}
              <a href="/privacy" className="text-[#10a37f] hover:underline">политике конфиденциальности</a>.
            </p>
            <button
              type="button"
              onClick={decline}
              className="shrink-0 text-gray-400 hover:text-gray-600"
              aria-label="Закрыть"
            >
              <X size={14} />
            </button>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={accept}
              className="flex-1 rounded-lg bg-[#10a37f] py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90"
            >
              Принять
            </button>
            <button
              type="button"
              onClick={decline}
              className="flex-1 rounded-lg border border-black/[0.1] py-2 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-50"
            >
              Отклонить
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
