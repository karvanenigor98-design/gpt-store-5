import type { Metadata } from "next";
import { headers } from "next/headers";

import { resolveAuthSiteContext, resolvePortFromHeaders } from "@/lib/auth/devStoreProfile";
import { getCheckoutAuthMessage } from "@/lib/checkout/checkout-intent";
import { RegisterForm } from "./RegisterForm";

export const metadata: Metadata = { title: "Регистрация" };

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: { returnUrl?: string; site?: string };
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
          pathname: "/register",
        });
  const isSubsStore = authSite === "subs-store";
  const checkoutMessage = getCheckoutAuthMessage(returnUrl);

  if (isSubsStore) {
    return (
      <div className="w-full max-w-sm">
        <h1 className="font-heading text-2xl font-bold text-white mb-2">Регистрация</h1>
        <p className="text-sm text-gray-400 mb-3">
          {checkoutMessage ?? (
            <>
              Создайте аккаунт <span style={{ color: "#1DB954" }}>SPOTIFY STORE</span> — один email и
              пароль для кабинета, заказов Spotify Premium и чата с поддержкой.
            </>
          )}
        </p>
        <RegisterForm />
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm">
      <h1 className="font-heading text-2xl font-bold text-gray-900 mb-2">Создать аккаунт</h1>
      {checkoutMessage ? (
        <p className="text-sm text-gray-600 mb-4">{checkoutMessage}</p>
      ) : null}
      <p className="text-sm text-gray-500 mb-8">
        Уже есть аккаунт?{" "}
        <a href="/login" className="text-[#10a37f] hover:underline">
          Войти
        </a>
      </p>
      <RegisterForm />
    </div>
  );
}
