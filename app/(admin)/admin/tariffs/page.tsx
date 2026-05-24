import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/auth/requireAdminPage";
import { resolveAdminSiteSlug } from "@/lib/admin/siteFilter";
import { getSiteBySlug } from "@/lib/sites";
import { createAdminClient } from "@/lib/supabase/server";
import { SubsTariffsManager } from "./SubsTariffsManager";
import { GptTariffsManager } from "./GptTariffsManager";

export const metadata: Metadata = { title: "Admin · Тарифы" };

export default async function AdminTariffsPage({
  searchParams,
}: {
  searchParams: Promise<{ site?: string }>;
}) {
  await requireAdminPage();
  const params = await searchParams;
  const siteSlug = resolveAdminSiteSlug(params);
  const site = getSiteBySlug(siteSlug);

  if (siteSlug === "subs-store") {
    return (
      <div className="p-6">
        <h1 className="mb-2 font-heading text-2xl font-bold text-gray-900">
          Тарифы Spotify
          <span className="ml-3 text-base font-normal" style={{ color: site.primaryColor }}>
            {site.brandName}
          </span>
        </h1>
        <p className="mb-6 text-sm text-gray-600">
          Управление витриной Spotify Store: цены, бейджи, популярность, порядок.
        </p>
        <SubsTariffsManager />
      </div>
    );
  }

  const supabase = createAdminClient();
  const { data: settings } = await supabase.from("site_settings").select("*");
  const settingsMap: Record<string, unknown> = {};
  (settings ?? []).forEach((s) => {
    settingsMap[s.key] = s.value;
  });

  return (
    <div className="p-6">
      <h1 className="mb-2 font-heading text-2xl font-bold text-gray-900">
        Тарифы ChatGPT
        <span className="ml-3 text-base font-normal" style={{ color: site.primaryColor }}>
          {site.brandName}
        </span>
      </h1>
      <p className="mb-6 text-sm text-gray-600">Plus, Pro, Pro 5x, Pro 20x и другие тарифы GPT STORE.</p>
      <GptTariffsManager initialSettings={settingsMap} />
    </div>
  );
}
