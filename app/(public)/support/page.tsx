"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Send, Home, MessageCircle, ShoppingBag, User } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { tryCreateSubsBrowserClient } from "@/lib/supabase/subs-browser-client";
import { resolveClientNavRole } from "@/lib/auth/anchorRoles";

interface Message {
  role: "user" | "assistant";
  content: string;
  time: string;
}

type OrderStatus =
  | "pending"
  | "paid"
  | "activating"
  | "waiting_client"
  | "active"
  | "failed"
  | "refunded"
  | "expired";

interface LatestOrderInfo {
  id: string;
  status: OrderStatus;
  created_at: string;
  plan_id: string | null;
  product: string | null;
}

const getTime = () =>
  new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });

const QUICK_GPT = [
  { label: "Как оформить заказ", msg: "Как оформить заказ?" },
  { label: "Сколько стоит", msg: "Сколько стоит подписка?" },
  { label: "Срок активации", msg: "Когда будет готова подписка?" },
  { label: "Гарантия", msg: "Есть ли гарантия на подписку?" },
  { label: "Оплата из РФ", msg: "Можно ли оплатить картой РФ?" },
  { label: "Как продлить", msg: "Есть ли скидки на продление?" },
];

const QUICK_SPOTIFY = [
  { label: "Как происходит активация", msg: "Как происходит активация?" },
  { label: "Сколько времени", msg: "Сколько времени занимает активация?" },
  { label: "Нужен ли пароль", msg: "Нужен ли пароль?" },
  { label: "Гарантия", msg: "Есть ли гарантия?" },
  { label: "Оплата из РФ", msg: "Можно ли оплатить картой РФ?" },
  { label: "Что после оплаты", msg: "Что делать после оплаты?" },
];

const FAQ_ITEMS_GPT = [
  "Как оформить заказ?",
  "Сколько стоит подписка?",
  "Есть ли гарантия на подписку?",
  "Как активировать ChatGPT Plus?",
  "Чем отличается Plus от Pro?",
  "Как передать данные для активации?",
  "Когда будет готова подписка?",
  "Можно ли оплатить картой РФ?",
  "Работаете ли вы в выходные?",
  "Как связаться с поддержкой?",
  "Что делать если не работает вход?",
  "Есть ли скидки на продление?",
  "Как отменить автопродление?",
  "Где посмотреть статус заказа?",
  "Как оформить возврат средств?",
];

const FAQ_ITEMS_SPOTIFY = [
  "Как происходит активация?",
  "Сколько времени занимает активация?",
  "Нужен ли пароль?",
  "Какие данные нужны для активации?",
  "Нужен ли VPN после активации?",
  "Это безопасно?",
  "Что делать после оплаты?",
  "Что делать, если подписка слетела?",
  "Есть ли гарантия?",
  "Делаете ли вы возврат средств?",
  "Поддержка работает?",
];

// Компиляция ответов из нового Spotify FAQ
const SPOTIFY_SCRIPTED_ANSWERS: Record<string, string> = {
  "Как происходит активация?":
    "После оформления заказа с вами связывается специалист. Он уточняет нужные данные для выбранного варианта подключения и помогает завершить активацию.",
  "Сколько времени занимает активация?":
    "Обычно активация занимает от 5 до 30 минут. В периоды высокой нагрузки возможны задержки до нескольких часов.",
  "Нужен ли пароль?":
    "Не всегда. В большинстве случаев пароль не требуется. Но для отдельных тарифов или аккаунтов могут понадобиться дополнительные данные, код подтверждения или инструкция по настройке доступа. Специалист заранее объяснит, что именно нужно.",
  "Какие данные нужны для активации?":
    "Это зависит от выбранного тарифа и аккаунта. В большинстве случаев достаточно базовых данных или кода подтверждения. В отдельных случаях специалист может запросить дополнительные данные или подсказать, как настроить доступ для активации.",
  "Нужен ли VPN после активации?":
    "В большинстве случаев — нет. После успешной авторизации сервис работает без VPN.",
  "Это безопасно?":
    "Мы используем данные только для выполнения услуги активации. После завершения подключения вы можете обновить пароль и проверить настройки безопасности аккаунта.",
  "Что делать после оплаты?":
    "Ожидайте сообщение от специалиста. Мы свяжемся с вами для завершения активации.",
  "Что делать, если подписка слетела?":
    "Напишите в поддержку. Мы проверим ситуацию и предложим доступные варианты решения.",
  "Есть ли гарантия?":
    "Мы предоставляем гарантию на период работы подписки согласно условиям выбранного варианта.",
  "Делаете ли вы возврат средств?":
    "Да, в отдельных случаях возможен перерасчёт или частичный возврат за неиспользованный период.",
  "Поддержка работает?":
    "Да, поддержка работает ежедневно. Время ответа может увеличиваться при высокой нагрузке.",
  "Можно ли оплатить картой РФ?":
    "Да. Принимаем оплату картой РФ и через СБП.",
};

