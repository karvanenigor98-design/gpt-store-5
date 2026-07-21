import type { Metadata } from "next";
import Link from "next/link";
import { SpotifyFooter } from "@/components/spotify/SpotifyFooter";

export const metadata: Metadata = {
  title: "Политика конфиденциальности — SPOTIFY STORE",
  description: "Политика конфиденциальности SPOTIFY STORE — обработка персональных данных",
};

const SUPPORT_TELEGRAM = "https://t.me/subs_support";
const ACCENT = "#1DB954";

export default function SpotifyPrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col" style={{ background: "#0a0a0a", color: "#e5e5e5" }}>
      <header
        className="flex h-14 items-center border-b px-6"
        style={{ borderColor: "rgba(255,255,255,0.07)", background: "rgba(10,10,10,0.95)" }}
      >
        <Link
          href="/spotify"
          className="font-heading text-sm font-semibold text-white transition-opacity hover:opacity-80"
        >
          SPOTIFY <span style={{ color: ACCENT }}>STORE</span>
        </Link>
      </header>

      <main className="mx-auto max-w-3xl flex-1 px-4 py-12">
        <h1
          className="font-heading text-3xl font-bold mb-8"
          style={{ color: "#ffffff" }}
        >
          Политика конфиденциальности
        </h1>
        <p className="text-sm mb-8" style={{ color: "rgba(255,255,255,0.4)" }}>
          SPOTIFY STORE · Актуальная версия
        </p>

        {/*
          ═══════════════════════════════════════════════════════════
          ИНСТРУКЦИЯ ДЛЯ ВЛАДЕЛЬЦА ПРОЕКТА:
          Скопируйте текст политики конфиденциальности из:
          https://telegra.ph/Politika-konfidencialnosti-12-10-46
          и вставьте его в разделы ниже вместо placeholder-блоков.
          ═══════════════════════════════════════════════════════════
        */}

        <div className="space-y-8" style={{ color: "rgba(255,255,255,0.75)" }}>
          <section>
            <h2
              className="font-heading text-xl font-semibold mb-3"
              style={{ color: "#ffffff" }}
            >
              1. Общие положения
            </h2>
            <p>
              Настоящая политика описывает порядок сбора, хранения и использования персональных
              данных пользователей сайта{" "}
              <strong style={{ color: ACCENT }}>SPOTIFY STORE</strong>. Используя сайт, вы соглашаетесь
              с условиями настоящей политики.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold mb-3" style={{ color: "#ffffff" }}>
              2. Какие данные собираются
            </h2>
            <ul className="mt-2 list-disc pl-5 space-y-1">
              <li>Email-адрес при регистрации и оформлении заказа;</li>
              <li>данные, необходимые для активации выбранного тарифа (указываются в чате поддержки);</li>
              <li>технические данные: IP-адрес, тип браузера, cookies — для обеспечения работы сайта;</li>
              <li>история заказов и переписка с поддержкой в рамках сайта.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold mb-3" style={{ color: "#ffffff" }}>
              3. Как используются данные
            </h2>
            <ul className="mt-2 list-disc pl-5 space-y-1">
              <li>выполнение заказа и активация подписки;</li>
              <li>информирование о статусе заказа;</li>
              <li>поддержка пользователя в рамках обращений;</li>
              <li>улучшение работы сервиса.</li>
            </ul>
            <p className="mt-3">
              Данные, переданные для активации, используются исключительно для выполнения конкретной
              услуги. После завершения активации рекомендуем проверить настройки безопасности своего
              аккаунта Spotify.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold mb-3" style={{ color: "#ffffff" }}>
              4. Хранение и защита данных
            </h2>
            <p>
              Данные хранятся на защищённых серверах с использованием современных методов
              шифрования. Доступ к данным имеют только сотрудники, непосредственно выполняющие
              заказ или оказывающие поддержку. Пароли от аккаунтов не хранятся в базе данных
              в открытом виде.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold mb-3" style={{ color: "#ffffff" }}>
              5. Передача данных третьим лицам
            </h2>
            <p>
              Данные не передаются и не продаются третьим лицам в коммерческих целях. Передача
              возможна только в случаях, прямо предусмотренных законодательством, или для
              выполнения обязательств по заказу пользователя.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold mb-3" style={{ color: "#ffffff" }}>
              6. Cookies
            </h2>
            <p>
              Сайт использует cookies для поддержания сессии авторизации и улучшения работы. Вы
              можете отключить cookies в настройках браузера, однако это может повлиять на
              функциональность личного кабинета.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold mb-3" style={{ color: "#ffffff" }}>
              7. Права пользователя
            </h2>
            <p>Пользователь вправе:</p>
            <ul className="mt-2 list-disc pl-5 space-y-1">
              <li>запросить информацию о хранимых данных;</li>
              <li>потребовать исправления или удаления персональных данных;</li>
              <li>отозвать согласие на обработку данных (обратитесь в поддержку).</li>
            </ul>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold mb-3" style={{ color: "#ffffff" }}>
              8. Изменение политики
            </h2>
            <p>
              Политика может быть изменена без предварительного уведомления. Актуальная версия
              публикуется на этой странице. Продолжение использования сайта означает согласие
              с действующей редакцией политики.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold mb-3" style={{ color: "#ffffff" }}>
              9. Контакты
            </h2>
            <p>
              По вопросам обработки персональных данных:{" "}
              <a
                href={SUPPORT_TELEGRAM}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
                style={{ color: ACCENT }}
              >
                @subs_support
              </a>{" "}
              в Telegram.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold mb-3" style={{ color: "#ffffff" }}>
              Платежи и платёжные провайдеры
            </h2>
            <p>
              Реквизиты банковских карт и иные чувствительные платёжные данные не хранятся на серверах Оператора. Оплата
              проходит через сертифицированных платёжных партнёров; они обрабатывают платёж в соответствии со своими
              политиками конфиденциальности и стандартами безопасности (PCI DSS и аналоги). Оператор может получать от
              провайдера статус транзакции, сумму, идентификатор платежа и технические метаданные, необходимые для учёта
              заказа.
            </p>
            <p className="mt-3">
              При возврате денежных средств возвращается сумма, фактически поступившая Оператору после удержания комиссий
              платёжных систем и иных платёжных посредников. Комиссии платёжных сервисов, банков и иных посредников,
              удержанные при совершении платежа и не возвращаемые Оператору, возврату не подлежат.
            </p>
          </section>

          <div
            className="mt-8 rounded-xl border p-4 text-sm"
            style={{ borderColor: `${ACCENT}30`, background: `${ACCENT}08` }}
          >
            <p style={{ color: "rgba(255,255,255,0.5)" }}>
              Актуальный юридический текст доступен по запросу в поддержке.
              Для замены этого placeholder-текста на официальный документ:
              скопируйте текст из{" "}
              <a
                href="https://telegra.ph/Politika-konfidencialnosti-12-10-46"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
                style={{ color: ACCENT }}
              >
                telegra.ph/Politika-konfidencialnosti-12-10-46
              </a>{" "}
              и обновите файл{" "}
              <code className="rounded px-1 text-xs" style={{ background: "rgba(255,255,255,0.08)" }}>
                app/(public)/spotify/privacy/page.tsx
              </code>
              .
            </p>
          </div>
        </div>
      </main>

      <SpotifyFooter />
    </div>
  );
}
