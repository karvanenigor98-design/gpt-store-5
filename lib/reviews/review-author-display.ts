import {
  isBadAuthorLabel,
  sanitizeReviewAuthorName,
  sanitizeReviewContent,
} from "@/lib/reviews/review-sanitize";

const SERVICE_AUTHOR_PATTERN =
  /(наши отзывы|gpt store|subs store|spotify premium|digital\s*sub)/i;

const CHANNEL_MENTION_PATTERN = /digital_sub|subs_store|spotify|reviews/i;

function titleCaseUsername(username: string): string {
  const u = username.replace(/^@+/, "");
  if (!u) return "Клиент";
  return u.charAt(0).toUpperCase() + u.slice(1).toLowerCase();
}

export function extractClientUsername(content: string): string | null {
  const match = content.match(/клиент[:#]?\s*@([\w_]+)/i);
  return match?.[1] ?? null;
}

/** Любой @ник в тексте, кроме служебных каналов. */
export function extractMentionUsername(content: string): string | null {
  const mentions = [...content.matchAll(/@([a-zA-Z0-9_]{3,32})/g)];
  for (const m of mentions) {
    const u = m[1];
    if (!u || CHANNEL_MENTION_PATTERN.test(u)) continue;
    return u;
  }
  return null;
}

export function resolveReviewAuthorDisplay(input: {
  authorName: string;
  authorUsername?: string | null;
  content?: string;
}): { displayName: string; username: string | null } {
  let username = input.authorUsername?.replace(/^@+/, "").trim() || null;
  let displayName = input.authorName.trim() || "Клиент";
  const content = input.content ?? "";

  const fromClientTag = extractClientUsername(content);
  const fromMention = extractMentionUsername(content);
  const resolvedUsername = fromClientTag ?? username ?? fromMention;

  if (SERVICE_AUTHOR_PATTERN.test(displayName) || isBadAuthorLabel(displayName)) {
    if (resolvedUsername && !isBadAuthorLabel(resolvedUsername)) {
      username = resolvedUsername;
      displayName = titleCaseUsername(resolvedUsername);
    } else {
      displayName = "Клиент";
    }
  } else if (username && SERVICE_AUTHOR_PATTERN.test(displayName)) {
    displayName = titleCaseUsername(username);
  }

  displayName = sanitizeReviewAuthorName({
    authorName: displayName,
    authorUsername: username,
    seed: username || displayName,
  });

  return { displayName, username };
}

export function isServiceAuthorName(name: string): boolean {
  return SERVICE_AUTHOR_PATTERN.test(name.trim()) || isBadAuthorLabel(name);
}

export { sanitizeReviewContent };
