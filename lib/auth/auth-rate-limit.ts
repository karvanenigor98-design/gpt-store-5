export function parseAuthRetrySeconds(message: string): number | null {
  const m = message.match(/after\s+(\d+)\s*seconds?/i);
  if (m) return Number(m[1]);
  return null;
}

export function isAuthRateLimitError(message: string | null | undefined): boolean {
  const lower = (message ?? "").toLowerCase();
  if (!lower) return false;
  return (
    parseAuthRetrySeconds(lower) != null ||
    lower.includes("rate limit") ||
    lower.includes("too many") ||
    lower.includes("over_request") ||
    lower.includes("for security purposes")
  );
}

export function authRateLimitUserMessage(message: string): string {
  const sec = parseAuthRetrySeconds(message);
  if (sec != null) {
    return `Слишком частые попытки входа. Подождите ${sec} сек. и повторите.`;
  }
  return "Слишком частые попытки входа. Подождите около минуты и повторите.";
}
