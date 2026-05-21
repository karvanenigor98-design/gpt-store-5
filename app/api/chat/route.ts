import { NextRequest, NextResponse } from "next/server";
import { getStoreConfig } from "@/lib/store-config";

type ChatRole = "user" | "assistant";

// GPT STORE topics
type GptTopic =
  | "how_order"
  | "price"
  | "guarantee"
  | "activate_plus"
  | "plus_vs_pro"
  | "token_transfer"
  | "ready_when"
  | "pay_rf"
  | "work_weekend"
  | "contact"
  | "login_issue"
  | "renewal_discount"
  | "cancel_autorenew"
  | "order_status"
  | "refund";

// Subs Store (Spotify) topics
type SpotifyTopic =
  | "sp_activation"
  | "sp_activation_time"
  | "sp_data_needed"
  | "sp_vpn"
  | "sp_after_payment"
  | "sp_subscription_lost"
  | "sp_guarantee"
  | "sp_multi_device"
  | "sp_contact"
  | "sp_price"
  | "sp_how_order"
  | "sp_refund"
  | "sp_login_issue";

type KnownTopic = GptTopic | SpotifyTopic;

interface ChatMessage {
  role: ChatRole;
  content: string;
}

interface ChatRequestBody {
  messages?: ChatMessage[];
  clientHasAccount?: boolean;
  site?: string;
}

const SUPPORT_TELEGRAM_GPT = "t.me/subrfmanager";
const SUPPORT_TELEGRAM_SUBS = "t.me/subs_support";
const SUPPORT_TELEGRAM = SUPPORT_TELEGRAM_GPT;

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasAny(text: string, words: string[]): boolean {
  return words.some((word) => text.includes(word));
}

function shouldTransferToOperator(text: string): boolean {
  return hasAny(text, [
    "хочу оплатить",
    "как купить",
    "давай оформим",
    "готов оплатить",
    "оформляем",
    "беру",
    "переведи на оператора",
    "позови оператора",
    "нужен оператор",
  ]);
}

function detectKnownTopic(text: string): KnownTopic | null {
  if (hasAny(text, ["как оформить заказ", "как заказать", "как купить", "оформить"])) return "how_order";
  if (hasAny(text, ["сколько стоит", "цена", "стоимость", "тариф"])) return "price";
  if (hasAny(text, ["гарантия", "гарантии"])) return "guarantee";
  if (hasAny(text, ["как активировать", "активировать chatgpt plus", "активация plus"])) return "activate_plus";
  if (hasAny(text, ["чем отличается plus от pro", "plus от pro", "plus или pro"])) return "plus_vs_pro";
  if (hasAny(text, ["как передать данные", "отправить токен", "передать токен", "токен"])) return "token_transfer";
  if (hasAny(text, ["когда будет готова", "когда готово", "когда будет подписка"])) return "ready_when";
  if (hasAny(text, ["оплатить картой рф", "карта рф", "сбп", "оплата"])) return "pay_rf";
  if (hasAny(text, ["работаете ли вы в выходные", "в выходные", "график работы"])) return "work_weekend";
  if (hasAny(text, ["как связаться с поддержкой", "связаться с поддержкой", "оператор", "telegram"])) return "contact";
  if (hasAny(text, ["не работает вход", "не могу войти", "проблема со входом", "логин"])) return "login_issue";
  if (hasAny(text, ["скидки на продление", "скидка на продление", "продление"])) return "renewal_discount";
  if (hasAny(text, ["как отменить автопродление", "отменить автопродление", "автопродление"])) return "cancel_autorenew";
  if (hasAny(text, ["где посмотреть статус заказа", "статус заказа", "мой заказ"])) return "order_status";
  if (hasAny(text, ["как оформить возврат", "возврат средств", "вернуть деньги"])) return "refund";
  return null;
}

// ── Subs Store (Spotify) topic detection ─────────────────────────────────────

