"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Props = {
  siteSlug: "gpt-store" | "subs-store";
  orderId: string;
  userId?: string | null;
  email?: string | null;
};

export function StaffOrderChatLink({ siteSlug, orderId, userId, email }: Props) {
  const pathname = usePathname();
  const staffRoot = pathname?.startsWith("/operator") ? "/operator" : "/admin";
  const clientEmail = email?.trim();
  const hasClient = Boolean(userId?.trim()) || Boolean(clientEmail && clientEmail !== "—");

  if (!hasClient) {
    return <span className="text-gray-400">—</span>;
  }

  const params = new URLSearchParams({ site: siteSlug, order_id: orderId });
  if (userId?.trim()) params.set("client_id", userId.trim());
  if (clientEmail && clientEmail !== "—") params.set("client_email", clientEmail);

  const href = `${staffRoot}/chat?${params.toString()}`;
  const isSubs = siteSlug === "subs-store";

  return (
    <Link
      href={href}
      className={
        isSubs
          ? "inline-flex items-center rounded-md border border-[#1DB954]/30 px-2 py-1 text-xs font-medium text-[#0d8f4a] hover:bg-[#1DB954]/10"
          : "inline-flex items-center rounded-md border border-[#10a37f]/30 px-2 py-1 text-xs font-medium text-[#0f7d62] hover:bg-[#10a37f]/10"
      }
    >
      Чат
    </Link>
  );
}
