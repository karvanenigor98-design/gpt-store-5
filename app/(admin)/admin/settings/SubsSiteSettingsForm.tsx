"use client";

import { useState } from "react";
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

export function SubsSiteSettingsForm({ initialMap }: Props) {
  const [seoTitle, setSeoTitle] = useState(str(initialMap.seoTitle, "Subs Store — Spotify Premium"));
  const [seoDescription, setSeoDescription] = useState(
    str(
      initialMap.seoDescription,
      "Подключение Spotify Premium в России с оплатой в рублях и поддержкой.",
    ),
  );
  const [supportUsername, setSupportUsername] = useState(str(initialMap.supportUsername, "@subs_support"));
  const [spotifyDataNotice, setSpotifyDataNotice] = useState(
    str(
      initialMap.spotify_data_notice,
      "Для подключения Spotify Premium оператору могут понадобиться данные вашего Spotify-аккаунта — только для активации подписки. Мы не меняем личные настройки и используем данные только для подключения услуги.",
    ),
  );
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
          spotify_data_notice: spotifyDataNotice.trim(),
        }),
      });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(j.error ?? "Не удалось сохранить настройки Subs Store");
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError("Сеть: не удалось сохранить настройки Subs Store.");
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
        , FAQ и отзывы — в соответствующих разделах админки с переключателем Subs Store.
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
        <label className="mb-1.5 block text-sm font-medium text-gray-700">
          Текст про данные Spotify (FAQ / checkout / кабинет)
        </label>
        <textarea
          className="min-h-[100px] w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          value={spotifyDataNotice}
          onChange={(e) => setSpotifyDataNotice(e.target.value)}
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="button"
        onClick={() => void onSave()}
        disabled={saving}
        className="inline-flex items-center gap-2 rounded-xl bg-[#1DB954] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
      >
        {saving ? <Loader2 size={16} className="animate-spin" /> : saved ? <Check size={16} /> : null}
        Сохранить настройки Subs Store
      </button>
    </div>
  );
}
