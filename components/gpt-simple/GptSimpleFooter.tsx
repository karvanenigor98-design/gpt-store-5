"use client";

import Link from "next/link";
import { Headphones, Shield, Zap } from "lucide-react";

import { LandingAuthNavLink } from "@/components/landing/LandingAuthNavLink";

const TRUST = [
  { Icon: Shield, title: "Безопасные платежи", text: "Ваши данные под защитой." },
  { Icon: Zap, title: "Быстрое подключение", text: "Обычно 5–15 минут после оплаты." },
  { Icon: Headphones, title: "Поддержка 24/7", text: "Мы всегда на связи и поможем." },
] as const;

export function GptSimpleFooter() {
  return (
    <footer className="border-t border-black/[0.06] bg-white">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:grid-cols-3 md:px-6">
        {TRUST.map(({ Icon, title, text }) => (
          <div key={title} className="flex gap-3">
            <Icon className="mt-0.5 h-5 w-5 shrink-0 text-[#10a37f]" aria-hidden />
            <div>
              <p className="text-sm font-semibold text-gray-900">{title}</p>
              <p className="mt-0.5 text-sm text-gray-500">{text}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-black/[0.06] px-4 py-5 md:px-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 text-sm text-gray-500 sm:flex-row">
          <p>© {new Date().getFullYear()} GPT STORE</p>
          <nav className="flex flex-wrap items-center justify-center gap-5">
            <LandingAuthNavLink
              siteSlug="gpt-store"
              className="inline-flex items-center gap-1.5 hover:text-gray-800"
            />
            <Link href="/privacy" className="hover:text-gray-800">
              Конфиденциальность
            </Link>
            <Link href="/terms" className="hover:text-gray-800">
              Условия
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
