"use client";

import Link from "next/link";
import { Headphones } from "lucide-react";

import { LandingAuthNavLink } from "@/components/landing/LandingAuthNavLink";
import { openGptSupportChat } from "@/lib/chat/open-support-chat";

export function GptSimpleNav() {
  return (
    <header className="fixed left-0 right-0 top-0 z-50 border-b border-black/[0.06] bg-white/95 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[72rem] items-center justify-between gap-3 px-4 md:px-8">
        <Link href="/" className="shrink-0 font-heading text-lg font-semibold tracking-tight text-gray-900">
          GPT <span className="text-[#10a37f]">STORE</span>
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          <LandingAuthNavLink
            siteSlug="gpt-store"
            className="inline-flex items-center gap-1.5 px-2 py-1.5 text-sm text-gray-500 transition-colors hover:text-gray-900"
          />
          <button
            type="button"
            onClick={() => openGptSupportChat()}
            className="inline-flex items-center gap-2 rounded-xl border border-black/[0.1] px-3.5 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            <Headphones size={18} className="text-[#10a37f]" aria-hidden />
            Поддержка
          </button>
        </div>
      </div>
    </header>
  );
}
