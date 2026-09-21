"use client";

import { Headphones, Search } from "lucide-react";

import { LandingAuthNavLink } from "@/components/landing/LandingAuthNavLink";
import { openGptSupportChat } from "@/lib/chat/open-support-chat";

export function GptSimpleNav({ initialLoggedIn = false }: { initialLoggedIn?: boolean }) {
  return (
    <header className="fixed inset-x-0 top-0 z-50 bg-[#e9f8f2]/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 md:px-6">
        <a href="#hero" className="font-heading shrink-0 text-[15px] font-semibold tracking-tight text-gray-900 md:text-base">
          GPT <span className="text-[#10a37f]">STORE</span>
        </a>
        <div className="flex items-center gap-2">
          <LandingAuthNavLink
            siteSlug="gpt-store"
            initialLoggedIn={initialLoggedIn}
            icon={Search}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-gray-500 transition-colors hover:bg-white/70 hover:text-gray-800"
          />
          <button
            type="button"
            onClick={() => openGptSupportChat()}
            className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.08] bg-white px-3 py-1.5 text-sm font-medium text-gray-600 shadow-sm transition-colors hover:bg-gray-50"
          >
            <Headphones size={16} className="text-[#10a37f]" aria-hidden />
            <span className="hidden sm:inline">Поддержка</span>
          </button>
        </div>
      </div>
    </header>
  );
}
