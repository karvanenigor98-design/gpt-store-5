export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type OrderStatus =
  | "pending"
  | "paid"
  | "activating"
  | "waiting_client"
  | "active"
  | "failed"
  | "refunded"
  | "expired";

export type UserRole = "client" | "operator" | "admin";

export type NotificationType =
  | "new_order"
  | "payment_success"
  | "payment_failed"
  | "new_chat_message"
  | "new_review"
  | "order_needs_data"
  | "order_problem"
  | "order_activated"
  | "subscription_expiring"
  /** Subs Store: ответ поддержки клиенту (таблица notifications в проекте spotify) */
  | "chat_reply";

export type ChatSessionStatus = "open" | "closed";
export type ChatSenderType = "client" | "operator" | "admin" | "ai" | "auto";
export type ReviewStatus = "pending" | "approved" | "rejected";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Relationships: [];
        Row: {
          id: string;
          email: string | null;
          username: string | null;
          telegram_id: number | null;
          telegram_username: string | null;
          role: UserRole;
          created_at: string;
          last_seen: string | null;
          notes: string | null;
          tags: string[] | null;
          client_stage: string | null;
        };
        Insert: {
          id: string;
          email?: string | null;
          username?: string | null;
          telegram_id?: number | null;
          telegram_username?: string | null;
          role?: UserRole;
          created_at?: string;
          last_seen?: string | null;
          notes?: string | null;
          tags?: string[] | null;
          client_stage?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
      };
      orders: {
        Relationships: [];
        Row: {
          id: string;
          user_id: string | null;
          site_id: string | null;
          product: string;
          plan_id: string;
          plan_name: string | null;
          price: number;
          currency: string;
          payment_method: string | null;
          payment_provider: string | null;
          payment_id: string | null;
          pally_order_id: string | null;
          status: OrderStatus;
          account_email: string | null;
          token_received_at: string | null;
          activated_at: string | null;
          paid_at: string | null;
          expires_at: string | null;
          created_at: string;
          meta: Json | null;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          site_id?: string | null;
          product: string;
          plan_id: string;
          plan_name?: string | null;
          price: number;
          currency?: string;
          payment_method?: string | null;
          payment_provider?: string | null;
          payment_id?: string | null;
          pally_order_id?: string | null;
          status?: OrderStatus;
          account_email?: string | null;
          token_received_at?: string | null;
          activated_at?: string | null;
          paid_at?: string | null;
          expires_at?: string | null;
          created_at?: string;
          meta?: Json | null;
        };
        Update: Partial<Database["public"]["Tables"]["orders"]["Insert"]>;
      };
      chat_sessions: {
        Relationships: [];
        Row: {
          id: string;
          user_id: string | null;
          site_id: string | null;
          type: string;
          status: ChatSessionStatus;
          staff_peer_id: string | null;
          first_message_at: string | null;
          last_operator_reply_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          site_id?: string | null;
          type?: string;
          status?: ChatSessionStatus;
          staff_peer_id?: string | null;
          first_message_at?: string | null;
          last_operator_reply_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["chat_sessions"]["Insert"]>;
      };
      chat_messages: {
        Relationships: [];
        Row: {
          id: string;
          session_id: string;
          sender_id: string | null;
          sender_type: ChatSenderType;
          content: string;
          attachments: Json | null;
          is_read: boolean;
          is_auto_reply: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          sender_id?: string | null;
          sender_type: ChatSenderType;
          content: string;
          attachments?: Json | null;
          is_read?: boolean;
          is_auto_reply?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["chat_messages"]["Insert"]>;
      };
      reviews: {
        Relationships: [];
        Row: {
          id: string;
          site_id: string | null;
          telegram_message_id: number | null;
          telegram_chat_id: number | null;
          author_name: string | null;
          author_username: string | null;
          author_avatar_url: string | null;
          content: string;
          media_urls: Json | null;
          original_url: string | null;
          telegram_date: string | null;
          status: ReviewStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          site_id?: string | null;
          telegram_message_id?: number | null;
          telegram_chat_id?: number | null;
          author_name?: string | null;
          author_username?: string | null;
          author_avatar_url?: string | null;
          content: string;
          media_urls?: Json | null;
          original_url?: string | null;
          telegram_date?: string | null;
          status?: ReviewStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["reviews"]["Insert"]>;
      };
      site_settings: {
        Relationships: [];
        Row: {
          key: string;
          value: Json;
          updated_at: string;
        };
        Insert: {
          key: string;
          value: Json;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["site_settings"]["Insert"]>;
      };
      sites: {
        Relationships: [];
        Row: {
          id: string;
          slug: string;
          brand_name: string;
          product_type: string;
          support_telegram: string | null;
          support_email: string | null;
          primary_color: string | null;
          accent_color: string | null;
          seo_title: string | null;
          seo_description: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          brand_name: string;
          product_type: string;
          support_telegram?: string | null;
          support_email?: string | null;
          primary_color?: string | null;
          accent_color?: string | null;
          seo_title?: string | null;
          seo_description?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["sites"]["Insert"]>;
      };
      notifications: {
        Relationships: [];
        Row: {
          id: string;
          site_id: string | null;
          recipient_user_id: string | null;
          recipient_role: string | null;
          type: NotificationType;
          title: string;
          message: string;
          entity_type: string | null;
          entity_id: string | null;
          is_read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          site_id?: string | null;
          recipient_user_id?: string | null;
          recipient_role?: string | null;
          type: NotificationType;
          title: string;
          message: string;
          entity_type?: string | null;
          entity_id?: string | null;
          is_read?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["notifications"]["Insert"]>;
      };
      email_notification_settings: {
        Relationships: [];
        Row: {
          site_slug: string;
          settings: Json;
          updated_at: string;
        };
        Insert: {
          site_slug: string;
          settings?: Json;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["email_notification_settings"]["Insert"]>;
      };
      email_notification_logs: {
        Relationships: [];
        Row: {
          id: string;
          site_slug: string;
          recipient_user_id: string | null;
          recipient_email: string;
          recipient_role: string | null;
          event_type: string;
          related_entity_type: string | null;
          related_entity_id: string | null;
          subject: string;
          preview: string | null;
          status: string;
          error_message: string | null;
          dedupe_key: string | null;
          sent_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          site_slug: string;
          recipient_user_id?: string | null;
          recipient_email: string;
          recipient_role?: string | null;
          event_type: string;
          related_entity_type?: string | null;
          related_entity_id?: string | null;
          subject: string;
          preview?: string | null;
          status?: string;
          error_message?: string | null;
          dedupe_key?: string | null;
          sent_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["email_notification_logs"]["Insert"]>;
      };
      user_site_access: {
        Relationships: [];
        Row: {
          id: string;
          user_id: string;
          site_id: string;
          role: UserRole;
          granted_by: string | null;
          created_at: string;
          can_receive_email_notifications: boolean;
        };
        Insert: {
          id?: string;
          user_id: string;
          site_id: string;
          role: UserRole;
          granted_by?: string | null;
          created_at?: string;
          can_receive_email_notifications?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["user_site_access"]["Insert"]>;
      };
      promocodes: {
        Relationships: [];
        Row: {
          id: string;
          code: string;
          discount_type: "percent" | "fixed";
          discount_value: number;
          plan_ids: string[] | null;
          max_uses: number | null;
          uses_count: number;
          valid_from: string | null;
          valid_until: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          discount_type: "percent" | "fixed";
          discount_value: number;
          plan_ids?: string[] | null;
          max_uses?: number | null;
          uses_count?: number;
          valid_from?: string | null;
          valid_until?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["promocodes"]["Insert"]>;
      };
      landing_discounts: {
        Relationships: [];
        Row: {
          id: string;
          name: string;
          discount_type: "percent" | "fixed";
          discount_value: number;
          applies_to: string;
          valid_from: string | null;
          valid_until: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          discount_type: "percent" | "fixed";
          discount_value: number;
          applies_to?: string;
          valid_from?: string | null;
          valid_until?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["landing_discounts"]["Insert"]>;
      };
      role_audit: {
        Relationships: [];
        Row: {
          id: string;
          actor_id: string | null;
          target_id: string | null;
          action: string;
          payload: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_id?: string | null;
          target_id?: string | null;
          action: string;
          payload?: Json | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["role_audit"]["Insert"]>;
      };
      scheduled_email_jobs: {
        Relationships: [];
        Row: {
          id: string;
          site_slug: string;
          order_id: string;
          event_type: string;
          recipient_email: string;
          scheduled_at: string;
          status: string;
          dedupe_key: string | null;
          metadata: Json | null;
          created_at: string;
          sent_at: string | null;
        };
        Insert: {
          id?: string;
          site_slug: string;
          order_id: string;
          event_type?: string;
          recipient_email: string;
          scheduled_at: string;
          status?: string;
          dedupe_key?: string | null;
          metadata?: Json | null;
          created_at?: string;
          sent_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["scheduled_email_jobs"]["Insert"]>;
      };
      email_campaign_logs: {
        Relationships: [];
        Row: {
          id: string;
          campaign_id: string;
          site_slug: string;
          recipient_email: string;
          order_id: string | null;
          status: string;
          error_message: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          campaign_id: string;
          site_slug: string;
          recipient_email: string;
          order_id?: string | null;
          status: string;
          error_message?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["email_campaign_logs"]["Insert"]>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
