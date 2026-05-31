import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { resolveCustomerSiteSlug } from "@/lib/auth/resolveCustomerSiteSlug";

import { ChatWindow } from "@/components/chat/ChatWindow";
import { TokenSafetyBlock } from "@/components/ui/TokenSafetyBlock";
import { resolveCabinetServerRole } from "@/lib/auth/server-role";
import type { SiteSlug } from "@/lib/auth/siteUiSession";
import { getOrCreateClientOperatorSession } from "@/lib/chat/operatorSession";
import { getOrCreateSubsCustomerSupportThread } from "@/lib/chat/subs-support-thread";
import { tryCreateAdminClient } from "@/lib/supabase/server";
import { createSiteSessionClient } from "@/lib/supabase/site-session-server";
import { createSubsStoreAdminClient } from "@/lib/supabase/subs-store-admin";
import { getSiteBySlug } from "@/lib/sites";
import type { Profile } from "@/types";
import type { ChatRoomListItem } from "@/types/chat-ui";

export const metadata: Metadata = { title: "Чат поддержки" };

function deriveRoomStatus(
  status: "open" | "closed",
  first_message_at: string | null,
  last_operator_reply_at: string | null,
): ChatRoomListItem["status"] {
  if (status === "closed") return "closed";
  if (first_message_at && !last_operator_reply_at) return "waiting";
  return "open";
}

