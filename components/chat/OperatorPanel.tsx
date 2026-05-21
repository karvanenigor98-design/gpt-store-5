"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { ChatRoomListItem } from "@/types/chat-ui";
import type { Profile } from "@/types";
import { RoomList } from "@/components/chat/RoomList";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { StaffInternalChat } from "@/components/chat/StaffInternalChat";
import { ClientContextSidebar } from "@/components/chat/ClientContextSidebar";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getSiteBySlug } from "@/lib/sites";

interface OperatorPanelProps {
  currentUser: Profile;
  siteSlug?: string;
}

export function OperatorPanel({ currentUser, siteSlug }: OperatorPanelProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pendingRoomId =
    searchParams.get("thread_id") ?? searchParams.get("session_id");

  const [tab, setTab] = useState<"clients" | "team">("clients");
  const [selectedRoom, setSelectedRoom] = useState<ChatRoomListItem | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);

  const staffBase = currentUser.role === "operator" ? "/operator" : "/admin";
  const site = getSiteBySlug(siteSlug === "subs-store" ? "subs-store" : "gpt-store");
  const accent = site.primaryColor;

  useEffect(() => {
    if (pendingRoomId) setTab("clients");
  }, [pendingRoomId]);

  const clearPendingRoomFromUrl = useCallback(() => {
    if (!pendingRoomId) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("thread_id");
    params.delete("session_id");
    const qs = params.toString();
    router.replace(qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
  }, [pendingRoomId, router, searchParams]);

  useEffect(() => {
    if (!selectedRoom) {
      setSessionId(null);
      setResolveError(null);
      return;
    }

    if (selectedRoom.id) {
      setSessionId(selectedRoom.id);
      setResolveError(null);
      setResolving(false);
      return;
    }

    if (siteSlug === "subs-store") {
      setSessionId(null);
      setResolveError("Для Subs Store выберите диалог из списка (тред не найден).");
      setResolving(false);
      return;
    }

    let cancelled = false;
    setResolving(true);
    setResolveError(null);

    void (async () => {
      try {
        const res = await fetch("/api/admin/chat/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            userId: selectedRoom.client_id,
            ...(siteSlug === "subs-store" || siteSlug === "gpt-store" ? { site: siteSlug } : {}),
          }),
        });
        const data = (await res.json()) as { sessionId?: string; error?: string };
        if (!res.ok || !data.sessionId) {
          throw new Error(data.error ?? "Не удалось создать сессию");
        }
        if (!cancelled) {
          setSessionId(data.sessionId);
        }
      } catch (e) {
        if (!cancelled) {
          setSessionId(null);
          setResolveError(e instanceof Error ? e.message : "Ошибка");
        }
      } finally {
        if (!cancelled) setResolving(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedRoom, siteSlug]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-black/[0.08] bg-white shadow-[0_8px_30px_rgba(15,23,42,0.06)]">
      <div className="flex flex-shrink-0 border-b border-black/[0.06] bg-white px-3 pt-2">
        <button
          type="button"
          onClick={() => setTab("clients")}
          className={cn(
            "border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
            tab === "clients"
              ? "text-gray-900"
              : "border-transparent text-gray-500 hover:text-gray-700",
          )}
          style={tab === "clients" ? { borderBottomColor: accent, color: accent } : undefined}
        >
          Клиенты
        </button>
        <button
          type="button"
          onClick={() => setTab("team")}
          className={cn(
            "border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
            tab === "team"
              ? "text-gray-900"
              : "border-transparent text-gray-500 hover:text-gray-700",
          )}
          style={tab === "team" ? { borderBottomColor: accent, color: accent } : undefined}
        >
          {currentUser.role === "admin" ? "Чат с оператором" : "Чат с админом"}
        </button>
      </div>

      {tab === "team" ? (
        <div className="min-h-0 flex-1 bg-white">
          <StaffInternalChat currentUser={currentUser} />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <div className="flex w-80 flex-shrink-0 flex-col border-r border-gray-100 bg-white">
            <div className="border-b border-gray-100 px-4 py-4">
              <h2 className="text-base font-semibold text-gray-900">Диалоги</h2>
              <p className="mt-0.5 text-xs text-gray-500">
                {currentUser.role === "admin" ? "Панель администратора" : "Панель оператора"}
              </p>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <RoomList
                selectedClientId={selectedRoom?.client_id ?? null}
                onSelect={setSelectedRoom}
                siteSlug={siteSlug}
                pendingSelectRoomId={pendingRoomId}
                onPendingRoomConsumed={clearPendingRoomFromUrl}
              />
            </div>
          </div>

          <div className="flex min-w-0 flex-1 bg-white">
            <div className="min-w-0 flex-1">
              {selectedRoom && resolving && (
                <div className="flex h-full items-center justify-center gap-2 text-sm text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Подключаем чат…
                </div>
              )}
              {selectedRoom && resolveError && !resolving && (
                <div className="flex h-full items-center justify-center p-4 text-center text-sm text-red-600">
                  {resolveError}
                </div>
              )}
              {selectedRoom && sessionId && !resolving && !resolveError && (
                <ChatWindow
                  key={sessionId}
                  currentUser={currentUser}
                  sessionId={sessionId}
                  roomStatus={selectedRoom.status}
                  otherPartyName={
                    selectedRoom.client?.full_name ?? selectedRoom.client?.email ?? "Клиент"
                  }
                  viewerIsStaff
                  siteSlug={siteSlug}
                />
              )}
              {!selectedRoom && (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-gray-400">
                  <p className="text-sm">Выберите клиента слева</p>
                  <p className="max-w-sm px-4 text-center text-xs text-gray-500">
                    Можно написать первым — для нового клиента создаётся сессия автоматически.
                  </p>
                </div>
              )}
            </div>

            <ClientContextSidebar room={selectedRoom} staffBasePath={staffBase} />
          </div>
        </div>
      )}
    </div>
  );
}
