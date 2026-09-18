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

/** CTA витрины всегда из актуальной цены — не хранить устаревшую строку отдельно. */
export function formatGptPlanCta(price: number, currency = "₽"): string {
  return `Подключить за ${price.toLocaleString("ru")} ${currency}`;
}

export type FaqItem = {
  question: string;
  answer: string;
};

/** A/B hero: срок в badge (A) или только в подзаголовке (B). Иерархия H1 общая. */
export const HERO_BADGE_WITH_TIMING = "ChatGPT Plus · Подключение 5–15 минут · Оплата в ₽";
export const HERO_BADGE_NO_TIMING = "ChatGPT Plus · Оплата в ₽ · На ваш аккаунт";
export const HERO_ACCENT_BASE = "без иностранной карты";
export const HERO_ACCENT_WITH_TIMING = "без иностранной карты";

export const HERO_CONTENT: HeroContent = {
  badge: HERO_BADGE_WITH_TIMING,
  title: "ChatGPT Plus",
  accentTitle: HERO_ACCENT_BASE,
  subtitle:
    "Подключим ChatGPT Plus на ваш аккаунт за 5–15 минут. Оплата российской картой или СБП.",
  trustBadges: [
    "Подключение за 5–15 минут",
    "Оплата в рублях",
    "Гарантия на весь срок",
    "Рейтинг 4.9/5",
  ],
  primaryCta: "Подключить ChatGPT Plus",
  secondaryCta: "Как проходит подключение",
  meta: "10 000+ подключений · Рейтинг 4.9/5 · Поддержка 24/7",
};

export const HERO_RESULT_LINES = [
  "Оплата выполнена",
  "Plus подключён",
  "На вашем аккаунте",
  "Готово к использованию",
] as const;

export const TRUST_BAR_ITEMS = [
  { icon: "check" as const, label: "10 000+ подключений" },
  { icon: "star" as const, label: "Рейтинг 4.9/5" },
  { icon: "shield" as const, label: "Гарантия на весь срок" },
  { icon: "card" as const, label: "Оплата в ₽" },
  { icon: "bolt" as const, label: "Подключение 5–15 минут" },
  { icon: "chat" as const, label: "Поддержка 24/7" },
] as const;

export const WHY_GPT_STORE_ITEMS = [
  {
    title: "Оплата в рублях",
    description: "Не нужна иностранная банковская карта. Карта РФ или СБП.",
  },
  {
    title: "На вашем аккаунте",
    description: "Подписка подключается к вашему аккаунту ChatGPT — не «общий» доступ.",
  },
  {
    title: "Быстрое подключение",
    description: "Обычно 5–15 минут после оплаты и передачи данных по инструкции.",
  },
  {
    title: "Поддержка 24/7",
    description: "Чат на сайте и в личном кабинете — не оставляем после оплаты.",
  },
  {
    title: "Гарантия на весь срок",
    description: "Если подписка слетит — восстановим. Если активация не прошла — возврат по оферте.",
  },
] as const;

export const SELF_PAY_COMPARE_ROWS = [
  { self: "Нужна зарубежная карта", store: "Оплата в рублях" },
  { self: "Нужно искать способ оплаты", store: "Всё в одном сервисе" },
  { self: "Разбираться с подключением самому", store: "Помогаем с подключением" },
  { self: "Нет сопровождения после оплаты", store: "Поддержка 24/7 и статус в кабинете" },
] as const;

export const TRUST_METRICS: TrustMetric[] = [
  { value: "10 000+", label: "Успешных подключений" },
  { value: "4.9 / 5", label: "Средний рейтинг" },
  { value: "3-5 мин", label: "Время активации" },
  { value: "24/7", label: "Поддержка" },
  { value: "100%", label: "Без иностранной карты" },
];

export const HOW_IT_WORKS_STEPS: HowItWorksStep[] = [
  {
    title: "Оформление заказа",
    description: "Выбираете план и оплачиваете. Карта РФ или СБП.",
    icon: "credit-card",
  },
  {
    title: "Подключение плана",
    description: "После оплаты менеджер напишет в чат сайта и поможет с подключением.",
    icon: "mail",
  },
  {
    title: "План подключён",
    description: "Подключаем план на ваш аккаунт.",
    icon: "check-circle-2",
  },
];

export const SAFETY_MYTHS: SafetyMyth[] = [
  {
    myth: "Нужно отдавать пароль от ChatGPT",
    fact: "В большинстве случаев пароль не нужен. Если аккаунт через Google — специалист предложит безопасный вариант: код подтверждения или отдельный пароль по инструкции.",
  },
  { myth: "Данные сессии можно куда угодно отправить", fact: "Передавайте их только в официальный чат сайта GPT STORE" },
  { myth: "Подключение всегда мгновенное", fact: "Сроки зависят от тарифа: обычная очередь или приоритет у «Быстрой активации»" },
  { myth: "Платёж проходит на нашем сайте напрямую", fact: "Оплата картой РФ или СБП — без хранения реквизитов у нас" },
];

