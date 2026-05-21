import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAdminPage } from "@/lib/auth/requireAdminPage";
import { resolveAdminSiteSlug } from "@/lib/admin/siteFilter";
import { getSiteBySlug } from "@/lib/sites";
import { SubsTariffsManager } from "./SubsTariffsManager";

export const metadata: Metadata = { title: "Admin · Тарифы" };

export default async function AdminTariffsPage({
  searchParams,
}: {
  searchParams: Promise<{ site?: string }>;
}) {
  await requireAdminPage();
  const params = await searchParams;
  const siteSlug = resolveAdminSiteSlug(params);

  if (siteSlug !== "subs-store") {
    redirect("/admin/settings?site=gpt-store");
  }

  const site = getSiteBySlug(siteSlug);

  return (
    <div className="p-6">
      <h1 className="mb-2 font-heading text-2xl font-bold text-gray-900">
        Тарифы Spotify
        <span className="ml-3 text-base font-normal" style={{ color: site.primaryColor }}>
          {site.brandName}
        </span>
      </h1>
      <p className="mb-6 text-sm text-gray-600">
        Управление витриной Subs Store: цены, бейджи, популярность, порядок. Тарифы GPT STORE — в
        настройках магазина (JSON pricing_plans).
      </p>
      <SubsTariffsManager />
    </div>
  );
}
