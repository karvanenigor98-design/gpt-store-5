import { hasGptStoreAuthUserByEmail } from "@/lib/auth/gptAuthByEmail";
import { normalizeEmailForAuth } from "@/lib/auth/normalizeEmail";

/** Частые опечатки при входе в GPT STORE (см. дубликаты в Supabase Auth). */
const EMAIL_TYPOS: Array<{ typed: string; registered: string }> = [
  { typed: "nbuzanov0@mail.ru", registered: "nbuzanov@mail.ru" },
];

export async function suggestGptRegisteredEmail(typedEmail: string): Promise<string | null> {
  const normalized = normalizeEmailForAuth(typedEmail);
  if (!normalized) return null;

  if (await hasGptStoreAuthUserByEmail(normalized)) {
    return null;
  }

  for (const row of EMAIL_TYPOS) {
    if (normalizeEmailForAuth(row.typed) !== normalized) continue;
    const candidate = normalizeEmailForAuth(row.registered);
    if (candidate !== normalized && (await hasGptStoreAuthUserByEmail(candidate))) {
      return candidate;
    }
  }

  if (normalized.includes("nbuzanov0@")) {
    const alt = normalized.replace("nbuzanov0@", "nbuzanov@");
    if (alt !== normalized && (await hasGptStoreAuthUserByEmail(alt))) {
      return alt;
    }
  }

  if (normalized.includes("nbuzanov@") && !normalized.includes("nbuzanov0@")) {
    const alt = normalized.replace("nbuzanov@", "nbuzanov0@");
    if (alt !== normalized && (await hasGptStoreAuthUserByEmail(alt))) {
      return alt;
    }
  }

  return null;
}

export function buildGptLoginErrorMessage(params: {
  email: string;
  inGpt: boolean;
  suggestedEmail: string | null;
}): string {
  const { email, inGpt, suggestedEmail } = params;

  if (!inGpt && suggestedEmail) {
    return `В GPT STORE нет аккаунта «${email}». Похоже, вы регистрировались как «${suggestedEmail}» — войдите с этим email или сбросьте пароль на /reset-password`;
  }

  if (!inGpt) {
    return `Email «${email}» не найден в GPT STORE. Зарегистрируйтесь или проверьте опечатку. Восстановление пароля: /reset-password`;
  }

  return "Неправильный пароль";
}
