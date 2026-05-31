import { Suspense } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { AdminAlertsBar } from "@/components/admin/AdminAlertsBar";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { StaffMobileNav } from "@/components/admin/StaffMobileNav";
import { ADMIN_NAV_ITEMS } from "@/lib/admin/staff-nav-config";
import { getGptStaffSessionUser, staffLoginUrl } from "@/lib/auth/staff-access";
import { resolveServerRole } from "@/lib/auth/server-role";
import type { StaffPanel } from "@/lib/auth/staff-access";

export const dynamic = "force-dynamic";

function isRedirectError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

async function guardStaffPanel(panel: StaffPanel, returnPath: string): Promise<void> {
  const user = await getGptStaffSessionUser();
  if (!user) {
    redirect(staffLoginUrl(returnPath));
  }

  const role = await resolveServerRole(user);
  if (role === "admin") {
    if (panel === "operator") {
      redirect(returnPath.replace(/^\/operator/, "/admin") || "/admin");
    }
    return;
  }

  if (role === "operator") {
    if (panel === "admin") {
      redirect(returnPath.replace(/^\/admin/, "/operator") || "/operator");
    }
    return;
  }

  redirect("/dashboard?site=gpt-store");
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headersList = await headers();
  const pathname = headersList.get("x-invoke-pathname") ?? "/admin";
  const search = headersList.get("x-invoke-search") ?? "";
  const returnPath = `${pathname}${search}`;

  try {
    await guardStaffPanel("admin", returnPath);
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error("[admin/layout]", error);
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <div className="max-w-lg rounded-xl border border-gray-200 bg-white p-6 text-center shadow-sm">
          <h1 className="font-heading text-xl font-bold text-gray-900">Не удалось открыть панель</h1>
          <p className="mt-3 text-sm text-gray-600">
            Проверьте на Vercel переменные{" "}
            <code className="rounded bg-gray-100 px-1">NEXT_PUBLIC_SUPABASE_URL</code> (должен быть{" "}
            <code className="rounded bg-gray-100 px-1">*.supabase.co</code>, не домен сайта) и{" "}
            <code className="rounded bg-gray-100 px-1">SUPABASE_SERVICE_ROLE_KEY</code>, затем
            обновите страницу.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Suspense fallback={<div className="hidden w-52 flex-shrink-0 border-r border-black/[0.06] bg-white md:block" aria-hidden />}>
        <AdminSidebar />
      </Suspense>
      <div className="flex min-w-0 flex-1 flex-col">
        <Suspense
          fallback={
            <div className="flex h-14 items-center border-b border-gray-200 bg-white px-4 md:px-6">
              <span className="text-sm text-gray-400">Загрузка…</span>
            </div>
          }
        >
          <AdminAlertsBar />
        </Suspense>
        <Suspense fallback={null}>
          <StaffMobileNav items={ADMIN_NAV_ITEMS} panelRoot="/admin" />
        </Suspense>
        {children}
      </div>
    </div>
  );
}
