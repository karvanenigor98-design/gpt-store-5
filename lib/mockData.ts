export type ProductId = "chatgpt" | "spotify";

export type OrderStatus =
  | "Создан"
  | "Ожидаются данные"
  | "Данные получены"
  | "В работе"
  | "Активирован"
  | "Требует уточнения"
  | "Проблема";

export interface Product {
  id: ProductId;
  name: string;
  shortLabel: string;
  pricing: { months: 1 | 3 | 12; price: number; savings?: number }[];
}

export interface MockOrder {
  id: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  product: string;
  productId: ProductId;
  status: OrderStatus;
  date: string;
  validUntil?: string;
}

export interface ChatMessage {
  id: string;
  from: "client" | "manager";
  text: string;
  time: string;
}

export interface TestimonialBubble {
  id: string;
  name: string;
  text: string;
  time: string;
}

export const products: Product[] = [
  {
    id: "chatgpt",
    name: "ChatGPT Plus",
    shortLabel: "ChatGPT Plus",
    pricing: [
      { months: 1, price: 1690 },
      { months: 3, price: 4090, savings: 680 },
      { months: 12, price: 14090, savings: 4990 },
    ],
  },
  {
    id: "spotify",
    name: "Spotify Premium",
    shortLabel: "Spotify",
    pricing: [
      { months: 1, price: 790 },
      { months: 3, price: 1990, savings: 380 },
      { months: 12, price: 6590, savings: 2890 },
    ],
  },
];

/** Для бегущей строки — только наши две услуги */
export const trustLogos = [
  "ChatGPT Plus",
  "Spotify Premium",
  "ChatGPT Plus",
  "Spotify Premium",
];

export const landingFaq: { q: string; a: string }[] = [
  {
    q: "Нужна ли иностранная карта?",
    a: "Нет. Вы оплачиваете картой банка РФ или другим удобным способом в рублях. Мы оформляем подписку на ваш аккаунт.",
  },
  {
    q: "Мой аккаунт останется у меня?",
    a: "Да. В большинстве случаев пароль не требуется. При необходимости — данные сессии по инструкции только в чат сайта GPT STORE. Если аккаунт создан через Google, специалист предложит безопасный вариант.",
  },
  {
    q: "Почему цена ниже официальной?",
    a: "Для ChatGPT Plus и Spotify мы подключаем подписку через партнёрские программы. Функционал тот же, оплата — в рублях, без иностранной карты.",
  },
  {
    q: "Как передать данные — это безопасно?",
    a: "Запрашиваем только то, что нужно для активации. В большинстве случаев пароль не требуется. В отдельных случаях специалист может попросить дополнительные данные или код подтверждения — и заранее объяснит, что именно нужно. Переписка в защищённом чате.",
  },
  {
    q: "Сколько времени занимает активация?",
    a: "В среднем до 15 минут после оплаты и получения данных. В редких случаях до нескольких часов.",
  },
  {
    q: "Что если подписка слетит?",
    a: "Действует гарантия 30 дней: восстановим бесплатно или вернём деньги по регламенту.",
  },
  {
    q: "Работает ли это в России?",
    a: "Да, сервис ориентирован на клиентов из РФ с 2022 года. Оплата и поддержка на русском.",
  },
  {
    q: "Как продлить подписку потом?",
    a: "Напишите нам до окончания срока — продлим на тот же или другой период с актуальной скидкой.",
  },
];

export const spotifyProductFaq: { q: string; a: string }[] = [
  {
    q: "Это официальный Spotify Premium?",
    a: "Premium активируется на вашем аккаунте Spotify: без рекламы, офлайн-прослушивание и остальные функции тарифа на период подписки.",
  },
  {
    q: "Нужен ли VPN для Spotify?",
    a: "Зависит от региона и способа активации. После оплаты пришлём актуальную инструкцию под ваш случай.",
  },
  {
    q: "Можно ли семейный тариф?",
    a: "Оформляем индивидуальный Premium по умолчанию. Семейный план — по запросу, уточните при заказе.",
  },
  {
    q: "Что входит в тариф на 3 месяца?",
    a: "Непрерывный период Premium на выбранный срок на вашем аккаунте после активации.",
  },
  {
    q: "Как продлевается Spotify?",
    a: "Автосписаний с нашей стороны нет. За продлением напишите до окончания срока — продлим по текущим ценам.",
  },
];

export const chatgptProductFaq: { q: string; a: string }[] = [
  {
    q: "Это официальный ChatGPT Plus?",
    a: "Вы получаете доступ к Plus-функциям на своём аккаунте: приоритет, расширенные модели и инструменты согласно условиям OpenAI на момент активации.",
  },
  {
    q: "Нужен VPN?",
    a: "Зависит от региона и политики доступа. Подскажем в инструкции после оплаты, если потребуется.",
  },
  {
    q: "Можно ли на рабочий email?",
    a: "Да, если у вас есть доступ к почте для подтверждений. Укажите тот email, к которому привязан аккаунт OpenAI.",
  },
  {
    q: "Что входит в тариф на 3 месяца?",
    a: "Непрерывный период Plus на выбранный срок с момента активации, без смены вашего аккаунта.",
  },
  {
    q: "Как отменить автопродление?",
    a: "Мы не списываем карту автоматически. Продление — только по вашей заявке.",
  },
];

export const testimonials: TestimonialBubble[] = [
  {
    id: "t1",
    name: "Анна",
    text: "Оформили Plus за 12 минут, всё на моём аккаунте. Спасибо!",
    time: "14:02",
  },
  {
    id: "t2",
    name: "Максим",
    text: "Spotify без возни с картой — то, что искал. Рекомендую.",
    time: "вчера",
  },
  {
    id: "t3",
    name: "Елена",
    text: "И Plus, и Spotify оформили здесь — один контакт, всё прозрачно.",
    time: "пн",
  },
];

