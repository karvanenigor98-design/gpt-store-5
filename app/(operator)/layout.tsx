import { Suspense } from "react";
import { headers } from "next/headers";
import Link from "next/link";
import { isRedirectError } from "next/dist/client/components/redirect";

import { AdminAlertsBar } from "@/components/admin/AdminAlertsBar";
import { OperatorSidebar } from "@/components/admin/OperatorSidebar";
import { requireStaffPanel } from "@/lib/auth/staff-access";

export const dynamic = "force-dynamic";

export default async function OperatorLayout({ children }: { children: React.ReactNode }) {
  try {
    const headersList = await headers();
    const pathname = headersList.get("x-invoke-pathname") ?? "/operator";
    const search = headersList.get("x-invoke-search") ?? "";
    const returnPath = `${pathname}${search}`;

    await requireStaffPanel("operator", returnPath);

    return (
      <div className="flex min-h-screen bg-gray-50">
        <Suspense
          fallback={
            <div
              className="hidden w-52 flex-shrink-0 border-r border-black/[0.06] bg-white md:block"
              aria-hidden
            />
          }
        >
          <OperatorSidebar />
        </Suspense>
        <div className="flex min-w-0 flex-1 flex-col">
          <Suspense fallback={null}>
            <AdminAlertsBar />
          </Suspense>
          {children}
        </div>
      </div>
    );
  } catch (err) {
    if (isRedirectError(err)) throw err;
    console.error("[operator/layout]", err);
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <div className="max-w-md text-center">
          <h1 className="font-heading text-xl font-bold text-gray-900">Не удалось открыть панель оператора</h1>
          <p className="mt-3 text-sm text-gray-600">
            Проверьте вход и роль в профиле. Если ошибка повторяется — обновите страницу или войдите снова.
          </p>
          <Link
            href="/login?site=gpt-store&returnUrl=%2Foperator%3Fsite%3Dgpt-store"
            className="mt-6 inline-block rounded-xl bg-[#10a37f] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
          >
            На страницу входа
          </Link>
        </div>
      </div>
    );
  }
}
