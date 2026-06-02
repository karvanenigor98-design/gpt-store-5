export type { Database, OrderStatus, UserRole, ChatSenderType, ReviewStatus } from "./database";

// Тип профиля пользователя (расширенный, из БД)
export type Profile = {
  id: string;
  email: string | null;
  username: string | null;
  telegram_id: number | null;
  telegram_username: string | null;
  role: "client" | "operator" | "admin";
  created_at: string;
  last_seen: string | null;
};

// Тип заказа (из БД)
export type Order = {
  id: string;
  user_id: string | null;
  product: string;
  plan_id: string;
  price: number;
  currency: string;
  payment_method: string | null;
  payment_provider: string | null;
  payment_id: string | null;
  pally_order_id: string | null;
  status: import("./database").OrderStatus;
  account_email: string | null;
  token_received_at: string | null;
  activated_at: string | null;
  expires_at: string | null;
  created_at: string;
  meta: Record<string, unknown> | null;
};

// Тип сообщения чата
export type ChatMessage = {
  id: string;
  session_id: string;
  sender_id: string | null;
  sender_type: import("./database").ChatSenderType;
  content: string;
  attachments: unknown | null;
  is_read: boolean;
  is_auto_reply: boolean;
  reply_to_message_id?: string | null;
  is_deleted?: boolean;
  deleted_at?: string | null;
  deleted_by?: string | null;
  reply_to_message?: {
    id: string;
    sender_type: import("./database").ChatSenderType;
    content: string;
    is_deleted?: boolean;
  } | null;
  created_at: string;
};

// Тип сессии чата
export type ChatSession = {
  id: string;
  user_id: string | null;
  type: string;
  status: "open" | "closed";
  first_message_at: string | null;
  last_operator_reply_at: string | null;
  created_at: string;
  updated_at: string;
};

// Тип отзыва
export type Review = {
  id: string;
  telegram_message_id: number | null;
  author_name: string | null;
  author_username: string | null;
  author_avatar_url: string | null;
  content: string;
  media_urls: string[] | null;
  telegram_date: string | null;
  status: import("./database").ReviewStatus;
  created_at: string;
};

// Тип ответа на создание платежа
export type PaymentCreateResult = {
  success: boolean;
  paymentId: string;
  paymentUrl: string;
  status: string;
  raw?: unknown;
};
