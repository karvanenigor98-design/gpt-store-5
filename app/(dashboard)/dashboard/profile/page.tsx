import type { Metadata } from "next";
import { cookies } from "next/headers";
import { selectProfileByIdFlexible } from "@/lib/admin/selectProfilesFlexible";
import { createAdminClient } from "@/lib/supabase/server";
import { createSubsStoreAdminClient } from "@/lib/supabase/subs-store-admin";
import type { SiteSlug } from "@/lib/auth/siteUiSession";
import { createSiteSessionClient } from "@/lib/supabase/site-session-server";
import { ProfileForm } from "./ProfileForm";

export const metadata: Metadata = { title: "Профиль" };

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ site?: string }>;
}) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const rawSite = params.site ?? cookieStore.get("current_site")?.value;
  const siteSlug: SiteSlug = rawSite === "subs-store" ? "subs-store" : "gpt-store";

  const { browserLike: supabase } = await createSiteSessionClient(siteSlug);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  let username = "";
  let telegram_username = "";
  let createdAt = typeof user.created_at === "string" ? user.created_at : "";

  if (siteSlug === "subs-store") {
    const subsAdmin = createSubsStoreAdminClient();
    if (subsAdmin) {
      const { row: profile } = await selectProfileByIdFlexible(subsAdmin, user.id, [
        "username",
        "full_name",
        "telegram_username",
        "email",
        "created_at",
      ]);
      username = (profile?.username as string | null) ?? (profile?.full_name as string | null) ?? "";
      telegram_username = (profile?.telegram_username as string | null) ?? "";
      createdAt = (profile?.created_at as string) ?? createdAt;
    }
  } else {
    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("username, telegram_username, email, created_at")
      .eq("id", user.id)
      .maybeSingle();
    username = profile?.username ?? "";
    telegram_username = profile?.telegram_username ?? "";
    createdAt = profile?.created_at ?? createdAt;
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <h1
        className={`font-heading mb-6 text-2xl font-bold ${
          siteSlug === "subs-store" ? "text-white" : "text-gray-900"
        }`}
      >
        Профиль
      </h1>
      <ProfileForm
        siteSlug={siteSlug}
        initialData={{
          username,
          telegram_username,
          email: user.email ?? "",
          createdAt,
        }}
      />
    </div>
  );
}
