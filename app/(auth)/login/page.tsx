import type { Metadata } from "next";

import { resolveAuthSiteContext } from "@/lib/auth/devStoreProfile";
import { getCheckoutAuthMessage } from "@/lib/checkout/checkout-intent";
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

  const checkoutMessage = getCheckoutAuthMessage(returnUrl);

  return (
    <div className="w-full max-w-sm">
      <h1 className="font-heading text-2xl font-bold text-gray-900 mb-2">
        {checkoutMessage ? "Чтобы оплатить Plus" : "Войти"}
      </h1>
      {checkoutMessage ? (
        <p className="text-sm text-gray-600 mb-2">
          После входа откроется оплата выбранного тарифа. Менеджер напишет в чат.
        </p>
      ) : (
        <p className="text-sm text-gray-500 mb-2">Почта и пароль для заказа</p>
      )}
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
