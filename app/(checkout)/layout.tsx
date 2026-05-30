import Link from "next/link";
import { ShieldCheck } from "lucide-react";

export default function CheckoutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-transparent">
      <header className="flex h-14 items-center justify-between border-b border-black/[0.06] bg-white/75 px-6 backdrop-blur-md">
        <Link href="/" className="font-heading text-sm font-semibold text-gray-900 hover:text-[#10a37f] transition-colors">
          GPT STORE
        </Link>
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <ShieldCheck size={14} className="text-[#10a37f]" />
          Безопасная оплата
        </div>
      </header>
      <main className="flex flex-1 flex-col items-center px-4 py-10">
        {children}
      </main>
    </div>
  );
}
