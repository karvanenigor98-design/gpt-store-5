import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Поддержка",
  description: "Чат поддержки — вопросы по подпискам GPT STORE и Subs Store",
};

export default function SupportLayout({ children }: { children: React.ReactNode }) {
  return children;
}