export const mockOrders: MockOrder[] = [
  {
    id: "ORD-1042",
    clientName: "Иван Петров",
    clientEmail: "ivan@example.com",
    clientPhone: "+7 900 123-45-67",
    product: "ChatGPT Plus",
    productId: "chatgpt",
    status: "Активирован",
    date: "2026-03-28",
    validUntil: "2026-06-28",
  },
  {
    id: "ORD-1041",
    clientName: "Мария С.",
    clientEmail: "maria@example.com",
    clientPhone: "+7 901 000-11-22",
    product: "Spotify Premium",
    productId: "spotify",
    status: "В работе",
    date: "2026-03-31",
  },
  {
    id: "ORD-1040",
    clientName: "Алексей К.",
    clientEmail: "alex@example.com",
    clientPhone: "+7 902 333-44-55",
    product: "Spotify Premium",
    productId: "spotify",
    status: "Данные получены",
    date: "2026-03-31",
  },
  {
    id: "ORD-1039",
    clientName: "Ольга В.",
    clientEmail: "olga@example.com",
    clientPhone: "+7 903 111-22-33",
    product: "ChatGPT Plus",
    productId: "chatgpt",
    status: "Ожидаются данные",
    date: "2026-04-01",
  },
  {
    id: "ORD-1038",
    clientName: "Дмитрий Н.",
    clientEmail: "dmitry@example.com",
    clientPhone: "+7 904 555-66-77",
    product: "ChatGPT Plus",
    productId: "chatgpt",
    status: "Создан",
    date: "2026-04-01",
  },
  {
    id: "ORD-1037",
    clientName: "Сергей Л.",
    clientEmail: "sergey@example.com",
    clientPhone: "+7 905 777-88-99",
    product: "ChatGPT Plus",
    productId: "chatgpt",
    status: "Требует уточнения",
    date: "2026-03-30",
  },
  {
    id: "ORD-1036",
    clientName: "Екатерина Р.",
    clientEmail: "ekat@example.com",
    clientPhone: "+7 906 222-33-44",
    product: "Spotify Premium",
    productId: "spotify",
    status: "Проблема",
    date: "2026-03-29",
  },
  {
    id: "ORD-1035",
    clientName: "Павел Т.",
    clientEmail: "pavel@example.com",
    clientPhone: "+7 907 444-55-66",
    product: "Spotify Premium",
    productId: "spotify",
    status: "Активирован",
    date: "2026-03-15",
    validUntil: "2026-04-15",
  },
  {
    id: "ORD-1034",
    clientName: "Наталья Ж.",
    clientEmail: "nat@example.com",
    clientPhone: "+7 908 888-99-00",
    product: "ChatGPT Plus",
    productId: "chatgpt",
    status: "В работе",
    date: "2026-03-31",
  },
  {
    id: "ORD-1033",
    clientName: "Андрей М.",
    clientEmail: "andrew@example.com",
    clientPhone: "+7 909 000-12-34",
    product: "ChatGPT Plus",
    productId: "chatgpt",
    status: "Активирован",
    date: "2026-02-01",
    validUntil: "2026-05-01",
  },
];

export function messagesForOrder(orderId: string): ChatMessage[] {
  return [
    {
      id: `${orderId}-m1`,
      from: "manager",
      text: "Здравствуйте! Получили оплату, пришлите, пожалуйста, email аккаунта по инструкции.",
      time: "10:01",
    },
    {
      id: `${orderId}-m2`,
      from: "client",
      text: "Отправила на почту, жду.",
      time: "10:08",
    },
    {
      id: `${orderId}-m3`,
      from: "manager",
      text: "Принято, активируем в течение 15 минут.",
      time: "10:09",
    },
    {
      id: `${orderId}-m4`,
      from: "manager",
      text: "Подписка активирована, проверьте раздел подписки в аккаунте.",
      time: "10:21",
    },
    {
      id: `${orderId}-m5`,
      from: "client",
      text: "Вижу Plus, спасибо!",
      time: "10:24",
    },
  ];
}

export const cabinetUserName = "Алексей";

export const cabinetMockOrder = {
  product: "ChatGPT Plus",
  status: "Активирован" as OrderStatus,
  validUntil: "15 мая 2026",
};

export const faqGroups: { title: string; items: { q: string; a: string }[] }[] =
  [
    {
      title: "Безопасность",
      items: [
        {
          q: "Нужен ли пароль от аккаунта?",
          a: "В большинстве случаев пароль не требуется. В отдельных ситуациях или тарифах специалист может уточнить дополнительные данные или код подтверждения — заранее объяснит, что именно нужно.",
        },
        {
          q: "Как хранятся мои данные?",
          a: "Используем только для активации и переписки по заказу; не передаём третьим лицам.",
        },
        landingFaq[3],
        landingFaq[1],
      ],
    },
    {
      title: "Процесс активации",
      items: [
        landingFaq[4],
        {
          q: "Что делать, если не пришло письмо?",
          a: "Проверьте спам и напишите нам — продублируем или изменим способ верификации.",
        },
        landingFaq[5],
      ],
    },
    {
      title: "Оплата",
      items: [
        landingFaq[0],
        landingFaq[2],
        {
          q: "Есть ли чек?",
          a: "Да, отправим электронный чек или подтверждение в чат.",
        },
      ],
    },
    {
      title: "После покупки",
      items: [
        landingFaq[7],
        {
          q: "Куда писать в поддержку?",
          a: "В личном кабинете или в том же чате, где оформляли заказ.",
        },
        landingFaq[5],
      ],
    },
  ];
