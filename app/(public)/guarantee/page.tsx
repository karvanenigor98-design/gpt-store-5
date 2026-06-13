import type { Metadata } from "next";
import { ChatGptLandingNav } from "@/components/sections/ChatGptLandingNav";
import { LazyChatWidget } from "@/components/chat/LazyChatWidget";
import { GuaranteeSection } from "@/components/sections/GuaranteeSection";
import { LandingFooter } from "@/components/layout/LandingFooter";

export const metadata: Metadata = {
  title: "Гарантия",
  description:
    "Гарантия на весь срок подписки ChatGPT 5.5 и ChatGPT 5.5 Pro: возврат и переактивация при проблемах.",
};

export default function GuaranteePage() {
  return (
    <div className="relative text-gray-900">
      <div className="relative z-10">
        <ChatGptLandingNav />
        <main className="pt-14">
          <GuaranteeSection />
        </main>
        <LandingFooter />
        <LazyChatWidget />
      </div>
    </div>
  );
}
