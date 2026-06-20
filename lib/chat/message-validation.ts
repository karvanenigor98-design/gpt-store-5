export const MAX_CHAT_MESSAGE_LENGTH = 100_000;

export function isBlankMessage(value: string): boolean {
  return value.trim().length === 0;
}

export function getMessageLengthError(value: string): string | null {
  if (value.length > MAX_CHAT_MESSAGE_LENGTH) {
    return `Максимум ${MAX_CHAT_MESSAGE_LENGTH} символов`;
  }
  return null;
}

export function validateMessageText(value: string): string | null {
  if (isBlankMessage(value)) return "Введите сообщение";
  return getMessageLengthError(value);
}
