import type { ChatRoomListItem } from "@/types/chat-ui";

/**
 * Staff room list order:
 * 1) unread (operator) first
 * 2) within group — last_message_at DESC
 */
export function sortStaffChatRooms(rooms: ChatRoomListItem[]): ChatRoomListItem[] {
  return [...rooms].sort((a, b) => {
    const aUnread = (a.unread_operator ?? 0) > 0 ? 1 : 0;
    const bUnread = (b.unread_operator ?? 0) > 0 ? 1 : 0;
    if (aUnread !== bUnread) return bUnread - aUnread;
    const aAt = a.last_message_at ? Date.parse(a.last_message_at) : 0;
    const bAt = b.last_message_at ? Date.parse(b.last_message_at) : 0;
    return bAt - aAt;
  });
}