function detectSpotifyTopic(text: string): SpotifyTopic | null {
  if (hasAny(text, ["как происходит активация", "как активировать", "процесс активации", "как подключить"])) return "sp_activation";
  if (hasAny(text, ["сколько времени", "как долго", "когда готово", "когда активируют", "время активации"])) return "sp_activation_time";
  if (hasAny(text, ["какие данные нужны", "что нужно", "нужен пароль", "нужна почта", "данные для активации"])) return "sp_data_needed";
  if (hasAny(text, ["нужен ли vpn", "нужен vpn", "без vpn", "vpn"])) return "sp_vpn";
  if (hasAny(text, ["что делать после оплаты", "оплатил что дальше", "оплатила что делать"])) return "sp_after_payment";
  if (hasAny(text, ["подписка слетела", "перестала работать", "слетела подписка", "отключили подписку", "пропала подписка"])) return "sp_subscription_lost";
  if (hasAny(text, ["гарантия", "гарантии", "если слетит"])) return "sp_guarantee";
  if (hasAny(text, ["на телефоне", "на пк", "на компьютере", "несколько устройств", "все устройства"])) return "sp_multi_device";
  if (hasAny(text, ["оператор", "поддержка", "связаться", "помогите", "telegram", "телеграм"])) return "sp_contact";
  if (hasAny(text, ["сколько стоит", "цена", "стоимость", "тариф", "цены"])) return "sp_price";
  if (hasAny(text, ["как заказать", "как купить", "оформить", "подключить premium", "как оформить"])) return "sp_how_order";
  if (hasAny(text, ["возврат", "вернуть деньги", "не работает", "претензия"])) return "sp_refund";
  if (hasAny(text, ["не могу войти", "проблема со входом", "не входит", "ошибка входа"])) return "sp_login_issue";
  return null;
}

function getSpotifyTopicFromHistory(messages: ChatMessage[]): SpotifyTopic | null {
  const userTexts = messages
    .filter((m) => m.role === "user")
    .map((m) => normalizeText(m.content));
  const last = userTexts[userTexts.length - 1] ?? "";
  const direct = detectSpotifyTopic(last);
  if (direct) return direct;
  for (let i = userTexts.length - 2; i >= 0; i--) {
    const t = detectSpotifyTopic(userTexts[i] ?? "");
    if (t) return t;
  }
  return null;
}

function spotifyTopicReply(topic: SpotifyTopic, previousAssistant: string): string {
  const variants: Record<SpotifyTopic, string[]> = {
    sp_activation: [
      "🎵 Активация простая: после оплаты специалист Subs Store свяжется с вами через чат или Telegram, уточнит нужные данные и поможет завершить подключение.\nОбычно это занимает 5–30 минут.",
      "✅ После оплаты пишите в чат — специалист лично проведёт вас по всем шагам активации Spotify Premium. Пароль обычно не нужен.",
    ],
    sp_activation_time: [
      "⏱️ Обычно активация занимает от 5 до 30 минут после оплаты. В нерабочее время — до 2–3 часов.\nСтатус можно отслеживать в кабинете или написав в чат.",
      "⌛ Стандартное время подключения — 10–15 минут. Если вы заказали в часы пик, может занять немного дольше — специалист напишет вам лично.",
    ],
    sp_data_needed: [
      "📧 Для активации нужна только ваша почта Spotify. Пароль в большинстве случаев не нужен.\nСпециалист уточнит детали в чате после оплаты.",
      "🔑 Как правило, нужна почта Spotify-аккаунта. Иногда — дополнительные данные, которые специалист запросит лично. Пароль передавать не нужно.",
    ],
    sp_vpn: [
      "🌐 Нет, VPN не нужен! Spotify Premium подключается напрямую и работает в России без VPN.\nПосле активации слушайте музыку как обычно.",
      "✅ VPN для работы Spotify Premium не требуется. Подписка работает стабильно на всех устройствах в России.",
    ],
    sp_after_payment: [
      "💳 После оплаты: напишите в чат поддержки или дождитесь сообщения от специалиста. Он запросит почту и поможет завершить подключение за 5–30 минут.",
      "📩 Сразу после оплаты специалист Subs Store свяжется с вами в чате. Если не написал в течение 30 минут — напишите сами, мы ответим быстро.",
    ],
    sp_subscription_lost: [
      "🛡️ Если подписка слетела — пишите в чат или Telegram. Мы разберёмся и восстановим доступ. Гарантия действует на весь срок подписки.",
      "🔧 Такое бывает редко, но мы поможем! Напишите в чат, опишите проблему — восстановим или продлим подписку по гарантии.",
    ],
    sp_guarantee: [
      "🛡️ Гарантия действует на весь оплаченный срок. Если подписка слетела по нашей вине — восстановим бесплатно или вернём деньги.\nОтвечаем в течение нескольких часов.",
      "✅ Гарантируем работу Spotify Premium весь оплаченный период. При любых проблемах — решаем за свой счёт.",
    ],
    sp_multi_device: [
      "📱💻 Spotify Premium работает на всех ваших устройствах: смартфон, ПК, планшет, Smart TV. Достаточно войти в аккаунт.",
      "✅ Да, подписка работает на всех устройствах одновременно. Вы можете слушать музыку офлайн, без рекламы на телефоне и компьютере.",
    ],
    sp_contact: [
      `💬 Напишите в чат прямо здесь или в Telegram: ${SUPPORT_TELEGRAM_SUBS}. Отвечаем быстро, обычно в течение нескольких минут.`,
      `🤝 Наш оператор готов помочь. Используйте этот чат или Telegram ${SUPPORT_TELEGRAM_SUBS} — там обычно ещё быстрее.`,
    ],
    sp_price: [
      "💰 Актуальные цены на Spotify Premium смотрите на странице тарифов. Есть Индивидуальный, Duo (для двоих) и Семейный тарифы.\nМогу помочь выбрать подходящий?",
      "💳 Цены зависят от выбранного тарифа и срока. Напишите, сколько человек будет слушать — подберём самый выгодный вариант.",
    ],
    sp_how_order: [
      "🎵 Всё просто: выберите тариф на странице тарифов → оплатите → напишите в чат → специалист активирует Spotify Premium для вас.\nОбычно занимает 15 минут.",
      "✅ Шаги: 1) Выберите тариф. 2) Оплатите. 3) Специалист свяжется и активирует подписку. Готово!",
    ],
    sp_refund: [
      "↩️ Если подписка не была активирована по нашей вине — делаем возврат. Напишите в чат с описанием ситуации, разберёмся быстро.",
      "🧾 Возврат возможен если активация не прошла по нашей стороне. Опишите проблему в чате — специалист проверит и даст ответ.",
    ],
    sp_login_issue: [
      "🔐 Если проблема со входом в Spotify — напишите в чат, специалист поможет разобраться. Обычно это решается быстро.",
      "🔎 Проблема со входом? Уточните, что именно не работает — специалист поможет восстановить доступ.",
    ],
  };
  return pickNonRepeatingVariant(variants[topic], previousAssistant);
}

