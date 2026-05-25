const GPT_HINT =
  /(chat\s*gpt|чат\s*gpt|gpt[-\s]?(4|4o|5|3|5\.5)|\bgpt\b|openai|claude|нейросет|подписк[аи]\s+на\s+gpt|ии\s+ассистент)/i;

const SPOTIFY_ONLY =
  /(spotify|спотифай|premium\s*spotify|spotify\s*premium|подписк[аи]\s+spotify|duo\s+на\s+\d+\s+месяц)/i;

export function isGptSuitableReview(content: string): boolean {
  const text = content.trim();
  if (text.length < 12) return false;
  if (GPT_HINT.test(text)) return true;
  if (SPOTIFY_ONLY.test(text) && !GPT_HINT.test(text)) return false;
  if (/\b(бот|bot|telegram)\b/i.test(text) && !GPT_HINT.test(text)) return false;
  return text.length >= 20;
}
