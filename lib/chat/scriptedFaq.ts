/** Ответы для Subs Store (Spotify Premium) — те же кнопки, что OPERATOR_CHAT_QUICK_REPLIES */
const SUBS_FAQ_OVERRIDES: Record<string, string> = {
  "Как оформить заказ?":
    "Выберите тариф на странице Spotify Premium, оплатите картой РФ или СБП и укажите email для активации. Обычно подключение занимает 5–15 минут после оплаты.",
  "Когда будет готова подписка?":
    "После оплаты мы активируем Spotify Premium на ваш аккаунт. Обычно это 5–15 минут в рабочее время. Статус смотрите в разделе «Заказы» в личном кабинете.",
  "Есть ли гарантия на подписку?":
    "Да. На весь срок подписки действует гарантия: если проблема на нашей стороне — восстановим доступ или оформим возврат по правилам оферты.",
  "Какие способы оплаты?":
    "Оплата картой банка РФ и через СБП на странице оформления заказа Subs Store.",
  "Как связаться с поддержкой?":
    "Вы уже в чате поддержки Subs Store. Можно также написать в Telegram: @subs_support (если указан на сайте). Оператор подключится при необходимости.",
  "Можно ли оплатить картой РФ?":
    "Да. Оплата картой банка РФ и через СБП доступна на странице оформления заказа Subs Store.",
};

const FAQ_SCRIPTED_ANSWERS: Record<string, string> = {
  ...SUBS_FAQ_OVERRIDES,
  "Как оформить заказ?":
    "Выберите тариф, оплатите удобным способом и отправьте данные для активации. Обычно подключение занимает 5-15 минут.",
  "Сколько стоит подписка?":
    "Актуальные цены смотрите в разделе тарифов на сайте. Если нужно, подберем лучший вариант под ваш бюджет.",
  "Есть ли гарантия на подписку?":
    "Да, гарантия действует на весь срок. Если по нашей стороне возникает проблема, мы восстанавливаем подписку или делаем возврат.",
  "Как активировать ChatGPT Plus?":
    "После оплаты отправляете данные для активации, и мы подключаем подписку. Обычно это занимает до 15 минут.",
  "Чем отличается Plus от Pro?":
    "Plus подходит для ежедневных задач. Pro рассчитан на более высокую нагрузку и профессиональные сценарии.",
  "Как передать данные для активации?":
    "Пароль не запрашиваем. Если нужно — отправьте данные сессии по инструкции на сайте только в чат GPT STORE.",
  "Когда будет готова подписка?":
    "Обычно активация занимает 5-15 минут после оплаты и передачи данных. Цифровой доступ приходит в чат или на email — физической доставки нет.",
  "Можно ли оплатить картой РФ?":
    "Да. Оплата доступна через Pally, СБП и банковскую карту РФ.",
  "Работаете ли вы в выходные?":
    "Да, поддержка работает каждый день, включая выходные.",
  "Как связаться с поддержкой?":
    "Вы можете написать прямо в этот чат или в Telegram: t.me/subs_support.",
  "Что делать если не работает вход?":
    "Проверьте email и повторите вход. Если проблема сохраняется, напишите нам в чат — поможем вручную.",
  "Есть ли скидки на продление?":
    "По продлению часто есть выгодные условия. Напишите в чат, и мы предложим подходящий вариант.",
  "Как отменить автопродление?":
    "Автопродление отключается в настройках аккаунта OpenAI в разделе подписки.",
  "Где посмотреть статус заказа?":
    "Статус можно уточнить в чате поддержки по вашему email или номеру заказа.",
  "Как оформить возврат средств?":
    "Напишите в чат поддержки, укажите email и детали заказа — проверим ситуацию и подскажем следующий шаг.",
  "Где мой заказ?":
    "Актуальный статус — в разделе «Мои заказы» в личном кабинете. Если записи нет или что-то не сходится, напишите сюда номер заказа или email оплаты — оператор проверит.",
  "Как оформить возврат?":
    "Оформите запрос здесь же: укажите номер заказа, email и причину. Мы проверим условия возврата по оферте и ответим в этом чате.",
  "Какие способы оплаты?":
    "Оплата доступна через Pally, СБП и банковскую карту РФ. На странице оплаты вы перейдёте к выбору конкретного способа.",
  "Как изменить данные в заказе?":
    "Если активация ещё не завершена — напишите номер заказа и какие данные нужно поправить. После выдачи доступа изменения могут быть ограничены правилами поставщика; подскажем, что возможно.",
};

export function normalizeFaqKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const NORMALIZED_FAQ_ANSWERS: Record<string, string> = Object.fromEntries(
  Object.entries(FAQ_SCRIPTED_ANSWERS).map(([question, answer]) => [normalizeFaqKey(question), answer]),
);

