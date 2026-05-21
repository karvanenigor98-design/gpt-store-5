"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { readBrowserCookie } from "@/lib/auth/readBrowserCookie";

const SPOTIFY_GREEN = "#1DB954";

function AuthLayoutInner({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get("returnUrl") ?? "";
  const siteDirect = searchParams.get("site") ?? "";
  const cookieSite = readBrowserCookie("auth_reset_site") || readBrowserCookie("current_site");

  const onGptDevPort =
    typeof window !== "undefined" && window.location.port === "3056";

  const isSubsStore =
    !onGptDevPort &&
    (siteDirect === "subs-store" ||
      cookieSite === "subs-store" ||
      returnUrl.includes("site=subs-store") ||
      returnUrl.includes("/spotify"));

  if (isSubsStore) {
    return (
      <div className="flex min-h-screen flex-col" style={{ background: "#080808" }}>
        <header
          className="flex h-14 items-center border-b px-6"
          style={{
            borderColor: "rgba(255,255,255,0.08)",
            background: "rgba(10,10,10,0.95)",
          }}
        >
          <span className="font-heading text-sm font-semibold text-white select-none">
            Subs <span style={{ color: SPOTIFY_GREEN }}>Store</span>
          </span>
        </header>

        <main className="flex flex-1 items-center justify-center px-4 py-12">
          <div
            className="w-full max-w-md rounded-2xl border p-5 sm:p-6"
            style={{
              background: "#111111",
              borderColor: "rgba(255,255,255,0.1)",
              boxShadow: "0 16px 48px rgba(0,0,0,0.6)",
            }}
          >
            {children}
          </div>
        </main>

        <footer className="py-4 text-center text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
          © {new Date().getFullYear()} Subs Store
        </footer>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-transparent">
      <header className="flex h-14 items-center border-b border-black/[0.08] bg-white/75 px-6 backdrop-blur-md">
        <Link
          href="/"
          className="font-heading text-sm font-semibold text-gray-900 transition-colors hover:text-[#10a37f]"
        >
          GPT STORE
        </Link>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-2xl border border-black/[0.07] bg-white/78 p-5 shadow-[0_12px_36px_rgba(15,23,42,0.08)] backdrop-blur-sm sm:p-6">
          {children}
        </div>
      </main>

      <footer className="py-4 text-center text-xs text-gray-500">
        © {new Date().getFullYear()} GPT STORE
      </footer>
    </div>
  );
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <AuthLayoutInner>{children}</AuthLayoutInner>
    </Suspense>
  );
}
