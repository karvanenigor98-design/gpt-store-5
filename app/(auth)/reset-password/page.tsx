import type { Metadata } from "next";
import { ResetPasswordForm } from "./ResetPasswordForm";

export const metadata: Metadata = { title: "Сброс пароля" };

type ResetPasswordPageProps = {
  searchParams?: { error?: string; site?: string };
};

export default function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const siteParam = searchParams?.site ?? "";
  const isSubsStore = siteParam === "subs-store";

  if (isSubsStore) {
    return (
      <div className="w-full max-w-sm">
        <h1 className="font-heading text-2xl font-bold text-white mb-2">
          Сброс пароля{" "}
          <span style={{ color: "#1DB954" }}>Subs Store</span>
        </h1>
        <p className="text-sm text-gray-400 mb-8">
          Введите email — пришлём ссылку для создания нового пароля.
        </p>
        <ResetPasswordForm callbackError={searchParams?.error} siteSlug="subs-store" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm">
      <h1 className="font-heading text-2xl font-bold text-gray-900 mb-2">Сброс пароля</h1>
      <p className="text-sm text-gray-500 mb-8">
        Введите email — пришлём ссылку для сброса пароля.
      </p>
      <ResetPasswordForm callbackError={searchParams?.error} siteSlug="gpt-store" />
    </div>
  );
}
