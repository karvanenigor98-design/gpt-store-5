import { CreditCard, Clock3, Shield, Headphones, Smartphone, Music, Users, Star } from "lucide-react";

export const SPOTIFY_ACCENT = "#1DB954";
export const SPOTIFY_GLOW = "rgba(29,185,84,0.15)";
export const SPOTIFY_BORDER = "rgba(255,255,255,0.08)";

/** A/B hero: срок в badge (A) или в accent H1 (B). */
export const SPOTIFY_HERO_BADGE_WITH_TIMING =
  "SPOTIFY STORE · 10–15 мин · Premium · Оплата в ₽";
export const SPOTIFY_HERO_BADGE_NO_TIMING =
  "SPOTIFY STORE · Premium без рекламы · Оплата в ₽";
export const SPOTIFY_HERO_ACCENT_BASE = "в России без сложностей";
export const SPOTIFY_HERO_ACCENT_WITH_TIMING =
  "в России без сложностей — подключим за 10–15 минут";

export const SPOTIFY_HERO = {
  badge: SPOTIFY_HERO_BADGE_WITH_TIMING,
  title: "Spotify Premium",
  accentTitle: SPOTIFY_HERO_ACCENT_BASE,
  subtitle:
    "Подключаем Spotify Premium на ваш аккаунт или выдаём новый — без рекламы, с офлайном и полным каталогом. Оплата в рублях, гарантия на срок подписки.",
  trustBadges: [
    "Без рекламы и офлайн",
    "Подключение 10–15 минут",
    "Оплата в рублях",
    "Гарантия на срок",
    "10 000+ подключений",
  ],
  primaryCta: "Подключить Premium",
  secondaryCta: "Как это работает",
  meta: "Более 10 000 подключений · Рейтинг 4.9/5 · Поддержка на связи",
};

export const SPOTIFY_TICKER_ITEMS = [
  "⚡ Активация за 10–15 минут",
  "✓ Гарантия на весь срок",
  "★ Рейтинг 4.9/5",
  "Без иностранной карты",
  "Работает в России",
  "Поддержка 24/7",
  "Premium без рекламы",
  "🎵 Музыка офлайн",
  "Оплата в рублях",
];

export const SPOTIFY_HOW_IT_WORKS = [
  {
    icon: Music,
    title: "Выберите Premium-тариф",
    description:
      "Individual, Duo, Family или новый аккаунт — выберите формат и срок подписки.",
  },
  {
    icon: CreditCard,
    title: "Оплатите в рублях",
    description: "Оплата картой РФ или СБП прямо на сайте — без иностранной карты.",
  },
  {
    icon: Shield,
    title: "Передайте данные, если понадобятся",
    description:
      "Для некоторых тарифов оператор подскажет, что передать для активации — безопасно и только в чате сайта.",
  },
  {
    icon: Headphones,
    title: "Слушайте без рекламы и офлайн",
    description:
      "Подключение обычно 10–15 минут. Статус заказа виден в личном кабинете.",
  },
];

export const SPOTIFY_SAFETY_MYTHS = [
  {
    myth: "Нужен пароль от Spotify",
    fact: "Чаще всего хватает email или кода. В отдельных случаях — пароль или вход в аккаунт: заранее объясним, зачем это нужно, и используем данные только для подключения Premium.",
  },
  {
    myth: "Сложная самостоятельная настройка",
    fact: "Всё активирует специалист — вы только получаете Premium",
  },
  { myth: "Нужна иностранная карта", fact: "Оплата картой РФ или СБП" },
  {
    myth: "Подписка может слететь",
    fact: "Гарантия на весь срок — восстановим при любых проблемах",
  },
];

export const SPOTIFY_SAFETY_PRINCIPLES = [
  {
    icon: Shield,
    text: "После оплаты оператор уточнит, что нужно для вашего тарифа: email, код подтверждения или, при необходимости, пароль — только в чате сайта.",
  },
  { icon: CreditCard, text: "Оплата через подключённую платёжную систему сайта" },
  { icon: Clock3, text: "Статус заказа — в личном кабинете" },
  { icon: Headphones, text: "Поддержка работает прямо на сайте, в чате" },
  { icon: Star, text: "Если Premium слетит — поможем восстановить по гарантии" },
];

