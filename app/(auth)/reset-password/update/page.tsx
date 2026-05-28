import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";

import { resolvePortFromHeaders } from "@/lib/auth/devStoreProfile";
import {
  canonicalPasswordUpdateSearchParams,
  resolvePasswordUpdateSiteSync,
} from "@/lib/auth/resolvePasswordUpdateSite";
import { UpdatePasswordForm } from "./UpdatePasswordForm";

export const metadata: Metadata = { title: "Новый пароль" };

type PageProps = {
  searchParams?: { site?: string; returnUrl?: string };
};

export default async function ResetPasswordUpdatePage({ searchParams }: PageProps) {
  const siteParam = searchParams?.site ?? "";
  const returnUrl = searchParams?.returnUrl ?? "";
  const h = await headers();
  const cookieStore = await cookies();
  const authResetSite = cookieStore.get("auth_reset_site")?.value;

  const site = resolvePasswordUpdateSiteSync({
    siteDirect: siteParam,
    cookieSite: authResetSite,
    port: resolvePortFromHeaders(h),
  });

  const canonical = canonicalPasswordUpdateSearchParams(site, returnUrl);
  const canonicalSite = canonical.get("site") ?? site;
  const canonicalReturn = canonical.get("returnUrl") ?? "";

  if (siteParam !== canonicalSite || returnUrl !== canonicalReturn) {
    redirect(`/reset-password/update?${canonical.toString()}`);
  }

  const isSubsStore = site === "subs-store";

  return (
    <div className="w-full max-w-sm">
      <h1
        className={`mb-2 font-heading text-2xl font-bold ${isSubsStore ? "text-white" : "text-gray-900"}`}
      >
        Создайте новый пароль
      </h1>
      <p className={`mb-8 text-sm ${isSubsStore ? "text-gray-400" : "text-gray-500"}`}>
        После сохранения вы сразу попадёте в личный кабинет{" "}
        {isSubsStore ? <span style={{ color: "#1DB954" }}>SPOTIFY STORE</span> : "GPT STORE"}.
      </p>
      <Suspense
        fallback={
          <div
            className={`flex items-center justify-center py-8 ${isSubsStore ? "text-[#1DB954]" : "text-[#10a37f]"}`}
          >
            <Loader2 size={18} className="animate-spin" />
          </div>
        }
      >
        <UpdatePasswordForm initialSite={site} />
      </Suspense>
    </div>
  );
}