const FAQ_SCRIPTED_ANSWERS: Record<string, string> = {
  "Как оформить заказ?":
    "Выберите подходящий тариф, оплатите и отправьте данные для активации. Подключение обычно занимает 5-15 минут.",
  "Сколько стоит подписка?":
    "Актуальные цены всегда показаны в блоке тарифов на сайте и автоматически обновляются при изменениях в админке.",
  "Есть ли гарантия на подписку?":
    "Да. Если активация не проходит по нашей стороне, мы оформляем возврат.",
  "Как активировать ChatGPT Plus?":
    "После оплаты отправляете данные для активации, и мы подключаем подписку. Обычно это занимает до 15 минут.",
  "Чем отличается Plus от Pro?":
    "Plus подходит для большинства задач. Pro — для максимальной нагрузки и более интенсивного использования.",
  "Как передать данные для активации?":
    "После оплаты напишите в чат поддержки — специалист уточнит нужные данные и даст инструкцию. В большинстве случаев пароль не требуется.",
  "Когда будет готова подписка?":
    "Обычно подписка готова в течение 5-15 минут после оплаты и передачи данных.",
  "Можно ли оплатить картой РФ?":
    "Да. Оплата доступна через Pally, СБП и банковскую карту РФ.",
  "Работаете ли вы в выходные?":
    "Да, поддержка работает ежедневно, включая выходные.",
  "Как связаться с поддержкой?":
    "Напишите во вкладку «Оператор» или в Telegram: t.me/subs_support.",
  "Что делать если не работает вход?":
    "Проверьте корректность email и повторите вход. Если не помогает, напишите оператору для ручной помощи.",
  "Есть ли скидки на продление?":
    "По продлению условия подбираются индивидуально. Напишите оператору, он подскажет лучший вариант.",
  "Как отменить автопродление?":
    "Автопродление отключается в настройках аккаунта OpenAI в разделе подписки.",
  "Где посмотреть статус заказа?":
    "Статус уточняется у оператора по времени оплаты и контактам из заявки.",
  "Как оформить возврат средств?":
    "По возврату напишите оператору: проверим заказ и подскажем следующий шаг.",
};

const normalizeFaqKey = (text: string) =>
  text
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const NORMALIZED_FAQ_ANSWERS_GPT: Record<string, string> = Object.fromEntries(
  Object.entries(FAQ_SCRIPTED_ANSWERS).map(([q, a]) => [normalizeFaqKey(q), a])
);
const NORMALIZED_FAQ_ANSWERS_SPOTIFY: Record<string, string> = Object.fromEntries(
  Object.entries(SPOTIFY_SCRIPTED_ANSWERS).map(([q, a]) => [normalizeFaqKey(q), a])
);
const ORDER_STATUS_FAQ_KEY = normalizeFaqKey("Где посмотреть статус заказа?");

const ORDER_STAGE_LABELS: Record<OrderStatus, string> = {
  pending: "Ожидает оплату",
  paid: "Оплата подтверждена",
  activating: "В работе",
  waiting_client: "Ждем данные клиента",
  active: "Активировано",
  failed: "Ошибка",
  refunded: "Возврат",
  expired: "Истекло",
};

