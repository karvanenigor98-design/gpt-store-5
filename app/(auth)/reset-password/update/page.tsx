import type { Metadata } from "next";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";

import { UpdatePasswordForm } from "./UpdatePasswordForm";

export const metadata: Metadata = { title: "Новый пароль" };

export default function ResetPasswordUpdatePage({
  searchParams,
}: {
  searchParams?: { site?: string; returnUrl?: string };
}) {
  const siteParam = searchParams?.site ?? "";
  const isSubsStore = siteParam === "subs-store";

  return (
    <div className="w-full max-w-sm">
      <h1 className={`mb-2 font-heading text-2xl font-bold ${isSubsStore ? "text-white" : "text-gray-900"}`}>
        Создайте новый пароль
      </h1>
      <p className={`mb-8 text-sm ${isSubsStore ? "text-gray-400" : "text-gray-500"}`}>
        После сохранения вы сразу попадёте в личный кабинет{" "}
        {isSubsStore ? <span style={{ color: "#1DB954" }}>Subs Store</span> : "GPT STORE"}.
      </p>
      <Suspense
        fallback={
          <div className={`flex items-center justify-center py-8 ${isSubsStore ? "text-[#1DB954]" : "text-[#10a37f]"}`}>
            <Loader2 size={18} className="animate-spin" />
          </div>
        }
      >
        <UpdatePasswordForm />
      </Suspense>
    </div>
  );
}
