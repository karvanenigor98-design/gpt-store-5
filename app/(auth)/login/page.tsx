import type { Metadata } from "next";

import { resolveAuthSiteContext } from "@/lib/auth/devStoreProfile";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Вход" };

export default function LoginPage({
  searchParams,
}: {
  searchParams: { returnUrl?: string; site?: string; error?: string; reset?: string; verified?: string };
}) {
  const returnUrl = searchParams.returnUrl ?? "";
  const siteDirect = searchParams.site ?? "";
  const authSite = resolveAuthSiteContext({
    siteDirect,
    returnUrl,
    port: null,
    pathname: "/login",
  });
  const isSubsStore = authSite === "subs-store";
  const registerHref =
    isSubsStore
      ? `/register?site=subs-store${returnUrl ? `&returnUrl=${encodeURIComponent(returnUrl)}` : ""}`
      : `/register?site=gpt-store${returnUrl ? `&returnUrl=${encodeURIComponent(returnUrl)}` : ""}`;

  if (isSubsStore) {
    return (
      <div className="w-full max-w-sm">
        <h1 className="font-heading mb-8 text-2xl font-bold text-white">
          Войти в{" "}
          <span style={{ color: "#1DB954" }}>SPOTIFY STORE</span>
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
        <a href={registerHref} className="text-[#10a37f] hover:underline">
          Зарегистрироваться
        </a>
      </p>
      <LoginForm />
    </div>
  );
}