const ORDER_STAGE_HINTS: Record<OrderStatus, string> = {
  pending: "Ожидаем оплату. После подтверждения сразу передадим в работу.",
  paid: "Платеж получен. Специалист готовит активацию.",
  activating: "Подключаем подписку прямо сейчас.",
  waiting_client: "Нужны данные для активации. Напишите оператору.",
  active: "Подписка успешно активирована.",
  failed: "По заказу возникла ошибка. Оператор уже поможет решить.",
  refunded: "Оформлен возврат средств.",
  expired: "Срок подписки завершился. Можно продлить у оператора.",
};

const ORDER_STATUS_PROGRESS: Record<OrderStatus, number> = {
  pending: 1,
  paid: 2,
  activating: 3,
  waiting_client: 3,
  active: 4,
  failed: 4,
  refunded: 4,
  expired: 4,
};

function buildOrderStatusAnswer(order: LatestOrderInfo | null): string {
  if (!order) {
    return "У вас пока нет активных заказов. Если хотите, оператор поможет оформить подписку за пару минут.";
  }

  const stage = ORDER_STAGE_LABELS[order.status] ?? "В обработке";
  const hint = ORDER_STAGE_HINTS[order.status] ?? "Оператор подскажет детали по вашему заказу.";

  return `Текущий этап заказа: ${stage}. ${hint}`;
}

const NAV = [
  { Icon: Home, label: "Главная", href: "/" },
  { Icon: MessageCircle, label: "Поддержка", href: "/support" },
  { Icon: ShoppingBag, label: "Мои заказы", href: "/dashboard/orders" },
  { Icon: User, label: "Профиль", href: "/dashboard/profile" },
];

