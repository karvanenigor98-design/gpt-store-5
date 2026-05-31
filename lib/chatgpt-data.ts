export type HeroContent = {
  badge: string;
  title: string;
  accentTitle: string;
  subtitle: string;
  trustBadges: string[];
  primaryCta: string;
  secondaryCta: string;
  meta: string;
};

export type TrustMetric = {
  value: string;
  label: string;
};

/** Ключ иконки — разрешение в UI только в client-компонентах (lucide). */
export type ChatLandingIconKey =
  | "credit-card"
  | "mail"
  | "rocket"
  | "sparkles"
  | "shield"
  | "check-circle-2";

export type HowItWorksStep = {
  title: string;
  description: string;
  icon: ChatLandingIconKey;
};

export type SafetyMyth = {
  myth: string;
  fact: string;
};

export type Review = {
  name: string;
  city: string;
  initials: string;
  avatarColor: string;
  date: string;
  text: string;
};

export type Plan = {
  id: string;
  name: string;
  price: number;
  currency: string;
  period: string;
  pricePerMonth?: number;
  badge?: string;
  description: string;
  features: string[];
  isPopular: boolean;
  cta: string;
};

export type FaqItem = {
  question: string;
  answer: string;
};

export const HERO_CONTENT: HeroContent = {
  badge: "ChatGPT Plus · 3–5 минут · Оплата в ₽ · Работает в России",
  title: "ChatGPT Plus",
  accentTitle: "без иностранной карты",
  subtitle:
    "Подключаем подписку ChatGPT на ваш аккаунт или поможем с готовым персональным аккаунтом. Оплата в рублях, статус заказа в кабинете, поддержка на связи.",
  trustBadges: [
    "3–5 минут на подключение",
    "Оплата в рублях",
    "Гарантия на весь срок",
    "10 000+ подключений",
    "Рейтинг 4.9/5",
  ],
  primaryCta: "Подключить ChatGPT Plus",
  secondaryCta: "Узнать, как это работает",
  meta: "Более 10 000 подключений · Средний рейтинг 4.9/5 · Поддержка 24/7",
};

export const TRUST_METRICS: TrustMetric[] = [
  { value: "10 000+", label: "Успешных подключений" },
  { value: "4.9 / 5", label: "Средний рейтинг" },
  { value: "3-5 мин", label: "Время активации" },
  { value: "24/7", label: "Поддержка" },
  { value: "100%", label: "Без иностранной карты" },
];

export const HOW_IT_WORKS_STEPS: HowItWorksStep[] = [
  {
    title: "Выберите тариф",
    description:
      "Выберите Plus или Pro и оплатите в рублях — картой РФ, СБП или через Pally.",
    icon: "credit-card",
  },
  {
    title: "Оплатите в рублях",
    description:
      "После оплаты в личном кабинете появится заказ и инструкции. Специалист свяжется в чате сайта.",
    icon: "mail",
  },
  {
    title: "Специалист подключит подписку",
    description:
      "Подключаем ChatGPT на ваш аккаунт или выдаём готовый — по выбранному тарифу. В большинстве случаев пароль не нужен.",
    icon: "rocket",
  },
  {
    title: "Отслеживайте статус в кабинете",
    description:
      "Статус заказа обновляется в реальном времени. Если что-то пойдёт не так — поддержка поможет.",
    icon: "sparkles",
  },
];

export const SAFETY_MYTHS: SafetyMyth[] = [
  {
    myth: "Нужно отдавать пароль от ChatGPT",
    fact: "В большинстве случаев пароль не нужен. Если аккаунт через Google — специалист предложит безопасный вариант: код подтверждения или отдельный пароль по инструкции.",
  },
  { myth: "Данные сессии можно куда угодно отправить", fact: "Передавайте их только в официальный чат сайта GPT STORE" },
  { myth: "Подключение всегда мгновенное", fact: "Сроки зависят от тарифа: обычная очередь или приоритет у «Быстрой активации»" },
  { myth: "Платёж проходит на нашем сайте напрямую", fact: "Оплата через Pally, СБП и карту РФ — без хранения реквизитов у нас" },
];