export const SPOTIFY_RUSSIA_POINTS = [
  "Оплата в рублях — картой РФ или СБП",
  "Не нужна иностранная карта",
  "Подписка подходит для пользователей из России",
  "Spotify Premium работает на iPhone, Android, компьютере и в веб-версии при доступности сервиса",
  "Поддержка на русском языке 24/7",
];

export const SPOTIFY_RUSSIA_DISCLAIMER =
  "Доступ к Spotify зависит от текущей работоспособности сервиса в вашем регионе. Мы обеспечиваем активацию подписки, а не обход технических ограничений.";

export const SPOTIFY_WHY_POINTS = [
  "Вы платите в рублях — без конвертации, без иностранной карты и без лишних комиссий.",
  "Мы сопровождаем подключение — вы не настраиваете ничего самостоятельно.",
  "Помогаем выбрать подходящий формат: индивидуальная, для двоих, семейная или новый аккаунт.",
  "Вы получаете полноценный Premium-доступ по выбранному тарифу с поддержкой и гарантией.",
];

export const SPOTIFY_REVIEWS = [
  {
    id: "r1",
    authorName: "Анна",
    initials: "А",
    avatarColor: "#1DB954",
    tariff: "3 месяца",
    dateLabel: "апрель 2025",
    rating: 5,
    content:
      "Подключили примерно за 12 минут, всё работает на телефоне и ноутбуке. Оплатила картой РФ без проблем.",
  },
  {
    id: "r2",
    authorName: "Илья",
    initials: "И",
    avatarColor: "#2d6a4f",
    tariff: "1 месяц",
    dateLabel: "март 2025",
    rating: 5,
    content:
      "Взял на месяц попробовать. Музыка без рекламы, офлайн работает, поддержка быстро ответила на вопрос.",
  },
  {
    id: "r3",
    authorName: "Мария",
    initials: "М",
    avatarColor: "#1a7a4a",
    tariff: "Для двоих · 3 месяца",
    dateLabel: "март 2025",
    rating: 5,
    content:
      "Оформили подписку для двоих, всё объяснили в чате сайта. Удобно, что не нужно искать иностранную карту.",
  },
  {
    id: "r4",
    authorName: "Дмитрий",
    initials: "Д",
    avatarColor: "#0d7377",
    tariff: "12 месяцев",
    dateLabel: "февраль 2025",
    rating: 5,
    content:
      "Продлил на год, цена выгоднее, чем каждый месяц отдельно. Всё активировали быстро, всё работает.",
  },
  {
    id: "r5",
    authorName: "Ксения",
    initials: "К",
    avatarColor: "#155724",
    tariff: "Новый аккаунт",
    dateLabel: "январь 2025",
    rating: 5,
    content:
      "Мне было не важно сохранять старый аккаунт, поэтому взяла новый. Вошла — и всё уже было с Premium.",
  },
];

export type SpotifyTabId = "individual" | "duo" | "family";

export interface SpotifyPlan {
  id: string;
  tab: SpotifyTabId;
  name: string;
  price: number;
  /** Цена до витринной скидки (из админки «Скидки»). */
  originalPrice?: number;
  /** Зачёркнутая «старая» цена из тарифа (old_price в БД). */
  oldPrice?: number;
  /** Название скидки для бейджа на карточке. */
  landingDiscountName?: string | null;
  badge?: string;
  description: string;
  shortDescription?: string;
  features: string[];
  isPopular?: boolean;
  isBestValue?: boolean;
  durationMonths?: number;
  monthlyPrice?: number;
  savingsText?: string;
  ctaText?: string;
  requiresAccountData?: boolean;
  allowPromocodes?: boolean;
  allowDiscounts?: boolean;
}