export default function SupportPage() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const siteParam = searchParams.get("site") ?? "";
  const isSubsStore = siteParam === "subs-store";

  const QUICK = isSubsStore ? QUICK_SPOTIFY : QUICK_GPT;
  const FAQ_ITEMS = isSubsStore ? FAQ_ITEMS_SPOTIFY : FAQ_ITEMS_GPT;
  const NORMALIZED_FAQ_ANSWERS = isSubsStore
    ? NORMALIZED_FAQ_ANSWERS_SPOTIFY
    : NORMALIZED_FAQ_ANSWERS_GPT;

  const accentColor = isSubsStore ? "#1DB954" : "#10a37f";
  const brandName = isSubsStore ? "Subs Store" : "GPT STORE";
  const brandLetter = isSubsStore ? "S" : "G";
  const brandHref = isSubsStore ? "/spotify" : "/";
  const greetingMsg = isSubsStore
    ? "Здравствуйте! Я помогу с вопросами о Spotify Premium. Чем могу помочь?"
    : "Здравствуйте! Я отвечу на вопросы о ChatGPT Plus и Pro. Чем могу помочь?";

  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: greetingMsg,
      time: getTime(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [latestOrder, setLatestOrder] = useState<LatestOrderInfo | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (isSubsStore) {
      const subs = tryCreateSubsBrowserClient();
      if (!subs) {
        setIsAuthorized(false);
        return;
      }
      subs.auth.getSession().then(({ data }) => {
        setIsAuthorized(Boolean(data.session?.user));
      });
      const {
        data: { subscription },
      } = subs.auth.onAuthStateChange((_, session) => {
        setIsAuthorized(Boolean(session?.user));
      });
      return () => subscription.unsubscribe();
    }
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      setIsAuthorized(Boolean(data.session?.user));
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_, session) => {
      setIsAuthorized(Boolean(session?.user));
    });
    return () => subscription.unsubscribe();
  }, [isSubsStore]);

  const goToLiveChat = () => {
    void (async () => {
      const chatPath = isSubsStore ? "/dashboard/chat?site=subs-store" : "/dashboard/chat";
      if (isSubsStore) {
        const subs = tryCreateSubsBrowserClient();
        const { data: auth } = subs ? await subs.auth.getUser() : { data: { user: null } };
        if (!auth.user) {
          router.push(`/login?site=subs-store&returnUrl=${encodeURIComponent(chatPath)}`);
          return;
        }
        router.push(chatPath);
        return;
      }
      const supabase = createClient();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        router.push(`/login?returnUrl=${encodeURIComponent(chatPath)}`);
        return;
      }
      const { data: prof } = await supabase
        .from("profiles")
        .select("role, email")
        .eq("id", auth.user.id)
        .maybeSingle();
      const r = resolveClientNavRole(prof?.email ?? auth.user.email, prof?.role ?? "client");
      if (r === "admin") router.push("/admin/chat");
      else if (r === "operator") router.push("/operator/chat");
      else router.push(chatPath);
    })();
  };

  useEffect(() => {
    if (!isAuthorized) {
      setLatestOrder(null);
      return;
    }

    const loadLatestOrder = async () => {
      if (isSubsStore) {
        const subs = tryCreateSubsBrowserClient();
        if (!subs) return;
        const { data: auth } = await subs.auth.getUser();
        if (!auth.user) return;
        const { data } = await subs
          .from("orders")
          .select("id,status,created_at,plan_id")
          .eq("user_id", auth.user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (data) {
          setLatestOrder({ ...(data as LatestOrderInfo), product: "spotify" });
        } else {
          setLatestOrder(null);
        }
        return;
      }
      const supabase = createClient();
      const { data } = await supabase
        .from("orders")
        .select("id,status,created_at,plan_id,product")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        setLatestOrder(data as LatestOrderInfo);
      } else {
        setLatestOrder(null);
      }
    };

    void loadLatestOrder();
  }, [isAuthorized, isSubsStore]);

  const sendMessage = (text: string) => {
    if (!text.trim()) return;
    if (isAuthorized === null) return;
    if (!isAuthorized) {
      const loginUrl = isSubsStore
        ? `/login?site=subs-store&returnUrl=${encodeURIComponent("/dashboard/chat?site=subs-store")}`
        : "/login";
      router.push(loginUrl);
      return;
    }
    setInput("");
    const userMsg: Message = { role: "user", content: text, time: getTime() };
    const normalizedText = normalizeFaqKey(text);
    let scriptedAnswer =
      NORMALIZED_FAQ_ANSWERS[normalizedText] ??
      "Ваш вопрос передан оператору. Пожалуйста, дождитесь ответа — оператор подключится и поможет.";

    if (normalizedText === ORDER_STATUS_FAQ_KEY) {
      scriptedAnswer = buildOrderStatusAnswer(latestOrder);
    }

    setMessages((prev) => [
      ...prev,
      userMsg,
      { role: "assistant", content: scriptedAnswer, time: getTime() },
    ]);
  };

  const showQuickReplies = messages.length <= 1;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-gray-50">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden
        />
      )}

      <aside
        className={`fixed left-0 top-0 z-30 flex h-full w-60 flex-col bg-[#111827] transition-transform duration-150 lg:static lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="border-b border-white/10 px-4 py-5">
          <a href={brandHref} className="flex items-center gap-2">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold text-white"
              style={{ backgroundColor: accentColor }}
            >
              {brandLetter}
            </div>
            <span className="font-heading text-sm font-bold text-white">{brandName}</span>
          </a>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.Icon;
            return (
              <a
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors duration-100 ${
                  isActive
                    ? "border-l-2 border-[#10a37f] bg-[#10a37f]/15 pl-2.5 text-[#10a37f]"
                    : "text-gray-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon size={16} className="shrink-0 opacity-90" />
                <span>{item.label}</span>
              </a>
            );
          })}
        </nav>

        <div className="border-t border-white/10 px-4 py-4">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[#10a37f]" />
            <span className="text-xs text-gray-400">На связи</span>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-3 lg:hidden">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
            aria-label="Открыть меню"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="font-semibold text-gray-900">Поддержка</span>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="px-4 pb-0 pt-4" style={{ backgroundColor: accentColor }}>
            <div className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-lg font-bold text-white">
                  {brandLetter}
                </div>
                <div>
                  <p className="font-semibold text-white">{brandName} — поддержка</p>
                  <p className="flex items-center gap-1 text-xs text-white/80">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                    На связи
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={goToLiveChat}
                className="shrink-0 rounded-xl bg-white px-4 py-2.5 text-center text-sm font-semibold text-[#10a37f] shadow-sm transition-opacity hover:opacity-95"
              >
                Чат с оператором
              </button>
            </div>

            <div className="mx-0 mb-3 rounded-lg bg-white/15 p-0.5">
              <div className="rounded-md bg-white py-1.5 text-center text-xs font-medium text-[#10a37f]">
                Быстрые ответы ниже · живой чат — кнопка справа
              </div>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
            <>
              {latestOrder && (
                <div className="border-b border-gray-100 bg-[#10a37f]/5 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-gray-500">Последний заказ</p>
                      <p className="text-sm font-semibold text-gray-900">
                        {latestOrder.product === "chatgpt-pro" ? "ChatGPT Pro" : "ChatGPT Plus"}
                        {latestOrder.plan_id ? ` · ${latestOrder.plan_id}` : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Этап</p>
                      <p className="text-sm font-semibold text-[#10a37f]">
                        {ORDER_STAGE_LABELS[latestOrder.status]}
                      </p>
                      <p className="text-[11px] text-gray-500">
                        Шаг {ORDER_STATUS_PROGRESS[latestOrder.status]} из 4
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {messages.map((msg, i) => (
                  <motion.div
                    key={`${i}-${msg.time}`}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div className="max-w-[75%]">
                      <div
                        className={`p-3 text-sm leading-relaxed ${
                          msg.role === "user" ? "bg-[#10a37f] text-white" : "bg-gray-100 text-gray-900"
                        }`}
                        style={{
                          borderRadius:
                            msg.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                        }}
                      >
                        {msg.content}
                      </div>
                      <p className="mt-1 px-1 text-[10px] text-gray-400">{msg.time}</p>
                    </div>
                  </motion.div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {showQuickReplies && (
                <div className="border-t border-gray-100 px-3 py-2">
                  <div className="flex gap-1.5 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden">
                    {QUICK.map((q) => (
                      <button
                        key={q.msg}
                        type="button"
                        onClick={() => sendMessage(q.msg)}
                        className="shrink-0 rounded-full border border-[#10a37f]/30 px-3 py-1.5 text-xs text-[#10a37f] transition-colors duration-100 hover:bg-[#10a37f]/10"
                      >
                        {q.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="border-t border-gray-100 p-3">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    sendMessage(input);
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Введите сообщение"
                    className="flex-1 rounded-full bg-gray-100 px-4 py-2 text-sm outline-none transition-colors duration-100 focus:ring-2 focus:ring-[#10a37f]/20"
                  />
                  <button
                    type="submit"
                    disabled={!input.trim()}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#10a37f] text-white transition-opacity duration-100 hover:opacity-90 disabled:opacity-40"
                  >
                    <Send size={14} />
                  </button>
                </form>
              </div>
            </>
          </div>
        </div>
      </div>

      <aside className="hidden w-72 flex-col overflow-y-auto border-l border-gray-200 bg-white xl:flex">
        <div className="border-b border-gray-100 px-4 py-4">
          <p className="text-sm font-semibold text-gray-900">Частые вопросы</p>
          <p className="mt-0.5 text-xs text-gray-400">Нажмите вопрос чтобы отправить его в чат</p>
        </div>
        <div className="flex-1 px-2 py-2">
          {FAQ_ITEMS.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => {
                sendMessage(q);
              }}
              className="group flex w-full items-center justify-between rounded-lg border-b border-gray-100 px-3 py-2.5 text-left text-sm text-gray-600 transition-all duration-150 last:border-0 hover:bg-[#10a37f]/8 hover:text-[#10a37f]"
            >
              <span>{q}</span>
              <span className="ml-2 shrink-0 text-[#10a37f] opacity-0 transition-opacity group-hover:opacity-100">
                →
              </span>
            </button>
          ))}
        </div>
      </aside>
    </div>
  );
}
