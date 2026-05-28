import type { Metadata } from "next";
import Link from "next/link";
import { SpotifyFooter } from "@/components/spotify/SpotifyFooter";

export const metadata: Metadata = {
  title: "Пользовательское соглашение — SPOTIFY STORE",
  description: "Условия использования сервиса SPOTIFY STORE — подключение Spotify Premium в России",
};

const SUPPORT_TELEGRAM = "https://t.me/subs_support";
const ACCENT = "#1DB954";

export default function SpotifyTermsPage() {
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
          Пользовательское соглашение
        </h1>
        <p className="text-sm mb-8" style={{ color: "rgba(255,255,255,0.4)" }}>
          SPOTIFY STORE · Актуальная версия
        </p>

        {/* 
          ═══════════════════════════════════════════════════════════
          ИНСТРУКЦИЯ ДЛЯ ВЛАДЕЛЬЦА ПРОЕКТА:
          Скопируйте текст пользовательского соглашения из:
          https://telegra.ph/Polzovatelskoe-soglashenie-12-10-36
          и вставьте его в разделы ниже вместо placeholder-блоков.
          ═══════════════════════════════════════════════════════════
        */}

        <div className="space-y-8" style={{ color: "rgba(255,255,255,0.75)" }}>
          <section>
            <h2
              className="font-heading text-xl font-semibold mb-3"
              style={{ color: "#ffffff" }}
            >
              1. Термины и определения
            </h2>
            <p>
              <strong style={{ color: "#fff" }}>Сервис / Продавец</strong> — интернет-сайт и связанные с ним
              процессы оформления заказа под брендом{" "}
              <strong style={{ color: ACCENT }}>SPOTIFY STORE</strong>.{" "}
              <strong style={{ color: "#fff" }}>Пользователь</strong> — физическое лицо, оформившее заказ или
              использующее сайт.{" "}
              <strong style={{ color: "#fff" }}>Услуга</strong> — комплекс действий по подключению или
              продлению выбранного тарифа Spotify Premium на указанных в заказе условиях.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold mb-3" style={{ color: "#ffffff" }}>
              2. Предмет соглашения
            </h2>
            <p>
              Настоящее соглашение регулирует порядок использования сайта, оформления и оплаты заказов,
              а также права и обязанности сторон. Акцептом оферты считается совершение действий по
              оформлению и оплате заказа на сайте либо регистрация в личном кабинете с принятием условий.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold mb-3" style={{ color: "#ffffff" }}>
              3. Описание услуг
            </h2>
            <p>Сервис оказывает услуги посреднического и технического характера, в том числе:</p>
            <ul className="mt-2 list-disc pl-5 space-y-1">
              <li>приём и обработка заказа на подключение или продление выбранного тарифа Spotify Premium;</li>
              <li>информирование о статусе заказа (через личный кабинет и службу поддержки);</li>
              <li>сопровождение активации в рамках приобретённой услуги.</li>
            </ul>
            <p className="mt-3">
              Сервис не является правообладателем Spotify и действует в рамках действующего
              законодательства. Названия и товарные знаки Spotify принадлежат Spotify AB.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold mb-3" style={{ color: "#ffffff" }}>
              4. Данные для активации
            </h2>
            <p>
              В большинстве случаев для активации достаточно базовых данных или кода подтверждения.
              В отдельных тарифах или ситуациях специалист может запросить дополнительные данные
              или дать инструкцию по настройке доступа. Специалист заранее уточнит, что именно
              потребуется после оформления заказа.
            </p>
            <p className="mt-3">
              Сервис использует переданные данные только для выполнения услуги активации. После
              завершения подключения пользователь может обновить настройки безопасности своего аккаунта.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold mb-3" style={{ color: "#ffffff" }}>
              5. Сроки оказания услуги
            </h2>
            <p>
              Стандартный срок активации после подтверждения оплаты — до{" "}
              <strong style={{ color: "#fff" }}>30 минут</strong>. В большинстве случаев активация
              выполняется в интервале{" "}
              <strong style={{ color: "#fff" }}>5–15 минут</strong>. При высокой нагрузке срок может
              увеличиваться; поддержка уведомляет пользователя о статусе.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold mb-3" style={{ color: "#ffffff" }}>
              6. Порядок оформления заказа
            </h2>
            <ol className="mt-2 list-decimal pl-5 space-y-1">
              <li>Пользователь выбирает тариф и оформляет заказ.</li>
              <li>Оплата производится доступными на сайте способами.</li>
              <li>После подтверждения платежа заказ передаётся в обработку.</li>
              <li>Специалист связывается с пользователем для завершения активации.</li>
            </ol>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold mb-3" style={{ color: "#ffffff" }}>
              7. Оплата и цена
            </h2>
            <p>
              Цена услуги указывается на сайте на момент оформления заказа. Оплата принимается в
              рублях картами РФ и через СБП. Комиссии платёжных систем, не зависящие от Продавца,
              оплачиваются пользователем самостоятельно, если иное прямо не указано на странице оплаты.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold mb-3" style={{ color: "#ffffff" }}>
              8. Возврат денежных средств
            </h2>
            <p>
              Возврат возможен в случаях, когда услуга не была оказана по вине Продавца либо оказание
              услуги объективно невозможно. Запрос направляется в службу поддержки с указанием
              номера заказа и причины. Частичный возврат за неиспользованный период возможен в
              отдельных случаях по решению поддержки.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold mb-3" style={{ color: "#ffffff" }}>
              9. Гарантия
            </h2>
            <p>
              Продавец предоставляет гарантию на период работы подписки согласно условиям выбранного
              варианта. Если Premium перестанет работать по вине Продавца — восстановим доступ или
              предложим решение. Претензии принимаются через службу поддержки.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold mb-3" style={{ color: "#ffffff" }}>
              10. Обязанности пользователя
            </h2>
            <ul className="mt-2 list-disc pl-5 space-y-1">
              <li>предоставлять достоверные контактные данные;</li>
              <li>соблюдать пользовательские соглашения Spotify;</li>
              <li>не использовать сервис для противоправных целей;</li>
              <li>самостоятельно обеспечивать безопасность доступа к аккаунту на сайте.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold mb-3" style={{ color: "#ffffff" }}>
              11. Персональные данные
            </h2>
            <p>
              Обработка персональных данных осуществляется в соответствии с{" "}
              <Link href="/spotify/privacy" className="hover:underline" style={{ color: ACCENT }}>
                политикой конфиденциальности SPOTIFY STORE
              </Link>
              .
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold mb-3" style={{ color: "#ffffff" }}>
              12. Изменение условий
            </h2>
            <p>
              Продавец вправе изменять текст соглашения. Актуальная редакция публикуется на этой
              странице. Для уже оплаченных заказов применяются условия, действовавшие на момент
              оплаты.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold mb-3" style={{ color: "#ffffff" }}>
              13. Контакты и поддержка
            </h2>
            <p>
              По вопросам заказов, возвратов и условий:{" "}
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

          <div
            className="mt-8 rounded-xl border p-4 text-sm"
            style={{ borderColor: `${ACCENT}30`, background: `${ACCENT}08` }}
          >
            <p style={{ color: "rgba(255,255,255,0.5)" }}>
              Актуальный юридический текст доступен по запросу в поддержке.
              Для замены этого placeholder-текста на официальный документ:
              скопируйте текст из{" "}
              <a
                href="https://telegra.ph/Polzovatelskoe-soglashenie-12-10-36"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
                style={{ color: ACCENT }}
              >
                telegra.ph/Polzovatelskoe-soglashenie-12-10-36
              </a>{" "}
              и обновите файл{" "}
              <code className="rounded px-1 text-xs" style={{ background: "rgba(255,255,255,0.08)" }}>
                app/(public)/spotify/terms/page.tsx
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
