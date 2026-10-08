import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { OperatorPanel } from "@/components/chat/OperatorPanel";
import { loadGptStaffAuth, staffLoginUrl } from "@/lib/auth/staff-access";
import { createAdminClient } from "@/lib/supabase/server";
import { resolveAdminSiteSlug } from "@/lib/admin/siteFilter";
import { getSiteBySlug } from "@/lib/sites";
import type { Profile } from "@/types";

export const metadata: Metadata = { title: "Чат с клиентами" };

export default async function AdminChatPage({
  searchParams,
}: {
  searchParams: Promise<{ site?: string }>;
}) {
  const params = await searchParams;
  const siteSlug = resolveAdminSiteSlug(params);
  const site = getSiteBySlug(siteSlug);
  const headersList = await headers();
  const invokePath = headersList.get("x-invoke-pathname") ?? "";
  const panelBase = invokePath.startsWith("/operator") ? "/operator" : "/admin";
  const chatReturnPath = `${panelBase}/chat?site=${siteSlug}`;

  const auth = await loadGptStaffAuth();
  const user = auth.user;
  const role = auth.role;
  if (!user) {
    redirect(staffLoginUrl(chatReturnPath));
  }
  if (role !== "admin" && role !== "operator") {
    redirect("/dashboard");
  }

  const admin = createAdminClient();
  const { data: profileRow } = await admin
    .from("profiles")
    .select("id, email, username, telegram_id, telegram_username, role, created_at, last_seen")
    .eq("id", user.id)
    .maybeSingle();

  const profile = {
    id: profileRow?.id ?? user.id,
    email: profileRow?.email ?? user.email ?? null,
    username: profileRow?.username ?? null,
    telegram_id: profileRow?.telegram_id ?? null,
    telegram_username: profileRow?.telegram_username ?? null,
    role,
    created_at: profileRow?.created_at ?? new Date().toISOString(),
    last_seen: profileRow?.last_seen ?? null,
  } as Profile;

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col p-4 md:p-6">
      <h1 className="mb-4 font-heading text-2xl font-bold text-gray-900">
        Чат с клиентами
        <span className="ml-3 text-base font-normal" style={{ color: site.primaryColor }}>
          {site.brandName}
        </span>
      </h1>
      <div className="min-h-0 flex-1">
        <Suspense
          fallback={
            <div className="flex h-full items-center justify-center text-sm text-gray-500">
              Загрузка чата…
            </div>
          }
        >
          <OperatorPanel currentUser={profile} siteSlug={siteSlug} />
        </Suspense>
      </div>
    </div>
  );
}
