import { ShieldCheck } from "lucide-react";

import { SubsCheckoutBrandLink } from "@/components/spotify/SubsCheckoutBrandLink";

const ACCENT = "#1DB954";

export default function SpotifyCheckoutLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-[200] flex min-h-[100dvh] w-full flex-col overflow-y-auto"
      style={{ background: "#0a0a0a", color: "#ffffff" }}
    >
      <div className="pointer-events-none fixed inset-0 z-0">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 80% 55% at 50% 0%, rgba(29,185,84,0.12) 0%, transparent 65%), radial-gradient(ellipse 45% 35% at 90% 90%, rgba(29,185,84,0.05) 0%, transparent 55%)",
          }}
        />
      </div>

      <header
        className="relative z-20 flex h-14 w-full shrink-0 items-center justify-between border-b px-4 md:px-8 lg:px-12"
        style={{
          background: "rgba(10,10,10,0.95)",
          borderColor: "rgba(255,255,255,0.08)",
          backdropFilter: "blur(12px)",
        }}
      >
        <SubsCheckoutBrandLink />
        <div className="flex items-center gap-1.5 text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
          <ShieldCheck size={14} style={{ color: ACCENT }} />
          Безопасная оплата
        </div>
      </header>

      <main className="relative z-10 flex w-full flex-1 flex-col px-4 py-8 md:px-8 md:py-10 lg:px-12 lg:py-12">
        <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col">{children}</div>
      </main>
    </div>
  );
}
