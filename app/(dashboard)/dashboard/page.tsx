import { createAdminClient } from "@/lib/supabase/server";
import type { Metadata } from "next";
import { DashboardClient } from "./DashboardClient";
import { getSiteBySlug, filterOrdersBySite } from "@/lib/sites";
import { getSiteUUID } from "@/lib/admin/getSiteId";
import type { SiteSlug } from "@/lib/auth/siteUiSession";
import { resolveCustomerSiteSlug } from "@/lib/auth/resolveCustomerSiteSlug";
import { createSiteSessionClient } from "@/lib/supabase/site-session-server";
import { createSubsStoreAdminClient } from "@/lib/supabase/subs-store-admin";
import type { Database } from "@/types/database";

type OrderRow = Database["public"]["Tables"]["orders"]["Row"];

export const metadata: Metadata = { title: "Личный кабинет" };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ site?: string }>;
}) {
  const params = await searchParams;
  const siteSlug: SiteSlug = await resolveCustomerSiteSlug({
    siteParam: params.site,
    pathname: "/dashboard",
  });
  const site = getSiteBySlug(siteSlug);

  const { browserLike: supabase } = await createSiteSessionClient(siteSlug);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  let profile: { username: string | null; email: string | null; created_at: string | null } | null =
    null;
  let orders: OrderRow[] = [];
  let chatsCount = 0;

  if (siteSlug === "subs-store") {
    const subsAdmin = createSubsStoreAdminClient();
    if (subsAdmin) {
      const { data: prof } = await subsAdmin
        .from("profiles")
        .select("username, email, created_at")
        .eq("id", user.id)
        .maybeSingle();
      profile = prof;
    }

    const { data: allUserOrders } = await supabase
      .from("orders")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    orders = (allUserOrders ?? []) as OrderRow[];

    const { count } = await supabase
      .from("chat_threads")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);
    chatsCount = count ?? 0;
  } else {
    const admin = createAdminClient();
    const { data: prof } = await admin
      .from("profiles")
      .select("username, email, created_at")
      .eq("id", user.id)
      .maybeSingle();
    profile = prof;

    const { data: allUserOrders } = await supabase
      .from("orders")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    orders = filterOrdersBySite(allUserOrders ?? [], siteSlug);

    const siteId = await getSiteUUID(siteSlug);
    let chatsCountQuery = supabase
      .from("chat_sessions")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);
    if (siteId) {
      chatsCountQuery = chatsCountQuery.eq("site_id", siteId) as typeof chatsCountQuery;
    }
    const { count: c } = await chatsCountQuery;
    chatsCount = c ?? 0;
  }

  const ordersCount = orders.length;
  const activeCount = orders.filter((o) => {
    const s = String(o.status ?? "");
    if (siteSlug === "subs-store") {
      return ["paid", "processing", "awaiting_data", "activated", "active", "waiting_client"].includes(
        s,
      );
    }
    return ["active", "activating", "waiting_client"].includes(s);
  }).length;

  return (
    <DashboardClient
      userEmail={user.email ?? ""}
      username={profile?.username ?? null}
      profileCreatedAt={profile?.created_at ?? user.created_at ?? new Date().toISOString()}
      orders={orders.slice(0, 10)}
      ordersCount={ordersCount}
      activeCount={activeCount}
      chatsCount={chatsCount}
      siteSlug={site.slug}
      sitePrimaryColor={site.primaryColor}
      siteBrandName={site.brandName}
      siteCheckoutPath={site.checkoutPath}
      siteSupportPath={`/dashboard/chat${siteSlug ? `?site=${siteSlug}` : ""}`}
    />
  );
}
