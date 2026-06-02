import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { OperatorPanel } from "@/components/chat/OperatorPanel";
import { requireAdminPage } from "@/lib/auth/requireAdminPage";
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

  const { user, role } = await requireAdminPage();

  const admin = createAdminClient();
  const { data: profileRow } = await admin
    .from("profiles")
    .select("id, email, username, telegram_id, telegram_username, role, created_at, last_seen")
    .eq("id", user.id)
    .single();

  if (!profileRow) {
    redirect("/login?returnUrl=/admin/chat");
  }

  const profile = { ...profileRow, role } as Profile;

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
