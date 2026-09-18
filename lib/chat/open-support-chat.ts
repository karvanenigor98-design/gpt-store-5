export const GPT_OPEN_SUPPORT_CHAT = "gpt-store:open-support-chat";

export function openGptSupportChat(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(GPT_OPEN_SUPPORT_CHAT));
}
