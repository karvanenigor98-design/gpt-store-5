import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Поддержка",
  description: "Чат поддержки — вопросы по подпискам GPT STORE и Spotify Store",
};

export default function SupportLayout({ children }: { children: React.ReactNode }) {
  return children;
}