export default async function DashboardChatPage({
  searchParams,
}: {
  searchParams: Promise<{ site?: string }>;
}) {
  const { site: siteParam } = await searchParams;
  const siteSlug: SiteSlug = await resolveCustomerSiteSlug({
    siteParam,
    pathname: "/dashboard/chat",
  });
  const site = getSiteBySlug(siteSlug);

  const { browserLike: supabase } = await createSiteSessionClient(siteSlug);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const chatReturnUrl = encodeURIComponent(`/dashboard/chat?site=${siteSlug}`);
  if (!user) {
    redirect(`/login?returnUrl=${chatReturnUrl}&site=${siteSlug}`);
  }

  const staffRole = await resolveCabinetServerRole(siteSlug, user);
  if (siteSlug === "gpt-store") {
    if (staffRole === "admin") {
      redirect("/admin/chat");
    }
    if (staffRole === "operator") {
      redirect("/operator/chat?site=gpt-store");
    }
  }

  if (siteSlug === "subs-store") {
    const subsAdmin = createSubsStoreAdminClient();
    if (!subsAdmin) {
      return (
        <div className="flex min-h-[calc(100dvh-7rem)] w-full items-center justify-center px-4 text-center text-gray-500 md:min-h-[calc(100vh-7rem)]">
          Subs Store Supabase не настроен: задайте SUBS_SUPABASE_URL и SUBS_SUPABASE_SERVICE_ROLE_KEY для чата.
        </div>
      );
    }

    const thread = await getOrCreateSubsCustomerSupportThread(subsAdmin, user.id);
    if (!thread?.id) {
      return (
        <div className="flex min-h-[calc(100dvh-7rem)] w-full items-center justify-center px-4 text-center text-gray-500 md:min-h-[calc(100vh-7rem)]">
          Не удалось открыть чат Subs Store. Проверьте таблицу <code className="text-xs">chat_threads</code> в Subs
          проекте.
        </div>
      );
    }

    const { data: prof } = await subsAdmin
      .from("profiles")
      .select("username, email, telegram_id, telegram_username, role, created_at, last_seen")
      .eq("id", user.id)
      .maybeSingle();

    const profile: Profile = {
      id: user.id,
      email: user.email ?? (prof?.email as string | null) ?? null,
      username: (prof?.username as string | null) ?? null,
      telegram_id: (prof?.telegram_id as number | null) ?? null,
      telegram_username: (prof?.telegram_username as string | null) ?? null,
      role: ((prof?.role as Profile["role"]) ?? "client") as Profile["role"],
      created_at: (prof?.created_at as string) ?? user.created_at ?? new Date().toISOString(),
      last_seen: (prof?.last_seen as string | null) ?? null,
    };

    const { data: threadMeta } = await subsAdmin.from("chat_threads").select("status").eq("id", thread.id).maybeSingle();

    const roomStatus: ChatRoomListItem["status"] =
      threadMeta?.status === "closed" ? "closed" : "open";

    const supportName = `${site.brandName} — поддержка`;

    return (
      <div className="flex w-full flex-col md:-mx-6 md:-mb-6 md:w-[calc(100%+3rem)] lg:-mx-8 lg:-mb-8 lg:w-[calc(100%+4rem)]">
        <div className="flex min-h-[calc(100dvh-3.5rem)] w-full md:min-h-[calc(100dvh-3.5rem)]">
          <div className="flex h-full min-h-[calc(100dvh-3.5rem)] w-full flex-col overflow-hidden rounded-xl border border-white/10 bg-[#111111] md:min-h-[calc(100dvh-3.5rem)]">
            <div className="shrink-0 border-b border-white/10 p-3 sm:p-4">
              <TokenSafetyBlock compact showSupportLink={false} variant="subs" />
            </div>
            <div className="min-h-0 flex-1">
              <ChatWindow
                currentUser={profile}
                sessionId={thread.id}
                roomStatus={roomStatus}
                otherPartyName={supportName}
                viewerIsStaff={false}
                siteSlug={siteSlug}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const admin = tryCreateAdminClient();
  if (!admin) {
    return (
      <div className="flex min-h-[calc(100dvh-7rem)] w-full items-center justify-center px-4 text-center text-gray-500 md:min-h-[calc(100vh-7rem)]">
        Не удалось открыть чат: на сервере не настроен Supabase (проверьте{" "}
        <code className="text-xs">NEXT_PUBLIC_SUPABASE_URL</code> и{" "}
        <code className="text-xs">SUPABASE_SERVICE_ROLE_KEY</code> на Vercel).
      </div>
    );
  }

  const { data: profileRow } = await admin
    .from("profiles")
    .select("id, email, username, telegram_id, telegram_username, role, created_at, last_seen")
    .eq("id", user.id)
    .single();

  if (!profileRow) {
    redirect(`/login?returnUrl=${chatReturnUrl}&site=${siteSlug}`);
  }

  const profile = profileRow as Profile;

  const session = await getOrCreateClientOperatorSession(admin, user.id, siteSlug);
  if (!session?.id) {
    return (
      <div className="flex min-h-[calc(100dvh-7rem)] w-full items-center justify-center px-4 text-center text-gray-500 md:min-h-[calc(100vh-7rem)]">
        Не удалось открыть чат. Попробуйте позже.
      </div>
    );
  }

  const { data: sessionMeta } = await admin
    .from("chat_sessions")
    .select("status, first_message_at, last_operator_reply_at")
    .eq("id", session.id)
    .single();

  const roomStatus = deriveRoomStatus(
    sessionMeta?.status === "closed" ? "closed" : "open",
    sessionMeta?.first_message_at ?? null,
    sessionMeta?.last_operator_reply_at ?? null,
  );

  const supportName = `${site.brandName} — поддержка`;

  return (
    <div className="flex w-full flex-col md:-mx-6 md:-mb-6 md:w-[calc(100%+3rem)] lg:-mx-8 lg:-mb-8 lg:w-[calc(100%+4rem)]">
      <div className="flex min-h-[calc(100dvh-3.5rem)] w-full items-center justify-center md:min-h-screen">
        <div className="flex h-full w-full min-h-[calc(100dvh-3.5rem)] flex-col overflow-hidden bg-white md:min-h-screen md:border-x md:border-black/[0.07]">
          <div className="shrink-0 border-b border-gray-100 bg-gray-50/80 p-3 sm:p-4">
            <TokenSafetyBlock compact showSupportLink={false} className="bg-white" />
          </div>
          <div className="min-h-0 flex-1">
            <ChatWindow
              currentUser={profile}
              sessionId={session.id}
              roomStatus={roomStatus}
              otherPartyName={supportName}
              viewerIsStaff={false}
              siteSlug={siteSlug}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