/** Частичное совпадение по ключевым словам (свободный текст клиента). */
const FAQ_KEYWORD_RULES: { test: (n: string) => boolean; answer: string }[] = [
  {
    test: (n) => /где.*заказ|статус.*заказ|мой заказ|номер заказ/.test(n),
    answer: FAQ_SCRIPTED_ANSWERS["Где мой заказ?"]!,
  },
  {
    test: (n) => /возврат|вернут|refund/.test(n),
    answer: FAQ_SCRIPTED_ANSWERS["Как оформить возврат?"]!,
  },
  {
    test: (n) => /оплат|способ.*плат|карт|сбп|pally/.test(n),
    answer: FAQ_SCRIPTED_ANSWERS["Какие способы оплаты?"]!,
  },
  {
    test: (n) => /срок|когда|сколько.*жд|активац|подключ/.test(n),
    answer: FAQ_SCRIPTED_ANSWERS["Когда будет готова подписка?"]!,
  },
  {
    test: (n) => /гарант/.test(n),
    answer: FAQ_SCRIPTED_ANSWERS["Есть ли гарантия на подписку?"]!,
  },
  {
    test: (n) => /оформ|купить|заказать|тариф/.test(n),
    answer: FAQ_SCRIPTED_ANSWERS["Как оформить заказ?"]!,
  },
  {
    test: (n) => /telegram|телеграм|связ|поддерж|оператор/.test(n),
    answer: FAQ_SCRIPTED_ANSWERS["Как связаться с поддержкой?"]!,
  },
  {
    test: (n) => /рф|росси|карт.*рф/.test(n),
    answer: FAQ_SCRIPTED_ANSWERS["Можно ли оплатить картой РФ?"]!,
  },
];

export function getScriptedFaqAnswer(text: string): string | null {
  const normalized = normalizeFaqKey(text);
  if (!normalized) return null;

  const exact = NORMALIZED_FAQ_ANSWERS[normalized];
  if (exact) return exact;

  for (const rule of FAQ_KEYWORD_RULES) {
    if (rule.test(normalized)) return rule.answer;
  }

  return null;
}

/** Текст автоответа для чата поддержки (Subs / GPT). */
export function resolveSupportAutoReply(content: string, siteSlug?: "subs-store" | "gpt-store"): string {
  const faq = getScriptedFaqAnswer(content);
  if (faq) return faq;

  const handoff = getSupportHandoffAutoReply(content);
  if (handoff) return handoff;

  if (siteSlug === "subs-store") {
    return "Не нашёл готовый ответ. Опишите вопрос подробнее — оператор Subs Store подключится в ближайшее время (обычно 5–15 минут).";
  }

  return "Не поняла вопроса. Перевожу вас на поддержку — оператор подключится в ближайшее время.";
}

/** Не слать автоответ, если оператор недавно писал в этот тред. */
export function shouldSkipAutoReplyAfterStaffMessage(lastStaffMessageAt: string | null, windowMs = 20 * 60 * 1000): boolean {
  if (!lastStaffMessageAt) return false;
  const t = new Date(lastStaffMessageAt).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t < windowMs;
}

const SUPPORT_HANDOFF_PATTERNS = [
  /связа\w*\s+с\s+поддержк\w*/i,
  /нуж\w*\s+поддержк\w*/i,
  /позов\w*\s+оператор\w*/i,
  /подключ\w*\s+оператор\w*/i,
  /жив\w*\s+оператор\w*/i,
];

export function getSupportHandoffAutoReply(text: string): string | null {
  const normalized = normalizeFaqKey(text);
  const matched = SUPPORT_HANDOFF_PATTERNS.some((pattern) => pattern.test(normalized));
  if (!matched) return null;

  return "Принято. Оператор подключается к диалогу, пожалуйста, ожидайте. Обычно отвечаем в течение 5-15 минут.";
}

export const FAQ_SUGGESTIONS = [
  "Как оформить заказ?",
  "Когда будет готова подписка?",
  "Можно ли оплатить картой РФ?",
  "Есть ли гарантия на подписку?",
  "Как передать данные для активации?",
];

/**
 * Кнопки над полем ввода в чате с оператором: `message` должен совпадать с ключом в FAQ_SCRIPTED_ANSWERS.
 */
/** Задержка перед показом автоответа на кнопку FAQ (мс) — ощущение «печатает 1–2 сек». */
export const FAQ_QUICK_REPLY_DELAY_MS = 1100;

export function isQuickReplyFaqMessage(text: string): boolean {
  const key = normalizeFaqKey(text);
  return OPERATOR_CHAT_QUICK_REPLIES.some((q) => normalizeFaqKey(q.message) === key);
}

/** Мгновенный ответ для кнопок FAQ (без ожидания сервера). */
export function getInstantFaqAnswer(
  questionText: string,
  siteSlug: "subs-store" | "gpt-store" = "gpt-store",
): string | null {
  const normalized = normalizeFaqKey(questionText);
  if (!normalized) return null;

  if (siteSlug === "subs-store") {
    for (const [question, answer] of Object.entries(SUBS_FAQ_OVERRIDES)) {
      if (normalizeFaqKey(question) === normalized) return answer;
    }
  }

  return getScriptedFaqAnswer(questionText);
}

export const OPERATOR_CHAT_QUICK_REPLIES: { label: string; message: string }[] = [
  { label: "Где мой заказ?", message: "Где мой заказ?" },
  { label: "Возврат", message: "Как оформить возврат?" },
  { label: "Способы оплаты", message: "Какие способы оплаты?" },
  { label: "Сроки активации", message: "Когда будет готова подписка?" },
  { label: "Гарантия", message: "Есть ли гарантия на подписку?" },
  { label: "Оплата из РФ", message: "Можно ли оплатить картой РФ?" },
  { label: "Оформить заказ", message: "Как оформить заказ?" },
  { label: "Связь и Telegram", message: "Как связаться с поддержкой?" },
];