function getTopicFromHistory(messages: ChatMessage[]): KnownTopic | null {
  const userTexts = messages
    .filter((message) => message.role === "user")
    .map((message) => normalizeText(message.content));

  const last = userTexts[userTexts.length - 1] ?? "";
  const direct = detectKnownTopic(last);
  if (direct) return direct;

  for (let i = userTexts.length - 2; i >= 0; i -= 1) {
    const topic = detectKnownTopic(userTexts[i] ?? "");
    if (topic) return topic;
  }
  return null;
}

function pickNonRepeatingVariant(variants: string[], previousAssistant: string): string {
  const prev = normalizeText(previousAssistant);
  for (const variant of variants) {
    if (normalizeText(variant) !== prev) return variant;
  }
  return variants[0] ?? "";
}

type ChatPriceSnapshot = {
  plusPrices: number[];
  proLine: string | null;
};

function formatRub(value: number): string {
  return value.toLocaleString("ru-RU");
}

async function loadChatPriceSnapshot(): Promise<ChatPriceSnapshot> {
  try {
    const cfg = await getStoreConfig();
    const plus = cfg.plans
      .filter((p) => p.productId === "chatgpt-plus")
      .map((p) => Number(p.price))
      .filter((n) => Number.isFinite(n) && n > 0)
      .sort((a, b) => a - b);

    const proParts = cfg.plans
      .filter((p) => p.productId === "chatgpt-pro")
      .map((p) => {
        const n = Number(p.price);
        if (!Number.isFinite(n) || n <= 0) return null;
        const cur = typeof p.currency === "string" ? p.currency : "₽";
        return `${n.toLocaleString("ru-RU")} ${cur}`;
      })
      .filter((x): x is string => Boolean(x));

    const proLine = proParts.length ? proParts.join(" · ") : null;

    return {
      plusPrices: plus,
      proLine,
    };
  } catch {
    return { plusPrices: [], proLine: null };
  }
}

