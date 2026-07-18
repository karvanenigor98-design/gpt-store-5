import { listAccessibleAdminSiteSlugs } from "@/lib/admin/subs-api-guard";
import { resolveAdminSiteSlug } from "@/lib/admin/siteFilter";
import {
  loadGptAdminReviews,
  loadSubsAdminReviews,
  type AdminReviewRow,
} from "@/lib/reviews/load-admin-reviews";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import {
  createSubsStoreAdminClient,
  isSubsStoreBackendConfigured,
} from "@/lib/supabase/subs-store-admin";
import { getSiteBySlug } from "@/lib/sites";

export type StaffReviewsPageData = {
  siteSlug: "gpt-store" | "subs-store";
  brandName: string;
  primaryColor: string;
  status: "pending" | "approved" | "rejected";
  reviews: AdminReviewRow[];
  setupHint: string | null;
  /** If set, caller should redirect here (avoid loops: always include site=). */
  redirectTo?: string;
};

export async function loadStaffReviewsPageData(params: {
  staffRoot: "/admin" | "/operator";
  statusParam?: string;
  siteParam?: string;
}): Promise<StaffReviewsPageData> {
  const status =
    params.statusParam === "approved" || params.statusParam === "rejected"
      ? params.statusParam
      : "pending";
  let siteSlug = resolveAdminSiteSlug({ site: params.siteParam });
  const site = getSiteBySlug(siteSlug);
  let reviews: AdminReviewRow[] = [];
  let setupHint: string | null = null;

  if (siteSlug === "subs-store") {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return {
        siteSlug,
        brandName: site.brandName,
        primaryColor: site.primaryColor,
        status,
        reviews: [],
        setupHint: null,
        redirectTo: `/login?site=gpt-store&returnUrl=${encodeURIComponent(`${params.staffRoot}/reviews?site=subs-store&status=${status}`)}`,
      };
    }

    const gptAdmin = createAdminClient();
    const accessible = await listAccessibleAdminSiteSlugs(user, gptAdmin);
    if (!accessible.includes("subs-store")) {
      // Never redirect to bare /reviews — soft-nav loop with StaffSiteUrlSync.
      return {
        siteSlug: "gpt-store",
        brandName: getSiteBySlug("gpt-store").brandName,
        primaryColor: getSiteBySlug("gpt-store").primaryColor,
        status,
        reviews: [],
        setupHint: null,
        redirectTo: `${params.staffRoot}/reviews?site=gpt-store&status=${status}`,
      };
    }

    if (!isSubsStoreBackendConfigured()) {
      setupHint =
        "Подключите Subs Store: задайте SUBS_SUPABASE_URL и SUBS_SUPABASE_SERVICE_ROLE_KEY в .env.local";
    } else if (!createSubsStoreAdminClient()) {
      setupHint = "Не удалось подключиться к Supabase Subs Store — проверьте ключи.";
    } else {
      reviews = await loadSubsAdminReviews(status);
    }
  } else {
    siteSlug = "gpt-store";
    reviews = await loadGptAdminReviews("gpt-store", status);
  }

  return {
    siteSlug,
    brandName: site.brandName,
    primaryColor: site.primaryColor,
    status,
    reviews,
    setupHint,
  };
}
