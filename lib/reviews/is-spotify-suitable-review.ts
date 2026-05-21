const EXCLUDE_PATTERN =
  /(chat\s*gpt|чат\s*gpt|gpt[-\s]?(4|4o|5|3|5\.5)|\bgpt\b|openai|claude|midjourney|нейросет|dall[\s-]?e|gemini|copilot|sora\b|видео\s*генер|анализ\s+данн|написывать\s+текст|тексты\s+и\s+делать|подписк[аи]\s+на\s+gpt|ии\s+ассистент|нейро\b|\bбот\b|\bbot\b)/i;

const SPOTIFY_HINT_PATTERN =
  /(spotify|спотифай|premium\s*spotify|spotify\s*premium|музык|плейлист|офлайн|без\s+реклам|иностранн.{0,12}карт|карт.{0,12}рф|оплат.{0,8}рубл|subs\s*store|семейн|для\s+двоих|активац|подключил.{0,12}premium|подписк.{0,12}spotify|спотиф|слушаю)/i;

const GENERIC_SUB_PATTERN = /(premium|премиум|подписк|музык|аккаунт|активац|подключ)/i;

export function isSpotifySuitableReview(content: string): boolean {
  const text = content.trim();
  if (text.length < 20) return false;
  if (EXCLUDE_PATTERN.test(text)) return false;
  if (SPOTIFY_HINT_PATTERN.test(text)) return true;
  return GENERIC_SUB_PATTERN.test(text) && !/\b(gpt|бот|bot|чат\s*gpt)\b/i.test(text);
}
