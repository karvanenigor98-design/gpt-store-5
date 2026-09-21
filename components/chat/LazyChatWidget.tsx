"use client";

import dynamic from "next/dynamic";

function ChatFabFallback() {
  return (
    <div className="fixed z-50 bottom-3 right-3 pb-[env(safe-area-inset-bottom)] md:bottom-6 md:right-6">
      <div
        className="flex items-center gap-2 rounded-full px-4 py-3 text-sm font-medium text-white shadow-lg"
        style={{ backgroundColor: "#10a37f", boxShadow: "0 4px 14px rgba(16,163,127,0.25)" }}
        aria-hidden
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
        <span className="hidden md:inline">Чат поддержки</span>
      </div>
    </div>
  );
}

const ChatWidget = dynamic(
  () => import("@/components/sections/ChatWidget").then((m) => m.ChatWidget),
  { ssr: false, loading: () => <ChatFabFallback /> },
);

export function LazyChatWidget({
  siteSlug = "gpt-store",
}: {
  siteSlug?: "gpt-store" | "subs-store";
}) {
  return <ChatWidget siteSlug={siteSlug} />;
}
