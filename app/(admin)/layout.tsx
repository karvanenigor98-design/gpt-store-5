import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { resolveServerRole } from "@/lib/auth/server-role";
import { AdminAlertsBar } from "@/components/admin/AdminAlertsBar";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const role = await resolveServerRole(user);
  if (role === "operator") {
    redirect("/operator");
  }
  if (role !== "admin") {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen bg-[#fafafa]">
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