function topicReply(topic: GptTopic, previousAssistant: string, prices: ChatPriceSnapshot): string {
  const plusList =
    prices.plusPrices.length > 0
      ? prices.plusPrices.map((p) => `${formatRub(p)} ₽`).join(" / ")
      : "по актуальной витрине";
  const proText = prices.proLine ?? "по актуальной витрине";

  const variants: Record<GptTopic, string[]> = {
    how_order: [
      "✨ Оформление простое: выбираете тариф, оплачиваете, передаете данные для активации, и мы подключаем подписку.\nОбычно это 5-15 минут.\nПодберем вам лучший вариант прямо сейчас?",
      "🧾 По шагам: 1) выбор тарифа, 2) оплата, 3) передача данных, 4) активация.\nВ среднем подключаем за ~15 минут.\nОформляем подходящий тариф?",
    ],
    price: [
      `💳 По ценам сейчас: Plus — ${plusList}, Pro — ${proText}.\nДля точной рекомендации ориентируемся на вашу нагрузку.\nЧто важнее: минимальная цена или скорость?`,
      `💰 Актуальные цены в тарифах: Plus — ${plusList}, Pro — ${proText}.\nПодскажите, как часто и для каких задач используете ChatGPT — помогу выбрать оптимально.`,
    ],
    guarantee: [
      "🛡️ Гарантия есть: при проблеме по нашей стороне помогаем восстановить доступ или оформляем возврат по условиям.\nОбычно отвечаем быстро, до 24 часов на обработку обращения.\nРассказать подробнее?",
      "✅ Гарантия действует при соблюдении инструкции подключения.\nВ большинстве случаев пароль не требуется; детали — в чате сайта GPT STORE.\nПродолжим и подберём тариф?",
    ],
    activate_plus: [
      "⚡ Для активации Plus: оплата → при необходимости данные сессии по инструкции в чате → подключение.\nСроки зависят от тарифа и очереди.\nПодключаем сейчас?",
      "🚀 После оплаты напишите в чат сайта GPT STORE — там же инструкция по данным. В большинстве случаев пароль не нужен; специалист уточнит, если потребуется что-то дополнительно.\nГотовы оформить?",
    ],
    plus_vs_pro: [
      "🤖 Plus — лучший баланс цены и возможностей для большинства задач.\nPro — для интенсивной ежедневной работы и максимальной производительности.\nУ вас нагрузка средняя или высокая?",
      "📌 Если пользуетесь умеренно — берите Plus, если много и ежедневно — Pro.\nМогу сразу дать точную рекомендацию.\nКак часто используете ChatGPT?",
    ],
    token_transfer: [
      "🔐 В большинстве случаев пароль не требуется. Иногда для подключения нужны данные сессии — их отправляют только в официальный чат сайта GPT STORE по инструкции.\nПосле подключения можно завершить активные сессии в ChatGPT.\nПоказать кратко шаги?",
      "🧩 Данные сессии нужны только для привязки подписки и могут давать доступ к сессии аккаунта — передавайте их только в чат GPT STORE.\nИнструкция на сайте, не на email.\nДать ссылку на шаги?",
    ],
    ready_when: [
      "⏱️ Обычно готово за 5-15 минут после оплаты и передачи данных.\nЕсли выбран приоритетный вариант, часто быстрее.\nЗапускаем подключение?",
      "⌛ После оплаты ориентир по времени — около 15 минут.\nСтатус можно отслеживать в чате.\nНачинаем оформление?",
    ],
    pay_rf: [
      "💸 Да. Оплата через Pally, СБП и банковскую карту РФ.\nИностранная карта не нужна.\nПодсказать, как перейти к оплате?",
      "🏦 Доступны Pally, СБП и карта РФ — выберите удобный способ на странице оплаты.\nКак удобнее оплатить?",
    ],
    work_weekend: [
      "📆 Да, работаем ежедневно, включая выходные.\nЕсли запрос срочный, ставим в приоритет.\nХотите оформить прямо сейчас?",
      "🟢 На связи и в выходные тоже.\nМожем быстро принять и запустить заявку.\nПодключаем сегодня?",
    ],
    contact: [
      `📩 Поддержка: вкладка «Оператор» или Telegram ${SUPPORT_TELEGRAM}.\nДля срочных кейсов Telegram обычно быстрее.\nПеревести вас к оператору?`,
      `🤝 Оператор доступен во вкладке «Оператор» и в Telegram ${SUPPORT_TELEGRAM}.\nЕсли нужно, сразу передам.\nПодключать оператора?`,
    ],
    login_issue: [
      "🔎 Если не работает вход, проверьте email и повторите авторизацию.\nЕсли ошибка сохраняется, оператор быстро решит вручную.\nПеревести к оператору?",
      "🔐 При проблеме со входом обновите страницу и зайдите снова.\nЕсли не поможет, подключим оператора для ручного решения.\nНужен перевод?",
    ],
    renewal_discount: [
      "🏷️ На продление подбираем выгодный вариант под нагрузку.\nСмотрите актуальные цены в витрине — подскажу, какой тариф выгоднее под ваш сценарий.\nСмотрим Plus или сразу Pro?",
      "♻️ Продление можно сделать без переплаты.\nНапишите вашу текущую нагрузку, и дам точный вариант.\nКак часто пользуетесь?",
    ],
    cancel_autorenew: [
      "⚙️ Автопродление отключается в настройках аккаунта OpenAI в пару кликов.\nПодписка останется активной до конца периода.\nПоказать короткий путь, где отключить?",
      "🧭 Отключить автопродление можно самостоятельно в настройках OpenAI.\nЭто быстро и безопасно.\nНужна пошаговая инструкция?",
    ],
    order_status: [
      "📦 Статус заказа проверим быстро.\nНапишите время оплаты и контакт из заявки — сразу скажу текущий этап.\nПроверяем?",
      "📍 Для проверки статуса нужен ориентир: время оплаты + контакт из заказа.\nПосле этого дам точный статус.\nОтправите данные?",
    ],
    refund: [
      "↩️ Возврат оформляем, если активация не прошла по нашей стороне.\nНапишите номер/время заказа — проверим кейс.\nПередать вас оператору для быстрого решения?",
      "🧾 По возврату поможем: проверим заявку и условия, после чего дадим точный ответ.\nПришлите время оплаты и контакт.\nПодключать оператора сейчас?",
    ],
  };

  return pickNonRepeatingVariant(variants[topic], previousAssistant);
}

