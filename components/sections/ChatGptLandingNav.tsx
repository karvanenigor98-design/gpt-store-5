"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, User } from "lucide-react";
import { LandingOrderStatusChip } from "@/components/landing/LandingOrderStatusChip";

const NAV_LINKS = [
  { href: "#how-it-works", label: "Как работает" },
  { href: "#pricing", label: "Тарифы" },
  { href: "#reviews", label: "Отзывы" },
  { href: "#faq", label: "FAQ" },
];

export function ChatGptLandingNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const handleAnchorClick = (href: string) => {
    setOpen(false);

    if (!href.startsWith("#")) {
      router.push(href);
      return;
    }

    const targetId = href.slice(1);
    const target = typeof document !== "undefined" ? document.getElementById(targetId) : null;

    if (pathname !== "/") {
      router.push(`/${href}`);
      return;
    }

    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    router.push("/#pricing");
  };

  return (
    <header className="fixed left-0 right-0 top-0 z-50 border-b border-black/[0.06] bg-white/90 backdrop-blur-xl transition-colors duration-150">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 md:px-6">
        <Link href="/" className="font-heading text-base font-semibold text-gray-900">
          GPT <span style={{ color: "#10a37f" }}>STORE</span>
        </Link>

        {/* Desktop links */}
        <nav className="hidden items-center gap-6 text-sm text-gray-500 md:flex">
          {NAV_LINKS.map((link) => (
            <button
              key={link.href}
              type="button"
              onClick={() => handleAnchorClick(link.href)}
              className="transition-colors duration-100 hover:text-gray-900"
            >
              {link.label}
            </button>
          ))}
        </nav>

        {/* CTA + auth */}
        <div className="flex items-center gap-2">
          <div className="hidden sm:block">
            <LandingOrderStatusChip siteSlug="gpt-store" />
          </div>
          <Link
            href="/cabinet?site=gpt-store"
            className="hidden items-center gap-1.5 rounded-lg border border-black/[0.1] px-3 py-1.5 text-sm text-gray-600 transition-colors duration-100 hover:bg-gray-50 sm:flex"
          >
            <User size={14} />
            Кабинет
          </Link>
          <button
            type="button"
            onClick={() => handleAnchorClick("#pricing")}
            className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-opacity duration-100 hover:opacity-90 sm:px-4 sm:py-2 sm:text-sm"
            style={{ background: "#10a37f" }}
          >
            Подключить
          </button>
          <button
            className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition-colors duration-100 hover:bg-gray-100 md:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Закрыть меню" : "Открыть меню"}
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-black/[0.06] md:hidden"
          >
            <nav className="flex flex-col gap-1 bg-white px-4 pb-4 pt-2">
              {NAV_LINKS.map((link) => (
                <button
                  key={link.href}
                  type="button"
                  onClick={() => handleAnchorClick(link.href)}
                  className="rounded-lg px-3 py-2.5 text-sm text-gray-600 transition-colors duration-100 hover:bg-gray-50 hover:text-gray-900"
                >
                  {link.label}
                </button>
              ))}
              <Link
                href="/cabinet?site=gpt-store"
                onClick={() => setOpen(false)}
                className="mt-1 rounded-lg border border-black/[0.1] px-3 py-2.5 text-center text-sm text-gray-600"
              >
                Личный кабинет
              </Link>
              <div className="mt-1">
                <LandingOrderStatusChip siteSlug="gpt-store" />
              </div>
              <button
                type="button"
                onClick={() => handleAnchorClick("#pricing")}
                className="mt-1 rounded-lg px-3 py-2.5 text-center text-sm font-semibold text-white"
                style={{ background: "#10a37f" }}
              >
                Подключить
              </button>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