export const RUSSIA_POINTS = [
  "Активация не зависит от вашего местоположения",
  "Не нужна иностранная карта или VPN для оплаты",
  "ChatGPT доступен через браузер или приложение как обычно",
];

export const WHY_CHEAPER_POINTS = [
  "ChatGPT Plus стоит $20/месяц при прямой оплате зарубежной картой.",
  "Мы помогаем оформить подписку в рублях через удобные способы оплаты в РФ и сопровождаем подключение.",
  "Вы получаете подписку ChatGPT Plus на свой аккаунт или вариант с готовым персональным аккаунтом — по условиям тарифа.",
];

export const REVIEWS: Review[] = [
  {
    name: "Алексей М.",
    city: "Москва",
    initials: "АМ",
    avatarColor: "#3b82f6",
    date: "14 апреля",
    text: "Оформил за 4 минуты. Написал в чат, дал email - все. Уже пользуюсь второй месяц, ни разу не было проблем.",
  },
  {
    name: "Екатерина В.",
    city: "Санкт-Петербург",
    initials: "ЕВ",
    avatarColor: "#10a37f",
    date: "9 апреля",
    text: "Честно, думала что подвох. Но все реально работает. ChatGPT 5.5 полностью, без ограничений.",
  },
  {
    name: "Дмитрий К.",
    city: "Новосибирск",
    initials: "ДК",
    avatarColor: "#8b5cf6",
    date: "2 апреля",
    text: "Иностранная карта не нужна - это главное для меня. Поддержка отвечает быстро, вопросов не возникало.",
  },
  {
    name: "Марина Л.",
    city: "Краснодар",
    initials: "МЛ",
    avatarColor: "#f59e0b",
    date: "28 марта",
    text: "Пользуюсь для работы - пишу тексты и делаю анализ данных. Подписка работает стабильно уже 3 месяца.",
  },
  {
    name: "Игорь Р.",
    city: "Казань",
    initials: "ИР",
    avatarColor: "#ef4444",
    date: "21 марта",
    text: "Подписка слетела через 2 недели - написал в поддержку, восстановили бесплатно в тот же день.",
  },
  {
    name: "Анна С.",
    city: "Екатеринбург",
    initials: "АС",
    avatarColor: "#06b6d4",
    date: "15 марта",
    text: "Брала уже трижды. Каждый раз быстро и без вопросов. Это просто удобно и спокойно.",
  },
];

// Устаревший экспорт — для обратной совместимости (используй PLUS_PLANS)
export const PLANS: Plan[] = [];

// ─── Актуальные тарифы — только 1 месяц, 3 варианта Plus ─────────────────────

export const PLUS_PLANS_NEW: ExtendedPlan[] = [
  {
    id: "plus-new",
    productId: "chatgpt-plus",
    name: "Для новых аккаунтов",
    price: 1690,
    currency: "₽",
    period: "мес",
    description:
      "Для аккаунта ChatGPT, на котором ранее не было подписки Plus. Подключение на ваш аккаунт или готовый персональный аккаунт.",
    features: [
      "ChatGPT 5.5 и актуальные модели ChatGPT Plus",
      "Генерация изображений DALL·E 3",
      "Анализ файлов и данных",
      "Веб-поиск",
      "Поддержка 24/7",
      "Гарантия на весь срок",
      "Активация в общей очереди",
    ],
    isPopular: false,
    cta: "Подключить за 1 690 ₽",
  },
  {
    id: "plus-std",
    productId: "chatgpt-plus",
    name: "Популярный",
    price: 2190,
    currency: "₽",
    period: "мес",
    badge: "Популярный",
    description:
      "Тариф, который чаще всего выбирают. Подключение на ваш аккаунт или готовый персональный аккаунт.",
    features: [
      "ChatGPT 5.5 и актуальные модели ChatGPT Plus",
      "Генерация изображений DALL·E 3",
      "Анализ файлов и данных",
      "Веб-поиск",
      "Поддержка 24/7",
      "Гарантия на весь срок",
      "Активация в общей очереди",
    ],
    isPopular: true,
    cta: "Подключить за 2 190 ₽",
  },
  {
    id: "plus-fast",
    productId: "chatgpt-plus",
    name: "Быстрая активация",
    price: 2690,
    currency: "₽",
    period: "мес",
    badge: "Быстрее всего",
    description: "Подключение вне очереди — обычно заметно быстрее, чем в стандартной очереди.",
    features: [
      "ChatGPT 5.5 и актуальные модели ChatGPT Plus",
      "Генерация изображений DALL·E 3",
      "Анализ файлов и данных",
      "Веб-поиск",
      "Поддержка 24/7",
      "Гарантия на весь срок",
      "Приоритет вне очереди",
      "Обычно до 5–15 минут после передачи данных",
    ],
    isPopular: false,
    cta: "Подключить за 2 690 ₽",
  },
];