function formatForChatStyle(content: string): string {
  const trimmed = content.trim();
  if (!trimmed) return trimmed;
  const hasEmoji = /[\u{1F300}-\u{1FAFF}]/u.test(trimmed);
  return hasEmoji ? trimmed : `✨ ${trimmed}`;
}

export async function POST(req: NextRequest) {
  let body: ChatRequestBody;
  try {
    body = (await req.json()) as ChatRequestBody;
  } catch {
    return NextResponse.json({ error: "Неверный JSON в запросе" }, { status: 400 });
  }

  const messages: ChatMessage[] = (body.messages ?? [])
    .filter(
      (message): message is ChatMessage =>
        (message?.role === "user" || message?.role === "assistant") &&
        typeof message.content === "string" &&
        message.content.trim().length > 0
    )
    .map((message) => ({
      role: message.role,
      content: message.content.trim(),
    }));

  if (!messages.length || messages[messages.length - 1]?.role !== "user") {
    return NextResponse.json(
      { error: "Последнее сообщение должно быть от пользователя" },
      { status: 400 }
    );
  }

  const siteSlug = body.site === "subs-store" ? "subs-store" : "gpt-store";
  const isSubsStore = siteSlug === "subs-store";
  const supportTelegram = isSubsStore ? SUPPORT_TELEGRAM_SUBS : SUPPORT_TELEGRAM_GPT;

  if (body.clientHasAccount === false) {
    const loginHint = isSubsStore
      ? "🔐 Чтобы продолжить, войдите в аккаунт Subs Store.\nПосле входа специалист поможет подключить Spotify Premium."
      : "🔐 Чтобы продолжить с ассистентом, войдите в аккаунт.\nПосле входа сразу помогу подобрать тариф и быстро оформить подключение.";
    return NextResponse.json({ content: loginHint });
  }

  const lastUserMessage = normalizeText(messages[messages.length - 1]?.content ?? "");
  if (shouldTransferToOperator(lastUserMessage)) {
    return NextResponse.json({
      content: "Отлично, сейчас передам вас оператору для быстрого оформления 👇",
    });
  }

  const previousAssistant =
    [...messages].reverse().find((message) => message.role === "assistant")?.content ?? "";

  // ── Subs Store (Spotify) branch ───────────────────────────────────────────
  if (isSubsStore) {
    const spotifyTopic = getSpotifyTopicFromHistory(messages);
    if (!spotifyTopic) {
      return NextResponse.json({
        content: `Чтобы дать точный ответ, подключу оператора: чат или Telegram ${supportTelegram}.`,
      });
    }
    const content = formatForChatStyle(spotifyTopicReply(spotifyTopic, previousAssistant));
    return NextResponse.json({ content });
  }

  // ── GPT STORE branch (default) ────────────────────────────────────────────
  const topic = getTopicFromHistory(messages);
  if (!topic) {
    return NextResponse.json({
      content: `Чтобы не дать неточную информацию, лучше сразу подключу оператора: вкладка «Оператор» или Telegram ${SUPPORT_TELEGRAM}.`,
    });
  }

  const prices = await loadChatPriceSnapshot();
  const content = formatForChatStyle(topicReply(topic as GptTopic, previousAssistant, prices));
  return NextResponse.json({ content });
}