export const RUSSIA_POINTS = [
  "Активация не зависит от вашего местоположения",
  "Не нужна иностранная карта или VPN для оплаты",
  "ChatGPT доступен через браузер или приложение как обычно",
];

export const WHY_CHEAPER_POINTS = [
  "ChatGPT Plus стоит $20/месяц при прямой оплате зарубежной картой.",
  "Мы помогаем оформить подписку в рублях через удобные способы оплаты в РФ и сопровождаем подключение.",
  "Вы получаете подписку ChatGPT Plus на свой аккаунт — по условиям выбранного тарифа.",
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

// ─── Актуальные тарифы — только 1 месяц, варианты Plus ───────────────────────

/**
 * Скрыты из публичной витрины (plan_availability / inStock).
 * Не удалять записи — нужны для админки и старых заказов.
 */
export const GPT_PUBLIC_HIDDEN_PLAN_IDS = new Set<string>(["plus-new", "plus-ready"]);

export const PLUS_READY_CHECKOUT_WARNING =
  "Этот вариант не подходит для подключения или продления подписки на вашем текущем аккаунте ChatGPT. Если подписка нужна именно на ваш аккаунт, выберите другой вариант активации.";

/** Что нужно для тарифа «Популярный» (подключение на ваш аккаунт). */
export const PLUS_STD_ACCESS_REQUIREMENTS = {
  title: "Что потребуется",
  lead: "Для подключения подписки потребуется вход в ваш аккаунт ChatGPT.",
  intro: "В зависимости от способа регистрации аккаунта могут понадобиться:",
  items: [
    "электронная почта от аккаунта ChatGPT;",
    "пароль от аккаунта ChatGPT (если установлен);",
    "либо авторизация через Google / Apple / Microsoft.",
  ],
  note: "При необходимости менеджер попросит вас подтвердить вход, отправив код подтверждения.",
} as const;

export const PLUS_PLANS_NEW: ExtendedPlan[] = [
  {
    id: "plus-ready",
    productId: "chatgpt-plus",
    name: "Готовый аккаунт ChatGPT Plus",
    price: 1590,
    currency: "₽",
    period: "мес",
    badge: "Готовый аккаунт",
    description:
      "Готовый аккаунт ChatGPT Plus с уже активированной подпиской. После оплаты оператор передаст данные для входа и объяснит дальнейшие действия.",
    features: [
      "Готовый аккаунт",
      "ChatGPT Plus уже активирован",
      "Данные для входа включены",
    ],
    isPopular: false,
    inStock: false,
    cta: "Подключить за 1 590 ₽",
  },
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
    inStock: false,
    cta: "Подключить за 1 690 ₽",
  },
  {
    id: "plus-std",
    productId: "chatgpt-plus",
    name: "Популярный",
    price: 2090,
    currency: "₽",
    period: "мес",
    badge: "Популярный",
    description:
      "Тариф, который чаще всего выбирают. Подключение ChatGPT Plus на ваш аккаунт.",
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
    cta: formatGptPlanCta(2090),
  },
  {
    id: "plus-fast",
    productId: "chatgpt-plus",
    name: "Быстрая активация",
    price: 2590,
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
    cta: formatGptPlanCta(2590),
  },
];

export const GO_PLANS: ExtendedPlan[] = [
  {
    id: "go-1m",
    productId: "chatgpt-go",
    name: "GO",
    /** Публичная витрина и checkout всегда показывают эту базу (не stale overlay). */
    price: 1000,
    currency: "₽",
    period: "мес",
    badge: "Доступная цена",
    description:
      "ChatGPT Go на 1 месяц — больше возможностей, чем в бесплатной версии, по доступной цене. Подходит, если Plus не нужен.",
    features: [
      "Больше сообщений, чем на бесплатном тарифе",
      "Создание изображений",
      "Загрузка и анализ файлов",
      "Расширенный доступ к возможностям ChatGPT",
      "Для работы, учёбы и повседневных задач",
      "Поддержка 24/7",
      "Гарантия на весь срок",
    ],
    isPopular: false,
    cta: formatGptPlanCta(1000),
  },
];

/** Короткие FAQ для упрощённой главной GPT STORE. */
export const GPT_SIMPLE_FAQ_ITEMS: FaqItem[] = [
  {
    question: "Нужна ли иностранная карта?",
    answer: "Нет. Оплатить можно картой РФ или СБП.",
  },
  {
    question: "Сколько занимает подключение?",
    answer: "Обычно 5–15 минут после оплаты. Без входа в аккаунт — быстрее: вход в ваш ChatGPT не нужен.",
  },
  {
    question: "Какие данные нужны?",
    answer:
      "Для подключения на ваш аккаунт — вход в ChatGPT (почта, пароль или Google / Apple / Microsoft). Менеджер уточнит в чате сайта.",
  },
  {
    question: "Безопасно ли это?",
    answer:
      "Оплата картой РФ или СБП — реквизиты карты у нас не храним. Данные для подключения принимаем только в чате сайта.",
  },
  {
    question: "Что делать, если возник вопрос?",
    answer: "Напишите в «Поддержку» в шапке сайта — ответим в чате, логин не нужен.",
  },
  {
    question: "Есть ли гарантия?",
    answer:
      "Да, на весь срок подписки. Если слетит — восстановим. Если активация не прошла — возврат по оферте.",
  },
];

