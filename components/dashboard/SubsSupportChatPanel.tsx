import { ChatWindow } from "@/components/chat/ChatWindow";
import { TokenSafetyBlock } from "@/components/ui/TokenSafetyBlock";
import { getOrCreateSubsCustomerSupportThread } from "@/lib/chat/subs-support-thread";
import { createSubsStoreAdminClient } from "@/lib/supabase/subs-store-admin";
import { getSiteBySlug } from "@/lib/sites";
import type { Profile } from "@/types";
import type { User } from "@supabase/supabase-js";

type Props = {
  user: User;
};

/** Постоянный чат поддержки Subs Store в кабинете (правая колонка / низ на mobile). */
export async function SubsSupportChatPanel({ user }: Props) {
  const site = getSiteBySlug("subs-store");
  const subsAdmin = createSubsStoreAdminClient();

  if (!subsAdmin) {
    return (
      <div className="flex flex-1 items-center justify-center p-4 text-center text-sm text-gray-400">
        Чат недоступен: проверьте SUBS_SUPABASE_* в .env.local
      </div>
    );
  }

  const thread = await getOrCreateSubsCustomerSupportThread(subsAdmin, user.id);
  if (!thread?.id) {
    return (
      <div className="flex flex-1 items-center justify-center p-4 text-center text-sm text-gray-400">
        Не удалось открыть чат. Проверьте таблицу chat_threads в Subs Supabase.
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

  const { data: threadMeta } = await subsAdmin
    .from("chat_threads")
    .select("status")
    .eq("id", thread.id)
    .maybeSingle();

  const roomStatus = threadMeta?.status === "closed" ? "closed" : "open";

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#111111]">
      <div className="shrink-0 border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1DB954]/20 text-sm font-bold text-[#1DB954]">
            S
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{site.brandName} — поддержка</p>
            <div className="mt-0.5 flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#1DB954]" />
              <span className="text-xs text-gray-500">
                {roomStatus === "closed" ? "Закрыт" : "Активен"}
              </span>
            </div>
          </div>
        </div>
      </div>
      <div className="shrink-0 border-b border-white/10 p-3">
        <TokenSafetyBlock compact showSupportLink={false} variant="subs" />
      </div>
      <div className="min-h-0 flex-1">
        <ChatWindow
          currentUser={profile}
          sessionId={thread.id}
          roomStatus={roomStatus}
          otherPartyName={`${site.brandName} — поддержка`}
          viewerIsStaff={false}
          siteSlug="subs-store"
          hideHeader
        />
      </div>
    </div>
  );
}
