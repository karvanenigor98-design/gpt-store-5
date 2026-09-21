"use client";

import { Headphones } from "lucide-react";

import { LandingAuthNavLink } from "@/components/landing/LandingAuthNavLink";
import { openGptSupportChat } from "@/lib/chat/open-support-chat";

const NAV_LINKS = [
  { href: "#plans", label: "Тарифы" },
  { href: "#how-it-works", label: "Как это работает" },
  { href: "#faq", label: "FAQ" },
] as const;

export function GptSimpleNav({ initialLoggedIn = false }: { initialLoggedIn?: boolean }) {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-black/[0.06] bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[72rem] items-center justify-between gap-3 px-4 md:px-6">
        <a href="#hero" className="font-heading shrink-0 text-base font-semibold tracking-tight text-gray-900">
          GPT STORE
        </a>
        <nav className="hidden items-center gap-6 text-sm text-gray-500 md:flex">
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href} className="transition-colors hover:text-gray-900">
              {link.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <LandingAuthNavLink
            siteSlug="gpt-store"
            initialLoggedIn={initialLoggedIn}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
          />
          <button
            type="button"
            onClick={() => openGptSupportChat()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#10a37f] px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-[#0d8a6a]"
          >
            <Headphones size={16} aria-hidden />
            <span className="hidden sm:inline">Поддержка</span>
          </button>
        </div>
      </div>
    </header>
  );
}
