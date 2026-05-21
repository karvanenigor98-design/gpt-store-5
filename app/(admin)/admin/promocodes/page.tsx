import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/auth/requireAdminPage";
import { PromocodesManager } from "./PromocodesManager";
import { resolveAdminSiteSlug } from "@/lib/admin/siteFilter";
import { getSiteBySlug } from "@/lib/sites";

export const metadata: Metadata = { title: "Admin · Промокоды" };

export default async function AdminPromocodesPage({
  searchParams,
}: {
  searchParams: Promise<{ site?: string }>;
}) {
  await requireAdminPage();
  const params = await searchParams;
  const siteSlug = resolveAdminSiteSlug(params);
  const site = getSiteBySlug(siteSlug);

  return (
    <div className="p-6">
      <h1 className="mb-2 font-heading text-2xl font-bold text-gray-900">
        Промокоды
        <span className="ml-3 text-base font-normal" style={{ color: site.primaryColor }}>
          {site.brandName}
        </span>
      </h1>
      <p className="mb-6 text-sm text-gray-600">
        Учитываются при оплате вместе с промокодами из настроек (JSON). При успешной оплате счётчик
        использований увеличивается.
      </p>
      <PromocodesManager siteSlug={siteSlug} />
    </div>
  );
}
