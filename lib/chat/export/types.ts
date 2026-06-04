import type { ChatMessage } from "@/types";
import type { SiteSlug } from "@/lib/sites";

export type ExportFormat = "html" | "zip" | "attachments";

export type ExportAttachment = {
  url: string;
  type: string;
  name: string;
  messageId: string;
  zipPath?: string;
};

export type ExportAuthor = {
  roleLabel: string;
  email: string | null;
};

export type ExportMessage = ChatMessage & {
  author: ExportAuthor;
  attachmentsList: ExportAttachment[];
};

export type ExportMeta = {
  siteSlug: SiteSlug;
  storeName: string;
  chatId: string;
  clientEmail: string | null;
  staffEmail: string | null;
  exportDate: string;
  periodLabel: string;
  dateFrom: string | null;
  dateTo: string | null;
  messageCount: number;
  attachmentCount: number;
};

export type ExportPayload = {
  meta: ExportMeta;
  messages: ExportMessage[];
};

export type ExportAccessContext = {
  userId: string;
  userEmail: string | null;
  userRole: "client" | "operator" | "admin";
  siteSlug: SiteSlug;
  chatId: string;
  isStaff: boolean;
};