export const FAQ_ITEMS: FaqItem[] = [
  {
    question: "Нужна ли иностранная карта?",
    answer:
      "Нет. Оплатить можно картой РФ, СБП или через Pally — без иностранной карты и конвертации валют.",
  },
  {
    question: "Сколько занимает подключение?",
    answer:
      "В среднем 3–5 минут после оплаты и передачи данных по инструкции. Тариф «Быстрая активация» подключается вне очереди — обычно 5–15 минут.",
  },
  {
    question: "Нужен ли пароль от ChatGPT?",
    answer:
      "В большинстве случаев пароль не требуется. Если аккаунт через Google — специалист предложит безопасный вариант: код подтверждения или отдельный пароль по инструкции. Данные передаются только в официальный чат GPT STORE.",
  },
  {
    question: "Можно ли подключить на мой аккаунт?",
    answer:
      "Да. Подключаем на ваш существующий аккаунт ChatGPT или предоставляем готовый персональный — по условиям тарифа. Новый аккаунт без истории Plus подходит для тарифа «Для новых аккаунтов».",
  },
  {
    question: "Что делать, если подписка не появилась?",
    answer:
      "Напишите в поддержку через чат на сайте или в личном кабинете. Проверим статус заказа и поможем завершить подключение. Гарантия действует на весь срок подписки.",
  },
  {
    question: "Есть ли гарантия?",
    answer:
      "Да — на весь срок подписки. Если подписка слетит, восстановим бесплатно. Если активация не прошла — возврат по условиям оферты.",
  },
  {
    question: "Как связаться с поддержкой?",
    answer:
      "Через чат на сайте или в личном кабинете после оплаты. Поддержка на связи 24/7 — статус заказа виден в кабинете в реальном времени.",
  },
  {
    question: "Чем Plus отличается от Pro?",
    answer:
      "Plus — отличный выбор для ежедневной работы: ChatGPT 5.5, генерация изображений, анализ файлов. Pro даёт максимум возможностей и лимитов (~5× или ~20× к Plus) — для интенсивной профессиональной нагрузки.",
  },
  {
    question: "Это точно работает в России?",
    answer:
      "Да. Активация не зависит от вашего местоположения — подписка подключается на аккаунт ChatGPT напрямую.",
  },
  {
    question: "Чем отличаются тарифы Plus?",
    answer:
      "«Для новых аккаунтов» — минимальная цена для аккаунта без истории Plus. «Популярный» — универсальный выбор. «Быстрая активация» — приоритет вне очереди.",
  },
  {
    question: "Чем отличаются Pro 5x и Pro 20x?",
    answer:
      "Одинаковые функции Pro, разница только в лимитах: Pro 5x — ~5× к Plus для активной работы, Pro 20x — ~20× для постоянной нагрузки и бизнеса.",
  },
  {
    question: "Почему у вас дешевле, чем напрямую?",
    answer:
      "Мы помогаем оформить подписку в рублях через удобные способы оплаты в РФ и сопровождаем подключение без иностранной карты.",
  },
];

export const GUARANTEE_POINTS = [
  "Если подписка слетит — восстановим бесплатно: обычно стараемся решить вопрос в кратчайшие сроки, максимум до 24 часов; гарантия при соблюдении инструкции подключения",
  "Если активация не прошла — полный возврат средств по условиям оферты",
  "Поддержка на связи 24/7 — не бросаем после оплаты",
];

// ─── Plus / Pro product system ───────────────────────────────────────────────

export type ProductId = "chatgpt-plus" | "chatgpt-pro";

