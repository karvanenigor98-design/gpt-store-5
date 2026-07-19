/** Элемент списка чатов (сессия + клиент) для оператора/админа */
export type ChatRoomListItem = {
  /** null — сессии ещё нет, создастся при первом сообщении или по запросу */
  id: string | null;
  client_id: string;
  status: "open" | "waiting" | "closed";
  last_message_at: string | null;
  last_message_preview: string | null;
  unread_operator: number;
  client: {
    full_name: string | null;
    email: string | null;
    telegram_username?: string | null;
    telegram_id?: number | null;
  };
};

/** Ответ API для виджета / клиента: одна сессия поддержки */
export type ClientChatSessionPayload = {
  id: string;
  status: "open" | "closed";
  last_message_at: string | null;
};
