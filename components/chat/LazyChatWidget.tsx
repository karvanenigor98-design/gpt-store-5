"use client";

import dynamic from "next/dynamic";

const ChatWidget = dynamic(
  () => import("@/components/sections/ChatWidget").then((m) => m.ChatWidget),
  { ssr: false, loading: () => null },
);

export function LazyChatWidget({
  siteSlug = "gpt-store",
}: {
  siteSlug?: "gpt-store" | "subs-store";
}) {
  return <ChatWidget siteSlug={siteSlug} />;
}
