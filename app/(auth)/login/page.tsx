import type { Metadata } from "next";
import { headers } from "next/headers";

import { resolveAuthSiteContext, resolvePortFromHeaders } from "@/lib/auth/devStoreProfile";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Вход" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { returnUrl?: string; site?: string; error?: string; reset?: string; verified?: string };
}) {
  const returnUrl = searchParams.returnUrl ?? "";
  const siteDirect = searchParams.site ?? "";
  const h = await headers();
  const devProfile = h.get("x-dev-store-profile");
  const authSite =
    devProfile === "gpt-store" || devProfile === "subs-store"
      ? devProfile
      : resolveAuthSiteContext({
          siteDirect,
          returnUrl,
          port: resolvePortFromHeaders(h),
          pathname: "/login",
        });
  const isSubsStore = authSite === "subs-store";

  if (isSubsStore) {
    return (
      <div className="w-full max-w-sm">
        <h1 className="font-heading mb-8 text-2xl font-bold text-white">
          Войти в{" "}
          <span style={{ color: "#1DB954" }}>Subs Store</span>
        </h1>
        <LoginForm />
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm">
      <h1 className="font-heading text-2xl font-bold text-gray-900 mb-2">Вход в кабинет</h1>
      <p className="text-sm text-gray-500 mb-8">
        Нет аккаунта?{" "}
        <a href="/register" className="text-[#10a37f] hover:underline">
          Зарегистрироваться
        </a>
      </p>
      <LoginForm />
    </div>
  );
}