export const FAQ_ITEMS: FaqItem[] = [
  {
    question: "Нужна ли иностранная карта?",
    answer:
      "Нет. Оплатить можно картой РФ или СБП — без иностранной карты и конвертации валют.",
  },
  {
    question: "Подписка будет на моём аккаунте?",
    answer:
      "Да. Для подключения или продления на вашем текущем аккаунте выбирайте «Популярный» или «Быстрая активация».",
  },
  {
    question: "Сколько занимает подключение?",
    answer:
      "Обычно 5–15 минут после оплаты и передачи данных по инструкции. Тариф «Быстрая активация» подключается вне очереди — в том же интервале, без ожидания общей очереди.",
  },
  {
    question: "Какие данные нужны?",
    answer:
      "Для подключения на ваш аккаунт нужен вход в ChatGPT. В зависимости от способа регистрации: email аккаунта, пароль (если установлен) либо авторизация через Google / Apple / Microsoft. При необходимости менеджер попросит код подтверждения. Данные передаются только в чат сайта GPT STORE.",
  },
  {
    question: "Безопасно ли это?",
    answer:
      "Оплата картой РФ или СБП — реквизиты карты на нашей стороне не храним. Данные для подключения принимаем только в официальном чате сайта. Пароль не просим «на всякий случай»: если он действительно нужен, согласуем шаги в чате.",
  },
  {
    question: "Что делать, если возникнет проблема?",
    answer:
      "Напишите в поддержку через чат на сайте или в личном кабинете. Проверим статус заказа и поможем завершить подключение. Гарантия действует на весь срок подписки.",
  },
  {
    question: "Как работает гарантия?",
    answer:
      "Гарантия — на весь срок подписки. Если подписка слетит, восстановим бесплатно. Если активация не прошла — возврат по условиям оферты.",
  },
  {
    question: "Можно ли продлить подписку?",
    answer:
      "Да. Для продления на вашем текущем аккаунте снова выберите «Популярный» или «Быстрая активация» и оформите заказ как обычно.",
  },
  {
    question: "Нужен ли пароль от ChatGPT?",
    answer:
      "В большинстве случаев пароль не требуется. Если аккаунт через Google — специалист предложит безопасный вариант: код подтверждения или отдельный пароль по инструкции. Данные передаются только в официальный чат GPT STORE.",
  },
  {
    question: "Как связаться с поддержкой?",
    answer:
      "Через чат на сайте или в личном кабинете после оплаты. Поддержка на связи 24/7.",
  },
  {
    question: "Где смотреть статус заказа?",
    answer:
      "В личном кабинете на сайте после оплаты — статус обновляется в реальном времени. Там же можно написать в поддержку, если нужна помощь.",
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
      "«Популярный» — подключение Plus на ваш аккаунт, лучший баланс цены и скорости. «Быстрая активация» — приоритет вне очереди, обычно 5–15 минут после передачи данных. «GO» — отдельный тариф ChatGPT Go: больше возможностей, чем бесплатно, но без функций Plus.",
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

export type ProductId = "chatgpt-plus" | "chatgpt-pro" | "chatgpt-go";

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
    price: 10990,
    currency: "₽",
    period: "мес",
    badge: "Популярный",
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
    isPopular: true,
    cta: formatGptPlanCta(10990),
  },
  {
    id: "pro-20x",
    productId: "chatgpt-pro",
    name: "Pro 20x",
    price: 19990,
    currency: "₽",
    period: "мес",
    badge: "Максимальный",
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
    cta: formatGptPlanCta(19990),
  },
];

export const CHATGPT_PLANS = {
  plus: PLUS_PLANS,
  pro: PRO_PLANS,
  go: GO_PLANS,
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
    id: "chatgpt-go",
    name: "ChatGPT Go",
    tagline: "Больше, чем бесплатно",
    description:
      "ChatGPT Go — оптимальный вариант, если возможностей бесплатной версии уже не хватает, а Plus вам не требуется.",
    accentColor: "#6366f1",
    glowColor: "rgba(99,102,241,0.15)",
    features: ["Больше сообщений", "Изображения", "Анализ файлов", "Работа и учёба"],
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
  { icon: "mail", text: "Оплата картой РФ или СБП — реквизиты на нашей стороне не храним" },
  { icon: "check-circle-2", text: "Гарантия и возврат по условиям оферты, поддержка 24/7" },
];