export interface ExtendedPlan {
  id: string;
  productId: ProductId;
  name: string;
  price: number;
  currency: string;
  period: string;
  pricePerMonth?: number;
  badge?: string;
  description: string;
  features: string[];
  isPopular: boolean;
  cta: string;
  inStock?: boolean;
}

// PLUS_PLANS — алиас на актуальные тарифы
export const PLUS_PLANS: ExtendedPlan[] = PLUS_PLANS_NEW;

// PRO_PLANS — два варианта: 5x и 20x (функции одинаковые, разница в лимитах)
export const PRO_PLANS: ExtendedPlan[] = [
  {
    id: "pro-5x",
    productId: "chatgpt-pro",
    name: "Pro 5x",
    price: 4090,
    currency: "₽",
    period: "мес",
    badge: "Для активной работы",
    description: "Одинаковые функции Pro, но с лимитами примерно в 5 раз выше, чем у Plus.",
    features: [
      "Полный функционал ChatGPT 5.5 Pro",
      "Лимиты использования ~5x к Plus",
      "Безлимитная генерация изображений",
      "Расширенный анализ данных",
      "Расширенный голосовой режим",
      "Подходит для работы несколько часов в день",
      "Гарантия на весь срок",
    ],
    isPopular: false,
    cta: "Подключить Pro 5x за 4 090 ₽",
  },
  {
    id: "pro-20x",
    productId: "chatgpt-pro",
    name: "Pro 20x",
    price: 10090,
    currency: "₽",
    period: "мес",
    badge: "Почти безлимит",
    description: "Те же функции Pro, но с лимитами примерно в 20 раз выше, чем у Plus.",
    features: [
      "Полный функционал ChatGPT 5.5 Pro",
      "Лимиты использования ~20x к Plus",
      "Безлимитная генерация изображений",
      "Расширенный анализ данных",
      "Расширенный голосовой режим",
      "Для постоянной нагрузки и бизнеса",
      "Гарантия на весь срок",
    ],
    isPopular: false,
    cta: "Подключить Pro 20x за 10 090 ₽",
  },
];

export const CHATGPT_PLANS = {
  plus: PLUS_PLANS,
  pro: PRO_PLANS,
} as const;

export interface ProductInfo {
  id: ProductId;
  name: string;
  tagline: string;
  description: string;
  accentColor: string;
  glowColor: string;
  badge?: string;
  features: string[];
}

export const PRODUCTS: ProductInfo[] = [
  {
    id: "chatgpt-plus",
    name: "ChatGPT Plus",
    tagline: "Для личных задач",
    description:
      "Доступ к ChatGPT 5.5, генерации изображений и анализу данных. Идеально для ежедневного использования.",
    accentColor: "#10a37f",
    glowColor: "rgba(16,163,127,0.15)",
    features: ["ChatGPT 5.5", "DALL·E 3", "Анализ файлов", "Веб-поиск"],
  },
  {
    id: "chatgpt-pro",
    name: "ChatGPT Pro",
    tagline: "Для профессионалов",
    description:
      "Ниже — два тарифа Pro с одинаковыми функциями: отличается только объём лимитов (~5× и ~20× к Plus). Выберите нагрузку под свои задачи.",
    accentColor: "#10a37f",
    glowColor: "rgba(16,163,127,0.2)",
    badge: "Новинка",
    features: ["Pro 5x", "Pro 20x", "ChatGPT 5.5", "Единый функционал"],
  },
];

export const RUSSIA_DISCLAIMER =
  "Для использования ChatGPT может потребоваться VPN - это зависит от вашего провайдера и не связано с нашим сервисом.";

export type SafetyPrinciple = { icon: ChatLandingIconKey; text: string };

export const SAFETY_PRINCIPLES: SafetyPrinciple[] = [
  {
    icon: "shield",
    text: "После оплаты уточним, что нужно для вашего аккаунта: код, email, данные сессии или, если без этого не обойтись, пароль — только по инструкции и в чат сайта",
  },
  { icon: "mail", text: "Оплата через Pally, СБП и карту РФ — реквизиты на нашей стороне не храним" },
  { icon: "check-circle-2", text: "Гарантия и возврат по условиям оферты, поддержка 24/7" },
];
