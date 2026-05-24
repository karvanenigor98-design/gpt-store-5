"use client";

import { useMemo, useState } from "react";
import { Loader2, Check } from "lucide-react";
import Link from "next/link";

interface Props {
  initialMap: Record<string, unknown>;
}

function str(v: unknown, fallback = ""): string {
  if (typeof v === "string") return v;
  if (v == null) return fallback;
  return String(v);
}

function parseLandingSections(raw: unknown) {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    return {
      showReviews: o.showReviews !== false,
      showFaq: o.showFaq !== false,
      showCompare: o.showCompare !== false,
    };
  }
  return { showReviews: true, showFaq: true, showCompare: false };
}

const DELAY_OPTIONS = [0, 2, 5, 10, 15, 20, 30, 45, 60];
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => i);

export function SubsSiteSettingsForm({ initialMap }: Props) {
  const [seoTitle, setSeoTitle] = useState(str(initialMap.seoTitle, "SPOTIFY STORE — Spotify Premium"));
  const [seoDescription, setSeoDescription] = useState(
    str(initialMap.seoDescription, "Подключение Spotify Premium в России с оплатой в рублях и поддержкой."),
  );
  const [supportUsername, setSupportUsername] = useState(str(initialMap.supportUsername, "@subs_support"));
  const [operatorTelegramUrl, setOperatorTelegramUrl] = useState(
    str(initialMap.operator_telegram_url, "https://t.me/subs_support"),
  );
  const [autoReplyDelay, setAutoReplyDelay] = useState(String(initialMap.auto_reply_delay_minutes ?? 15));
  const [nightStart, setNightStart] = useState(String(initialMap.night_start_hour ?? 22));
  const [nightEnd, setNightEnd] = useState(String(initialMap.night_end_hour ?? 9));
  const [spotifyDataNotice, setSpotifyDataNotice] = useState(
    str(
      initialMap.spotify_data_notice,
      "Для подключения Spotify Premium оператору могут понадобиться данные вашего Spotify-аккаунта — только для активации подписки. Мы не меняем личные настройки и используем данные только для подключения услуги.",
    ),
  );
  const initialSections = useMemo(() => parseLandingSections(initialMap.landing_sections), [initialMap.landing_sections]);
  const [sections, setSections] = useState(initialSections);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/subs-store/settings", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seoTitle: seoTitle.trim(),
          seoDescription: seoDescription.trim(),
          supportUsername: supportUsername.trim(),
          operator_telegram_url: operatorTelegramUrl.trim(),
          auto_reply_delay_minutes: Number(autoReplyDelay),
          night_start_hour: Number(nightStart),
          night_end_hour: Number(nightEnd),
          spotify_data_notice: spotifyDataNotice.trim(),
          landing_sections: sections,
        }),
      });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(j.error ?? "Не удалось сохранить настройки Spotify Store");
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError("Сеть: не удалось сохранить настройки Spotify Store.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-600">
        Тарифы Spotify редактируются в{" "}
        <Link href="/admin/tariffs?site=subs-store" className="text-[#1DB954] hover:underline">
          разделе «Тарифы»
        </Link>
        , FAQ и отзывы — в соответствующих разделах админки.
      </p>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">SEO — заголовок</label>
        <input
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          value={seoTitle}
          onChange={(e) => setSeoTitle(e.target.value)}
        />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">SEO — описание</label>
        <textarea
          className="min-h-[80px] w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          value={seoDescription}
          onChange={(e) => setSeoDescription(e.target.value)}
        />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">Telegram поддержки</label>
        <input
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          value={supportUsername}
          onChange={(e) => setSupportUsername(e.target.value)}
          placeholder="@subs_support"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">Ссылка на оператора в Telegram</label>
        <input
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          value={operatorTelegramUrl}
          onChange={(e) => setOperatorTelegramUrl(e.target.value)}
          placeholder="https://t.me/subs_support"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Задержка авто-ответа</label>
          <select
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            value={autoReplyDelay}
            onChange={(e) => setAutoReplyDelay(e.target.value)}
          >
            {DELAY_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m} мин
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Начало ночного режима</label>
          <select
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            value={nightStart}
            onChange={(e) => setNightStart(e.target.value)}
          >
            {HOUR_OPTIONS.map((h) => (
              <option key={h} value={h}>
                {String(h).padStart(2, "0")}:00
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Конец ночного режима</label>
          <select
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            value={nightEnd}
            onChange={(e) => setNightEnd(e.target.value)}
          >
            {HOUR_OPTIONS.map((h) => (
              <option key={h} value={h}>
                {String(h).padStart(2, "0")}:00
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">
          Текст про данные Spotify (FAQ / checkout / кабинет)
        </label>
        <textarea
          className="min-h-[100px] w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          value={spotifyDataNotice}
          onChange={(e) => setSpotifyDataNotice(e.target.value)}
        />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">Видимость блоков лендинга</label>
        <div className="space-y-2 rounded-xl border border-gray-200 bg-white p-3">
          {[
            { key: "showReviews", label: "Показывать отзывы" },
            { key: "showFaq", label: "Показывать FAQ" },
            { key: "showCompare", label: "Показывать сравнение тарифов" },
          ].map((item) => (
            <label
              key={item.key}
              className="flex cursor-pointer items-center justify-between rounded-lg border border-gray-100 px-3 py-2"
            >
              <span className="text-sm text-gray-700">{item.label}</span>
              <input
                type="checkbox"
                checked={sections[item.key as keyof typeof sections]}
                onChange={(e) =>
                  setSections((prev) => ({
                    ...prev,
                    [item.key]: e.target.checked,
                  }))
                }
                className="h-4 w-4 rounded border-gray-300 accent-[#1DB954]"
              />
            </label>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="button"
        onClick={() => void onSave()}
        disabled={saving}
        className="inline-flex items-center gap-2 rounded-xl bg-[#1DB954] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
      >
        {saving ? <Loader2 size={16} className="animate-spin" /> : saved ? <Check size={16} /> : null}
        Сохранить настройки Spotify Store
      </button>
    </div>
  );
}