export const SPOTIFY_PLANS: SpotifyPlan[] = [
  {
    id: "spotify-new-account",
    tab: "individual",
    name: "Для новых аккаунтов",
    price: 440,
    description: "Клиент получает новый аккаунт с Premium.",
    features: [
      "Новый аккаунт Spotify",
      "Быстрый старт",
      "Подходит, если не принципиален текущий аккаунт",
      "Поддержка при входе",
      "Гарантия на срок",
    ],
  },
  {
    id: "spotify-ind-1m",
    tab: "individual",
    name: "1 месяц",
    price: 490,
    badge: "Попробовать",
    description: "Индивидуальный Premium на 1 месяц.",
    features: [
      "Для личного использования",
      "Без рекламы",
      "Музыка в высоком качестве",
      "Поддержка на сайте",
      "Активация 10–15 минут",
    ],
  },
  {
    id: "spotify-ind-3m",
    tab: "individual",
    name: "3 месяца",
    price: 1090,
    badge: "Выгодно",
    description: "Оптимальный вариант для регулярного использования.",
    features: [
      "Экономия по сравнению с оплатой каждый месяц",
      "Подходит для регулярного использования",
      "Гарантия на весь срок",
      "Поддержка 24/7",
    ],
    isPopular: true,
    durationMonths: 3,
    monthlyPrice: 349,
    savingsText: "Экономия 380 ₽ vs 3× по месяцу",
  },
  {
    id: "spotify-ind-6m",
    tab: "individual",
    name: "6 месяцев",
    price: 1890,
    durationMonths: 6,
    monthlyPrice: 299,
    description: "Для тех, кто хочет Premium надолго.",
    features: [
      "Долгий срок",
      "Стабильный Premium-доступ",
      "Оптимальная цена за месяц",
      "Гарантия на весь срок",
    ],
  },
  {
    id: "spotify-ind-12m",
    tab: "individual",
    name: "12 месяцев",
    price: 2990,
    badge: "Максимальная выгода",
    description: "Максимальная выгода на год.",
    features: [
      "Максимальная выгода",
      "Premium на год",
      "Не нужно продлевать каждый месяц",
      "Гарантия на весь срок",
    ],
    isBestValue: true,
    durationMonths: 12,
    monthlyPrice: 249,
    savingsText: "Экономия 2990 ₽ vs 12× по месяцу",
  },
  {
    id: "spotify-duo-1m",
    tab: "duo",
    name: "1 месяц",
    price: 790,
    description: "Spotify Premium для двух пользователей на 1 месяц.",
    features: [
      "Для двух пользователей",
      "Удобно для пары или друзей",
      "Premium без рекламы",
      "Поддержка при подключении",
    ],
  },
  {
    id: "spotify-duo-3m",
    tab: "duo",
    name: "3 месяца",
    price: 1690,
    badge: "Выгодно",
    description: "Trio Premium для двух на 3 месяца.",
    features: [
      "Выгоднее помесячной оплаты",
      "Для двух пользователей",
      "Гарантия на весь срок",
      "Поддержка 24/7",
    ],
    isPopular: true,
    durationMonths: 3,
    monthlyPrice: 549,
    savingsText: "Экономия vs 3× по месяцу",
  },
  {
    id: "spotify-duo-6m",
    tab: "duo",
    name: "6 месяцев",
    price: 2890,
    durationMonths: 6,
    monthlyPrice: 479,
    description: "Premium для двух на полгода.",
    features: [
      "Долгий срок",
      "Хорошая цена за месяц",
      "Для двух пользователей",
      "Помощь с подключением",
    ],
  },
  {
    id: "spotify-duo-12m",
    tab: "duo",
    name: "12 месяцев",
    price: 4490,
    badge: "Максимальная выгода",
    description: "Самый выгодный формат для двух пользователей.",
    features: [
      "Самый выгодный формат для двух пользователей",
      "Premium на год",
      "Гарантия на весь срок",
      "Поддержка при любых вопросах",
    ],
    isBestValue: true,
    durationMonths: 12,
    monthlyPrice: 369,
    savingsText: "Экономия vs 12× по месяцу",
  },
  {
    id: "spotify-family-1m",
    tab: "family",
    name: "1 месяц",
    price: 990,
    description: "Семейная подписка на месяц — до 5 человек.",
    features: [
      "Семейный формат",
      "До 5 человек",
      "Premium для каждого участника",
      "Поддержка при подключении",
      "Гарантия на срок",
    ],
  },
  {
    id: "spotify-family-3m",
    tab: "family",
    name: "3 месяца",
    price: 2490,
    badge: "Выгодно",
    description: "Семейная подписка на 3 месяца — до 5 человек.",
    features: [
      "До 5 человек",
      "Premium для каждого участника",
      "Экономия по сравнению с оплатой каждый месяц",
      "Гарантия на весь срок",
      "Поддержка 24/7",
    ],
    isPopular: true,
    durationMonths: 3,
    monthlyPrice: 799,
    savingsText: "Экономия vs 3× по месяцу",
  },
  {
    id: "spotify-family-6m",
    tab: "family",
    name: "6 месяцев",
    price: 4490,
    durationMonths: 6,
    monthlyPrice: 699,
    description: "Семейная подписка на полгода — до 5 человек.",
    features: [
      "До 5 человек",
      "Долгий срок",
      "Выгодная цена за месяц",
      "Premium для каждого участника",
      "Гарантия на весь срок",
    ],
  },
  {
    id: "spotify-family-12m",
    tab: "family",
    name: "12 месяцев",
    price: 7490,
    badge: "Лучший выбор",
    description: "Семейная подписка на год — максимальная выгода для всей семьи.",
    features: [
      "До 5 человек",
      "Максимальная выгода",
      "Premium на год для всей семьи",
      "Не нужно продлевать каждый месяц",
      "Гарантия на весь срок",
    ],
    isBestValue: true,
    durationMonths: 12,
    monthlyPrice: 599,
    savingsText: "Экономия vs 12× по месяцу",
  },
];

