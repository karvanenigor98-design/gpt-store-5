import { Suspense } from "react";
import { headers } from "next/headers";

import { AdminAlertsBar } from "@/components/admin/AdminAlertsBar";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { requireStaffPanel } from "@/lib/auth/staff-access";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headersList = await headers();
  const pathname = headersList.get("x-invoke-pathname") ?? "/admin";
  const search = headersList.get("x-invoke-search") ?? "";
  const returnPath = `${pathname}${search}`;

  await requireStaffPanel("admin", returnPath);

  return (
    <div className="flex min-h-screen bg-transparent">
      <Suspense fallback={<div className="hidden w-52 flex-shrink-0 border-r border-black/[0.06] bg-white md:block" aria-hidden />}>
        <AdminSidebar />
      </Suspense>
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminAlertsBar />
        {children}
      </div>
    </div>
  );
}
