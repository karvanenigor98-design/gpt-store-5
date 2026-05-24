import { createClient, createAdminClient } from "@/lib/supabase/server";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SettingsForm } from "./SettingsForm";
import { SubsSiteSettingsForm } from "./SubsSiteSettingsForm";
import { EmailNotificationSettings } from "@/components/admin/EmailNotificationSettings";
import { requireAdminPage } from "@/lib/auth/requireAdminPage";
import { resolveAdminSiteSlug } from "@/lib/admin/siteFilter";
import { getSiteBySlug } from "@/lib/sites";
import { listAccessibleAdminSiteSlugs } from "@/lib/admin/subs-api-guard";
import { createSubsStoreAdminClient, isSubsStoreBackendConfigured } from "@/lib/supabase/subs-store-admin";

export const metadata: Metadata = { title: "Admin · Настройки" };

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ site?: string }>;
}) {
  await requireAdminPage();
  const params = await searchParams;
  const siteSlug = resolveAdminSiteSlug(params);
  const site = getSiteBySlug(siteSlug);

  if (siteSlug === "subs-store") {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      redirect("/login");
    }
    const gptAdmin = createAdminClient();
    const accessible = await listAccessibleAdminSiteSlugs(user, gptAdmin);
    if (!accessible.includes("subs-store")) {
      redirect("/admin/settings");
    }

    if (!isSubsStoreBackendConfigured()) {
      return (
        <div className="p-6">
          <h1 className="mb-2 font-heading text-2xl font-bold text-gray-900">
            Настройки
            <span className="ml-3 text-base font-normal" style={{ color: site.primaryColor }}>
              {site.brandName}
            </span>
          </h1>
          <p className="max-w-xl text-sm text-gray-600">
            Подключите Spotify Store на сервере: задайте{" "}
            <code className="rounded bg-gray-100 px-1 text-xs">SUBS_SUPABASE_URL</code> и{" "}
            <code className="rounded bg-gray-100 px-1 text-xs">SUBS_SUPABASE_SERVICE_ROLE_KEY</code> (см.{" "}
            <code className="rounded bg-gray-100 px-1 text-xs">.env.example</code>).
          </p>
        </div>
      );
    }

    const subs = createSubsStoreAdminClient();
    if (!subs) {
      redirect("/admin/settings");
    }

    const { data: settings } = await subs.from("site_settings").select("*");
    const settingsMap: Record<string, unknown> = {};
    (settings ?? []).forEach((s) => {
      settingsMap[s.key as string] = s.value;
    });

    return (
      <div className="p-6">
        <h1 className="mb-6 font-heading text-2xl font-bold text-gray-900">
          Настройки
          <span className="ml-3 text-base font-normal" style={{ color: site.primaryColor }}>
            {site.brandName}
          </span>
        </h1>
        <div className="max-w-3xl space-y-6">
          <EmailNotificationSettings siteSlug="subs-store" brandLabel={site.brandName} />
          <SubsSiteSettingsForm initialMap={settingsMap} />
        </div>
      </div>
    );
  }

  const supabase = await createClient();

  const { data: settings } = await supabase.from("site_settings").select("*");

  const settingsMap: Record<string, unknown> = {};
  (settings ?? []).forEach((s) => {
    settingsMap[s.key] = s.value;
  });

  return (
    <div className="p-6">
      <h1 className="mb-6 font-heading text-2xl font-bold text-gray-900">Настройки сайта</h1>
      <div className="max-w-3xl space-y-6">
        <EmailNotificationSettings siteSlug="gpt-store" brandLabel="GPT STORE" />
        <SettingsForm initialSettings={settingsMap} />
      </div>
    </div>
  );
}
