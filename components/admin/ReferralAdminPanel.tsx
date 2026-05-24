"use client";

import { useCallback, useEffect, useState } from "react";

type Settings = {
  refereeDiscountPercent: number;
  referrerDiscountPercent: number;
};

export function ReferralAdminPanel({ adminSite }: { adminSite: "gpt-store" | "subs-store" }) {
  const [settings, setSettings] = useState<Settings>({ refereeDiscountPercent: 10, referrerDiscountPercent: 10 });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/referrals/settings?site=${adminSite}`);
    const json = (await res.json()) as { settings?: Settings; error?: string };
    if (res.ok && json.settings) setSettings(json.settings);
  }, [adminSite]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    setSaving(true);
    setMsg(null);
    const res = await fetch("/api/admin/referrals/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ site: adminSite, ...settings }),
    });
    const json = (await res.json()) as { error?: string };
    setSaving(false);
    setMsg(res.ok ? "Сохранено" : json.error ?? "Ошибка");
  }

  return (
    <div className="mb-5 rounded-xl border border-emerald-200/80 bg-emerald-50/50 p-4">
      <p className="text-sm font-semibold text-gray-900">Реферальная программа</p>
      <p className="mt-1 text-xs text-gray-600">
        Друг по ссылке получает промокод на первый заказ, пригласивший — на следующий. Промокоды создаются
        автоматически после первой оплаты друга.
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-4">
        <label className="text-xs text-gray-600">
          Скидка другу (%)
          <input
            type="number"
            min={1}
            max={90}
            value={settings.refereeDiscountPercent}
            onChange={(e) =>
              setSettings((s) => ({ ...s, refereeDiscountPercent: Number(e.target.value) }))
            }
            className="mt-1 block w-24 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm"
          />
        </label>
        <label className="text-xs text-gray-600">
          Скидка пригласившему (%)
          <input
            type="number"
            min={1}
            max={90}
            value={settings.referrerDiscountPercent}
            onChange={(e) =>
              setSettings((s) => ({ ...s, referrerDiscountPercent: Number(e.target.value) }))
            }
            className="mt-1 block w-24 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm"
          />
        </label>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="rounded-lg bg-[#10a37f] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {saving ? "Сохранение…" : "Сохранить скидки"}
        </button>
      </div>
      {msg && <p className="mt-2 text-xs text-gray-600">{msg}</p>}
    </div>
  );
}