export const SPOTIFY_TABS: { id: SpotifyTabId; label: string; icon: typeof Users }[] = [
  { id: "individual", label: "Индивидуальная", icon: Smartphone },
  { id: "duo", label: "Для двоих", icon: Users },
  { id: "family", label: "Семейная", icon: Users },
];

export const SPOTIFY_GUARANTEE_POINTS = [
  "Если возникнет проблема с Premium — поможем восстановить доступ или предложим решение в рамках условий.",
  "Если активация не прошла — возврат по условиям оферты.",
  "Поддержка на связи 24/7.",
  "Все обращения фиксируются в чате сайта.",
];

export const SPOTIFY_FAQ = [
  {
    question: "Работает ли Spotify Premium в России?",
    answer:
      "Да. Мы активируем Premium на ваш аккаунт или выдаём новый. Доступ к сервису зависит от текущей работоспособности Spotify в вашем регионе — мы обеспечиваем активацию подписки.",
  },
  {
    question: "Чем отличаются Individual, Duo и Family?",
    answer:
      "Individual — один аккаунт для вас. Duo — Premium для двоих, у каждого свой профиль. Family — до 5 участников в одном тарифе. Выберите формат в блоке тарифов.",
  },
  {
    question: "Можно ли подключить на мой аккаунт?",
    answer:
      "Да, для большинства тарифов подключаем на существующий Spotify-аккаунт. Если нужен отдельный старт — выберите «Новый аккаунт».",
  },
  {
    question: "Нужен ли пароль?",
    answer:
      "Не всегда. Чаще хватает email или кода подтверждения. Если для вашего тарифа понадобятся дополнительные данные — оператор заранее объяснит, что именно и зачем, и примет их только в чате сайта.",
  },
  {
    question: 'Что значит «новый аккаунт»?',
    answer:
      "Вы получаете отдельный Spotify-аккаунт с уже активированным Premium. Подходит, если не принципиален текущий профиль или хотите быстрый старт.",
  },
  {
    question: "Сколько занимает подключение?",
    answer:
      "Обычно 10–15 минут после оплаты. В периоды высокой нагрузки возможны задержки — статус виден в личном кабинете.",
  },
  {
    question: "Что делать, если подписка слетела?",
    answer:
      "Напишите в поддержку через чат на сайте. Проверим ситуацию и восстановим доступ по гарантии на срок подписки.",
  },
  {
    question: "Есть ли гарантия?",
    answer:
      "Да — на весь срок оплаченной подписки. Если Premium перестанет работать по нашей вине — поможем восстановить или предложим решение по условиям оферты.",
  },
  {
    question: "Какие данные нужны для активации?",
    answer:
      "Зависит от тарифа и аккаунта. Для некоторых тарифов при подключении могут понадобиться данные Spotify-аккаунта — только для активации. Оператор подскажет безопасный способ передачи.",
  },
  {
    question: "Нужен ли VPN после активации?",
    answer:
      "В большинстве случаев — нет. После успешной авторизации сервис работает без VPN.",
  },
  {
    question: "Как связаться с поддержкой?",
    answer:
      "Через чат на сайте или в личном кабинете после оплаты. Поддержка на русском языке.",
  },
  {
    question: "Где смотреть статус заказа?",
    answer:
      "В личном кабинете после оплаты — там видно этап подключения и можно написать оператору. Статус обновляется по мере обработки заказа.",
  },
  {
    question: "Что делать после оплаты?",
    answer:
      "Ожидайте сообщение от оператора в чате. Мы свяжемся для завершения активации — статус заказа обновляется в кабинете.",
  },
];
