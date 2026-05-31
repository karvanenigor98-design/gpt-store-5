import { Suspense } from "react";
import { headers } from "next/headers";

import { AdminAlertsBar } from "@/components/admin/AdminAlertsBar";
import { OperatorSidebar } from "@/components/admin/OperatorSidebar";
import { StaffMobileNav } from "@/components/admin/StaffMobileNav";
import { OPERATOR_NAV_ITEMS } from "@/lib/admin/staff-nav-config";
import { requireStaffPanel } from "@/lib/auth/staff-access";

export default async function OperatorLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers();
  const pathname = headersList.get("x-invoke-pathname") ?? "/operator";
  const search = headersList.get("x-invoke-search") ?? "";
  const returnPath = `${pathname}${search}`;

  await requireStaffPanel("operator", returnPath);

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Suspense fallback={<div className="hidden w-52 flex-shrink-0 border-r border-black/[0.06] bg-white md:block" aria-hidden />}>
        <OperatorSidebar />
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
          <StaffMobileNav items={OPERATOR_NAV_ITEMS} panelRoot="/operator" />
        </Suspense>
        {children}
      </div>
    </div>
  );
}
