import type { Metadata } from "next";
import { ChatGptLandingNav } from "@/components/sections/ChatGptLandingNav";
import { LazyChatWidget } from "@/components/chat/LazyChatWidget";
import { FaqSection } from "@/components/sections/FaqSection";
import { LandingFooter } from "@/components/layout/LandingFooter";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "FAQ — частые вопросы",
  description:
    "Ответы на частые вопросы о подключении ChatGPT 5.5 и ChatGPT 5.5 Pro: оплата, активация, безопасность, гарантия.",
};

export default function FaqPage() {
  return (
    <div className="relative text-gray-900">
      <div className="relative z-10">
        <ChatGptLandingNav />
        <main className="pt-14">
          <FaqSection />
        </main>
        <LandingFooter />
        <LazyChatWidget />
      </div>
    </div>
  );
}
