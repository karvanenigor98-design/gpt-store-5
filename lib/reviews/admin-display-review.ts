/** Имя/ник как в админке «Опубликованы» — без подмены на случайные «Алексей М.». */

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

export function formatReviewAuthorLikeAdmin(input: {
  authorName: string | null;
  authorUsername: string | null;
}): { authorName: string; authorUsername: string | null; initials: string } {
  const username = input.authorUsername?.replace(/^@+/, "").trim() || null;
  const rawName = (input.authorName ?? "").trim();
  /** Как в админке: имя отдельно, @ник отдельно (не подставляем username в заголовок). */
  const authorName = rawName || "Аноним";
  const initialsSource = authorName !== "Аноним" ? authorName : username || authorName;

  return {
    authorName,
    authorUsername: username,
    initials: initialsFromName(initialsSource),
  };
}

export function normalizePublishedReviewContent(content: string): string {
  return content.trim();
}
