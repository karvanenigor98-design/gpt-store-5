"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";

type TariffRow = {
  id: string;
  slug: string;
  title: string;
  price: number;
  old_price: number | null;
  category: string;
  badge: string | null;
  description?: string | null;
  short_description?: string | null;
  duration_months?: number | null;
  monthly_price?: number | null;
  savings_text?: string | null;
  is_popular: boolean;
  is_best_value: boolean;
  is_active: boolean;
  sort_order: number;
  cta_text?: string | null;
  allow_promocodes?: boolean;
  allow_discounts?: boolean;
};

const CATEGORY_OPTIONS = [
  { value: "individual", label: "Spotify Individual" },
  { value: "duo", label: "Spotify Duo" },
  { value: "family", label: "Spotify Family" },
] as const;

function monthsToPeriod(months: number | null | undefined): string {
  if (months === 3) return "3 мес";
  if (months === 6) return "6 мес";
  if (months === 12) return "год";
  return "мес";
}

function periodToMonths(period: string): number {
  if (period === "3 мес") return 3;
  if (period === "6 мес") return 6;
  if (period === "год") return 12;
  return 1;
}

export function SubsTariffsManager() {
  const [items, setItems] = useState<TariffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/subs-store/tariffs", { credentials: "include" });
      const json = (await res.json()) as { items?: TariffRow[]; error?: string };
      if (!res.ok) {
        setErr(json.error ?? `Ошибка ${res.status}`);
        setItems([]);
      } else {
        setErr(null);
        setItems(json.items ?? []);
      }
    } catch {
      setErr("Не удалось загрузить тарифы Subs Store.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function patchLocal(id: string, patch: Partial<TariffRow>) {
    setItems((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  async function onSave() {
    if (!items.length) return;
    setSaving(true);
    setErr(null);
    try {
      const results = await Promise.all(
        items.map(async (row) => {
          const res = await fetch("/api/admin/subs-store/tariffs", {
            method: "PATCH",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: row.id,
              price: row.price,
              title: row.title,
              category: row.category,
              duration_months: row.duration_months,
              is_popular: row.is_popular,
              is_best_value: row.is_best_value,
              is_active: row.is_active,
              sort_order: row.sort_order,
              badge: row.badge,
              old_price: row.old_price,
              monthly_price: row.monthly_price,
              savings_text: row.savings_text,
              short_description: row.short_description,
              description: row.description,
              cta_text: row.cta_text,
              allow_promocodes: row.allow_promocodes,
              allow_discounts: row.allow_discounts,
            }),
          });
          const json = (await res.json()) as { error?: string };
          return { ok: res.ok, error: json.error };
        }),
      );
      const failed = results.find((r) => !r.ok);
      if (failed) {
        setErr(failed.error ?? "Не удалось сохранить часть тарифов");
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      await load();
    } catch {
      setErr("Не удалось сохранить тарифы.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <p className="flex items-center gap-2 text-sm text-gray-500">
        <Loader2 size={14} className="animate-spin" />
        Загрузка тарифов…
      </p>
    );
  }

  if (err && items.length === 0) {
    return <p className="text-sm text-red-700">{err}</p>;
  }

  return (
    <div className="space-y-4">
      {items.length === 0 && (
        <p className="text-sm text-amber-700">
          Тарифы в Supabase пусты — на лендинге используется static fallback из кода. Добавьте строки в
          таблицу tariffs.
        </p>
      )}

      <div className="space-y-3">
        {items.map((row) => (
          <div key={row.id} className="rounded-xl border border-gray-200 bg-white p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-gray-800">{row.title}</p>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-gray-500">
                {row.slug}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <div>
                <label className="mb-1 block text-xs text-gray-500">Продукт</label>
                <select
                  value={row.category}
                  onChange={(e) => patchLocal(row.id, { category: e.target.value })}
                  className="w-full rounded-lg border border-gray-200 px-2.5 py-2 text-sm"
                >
                  {CATEGORY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">Цена (₽)</label>
                <input
                  type="number"
                  value={row.price}
                  onChange={(e) => patchLocal(row.id, { price: Number(e.target.value) || 0 })}
                  className="w-full rounded-lg border border-gray-200 px-2.5 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">Период</label>
                <select
                  value={monthsToPeriod(row.duration_months)}
                  onChange={(e) =>
                    patchLocal(row.id, { duration_months: periodToMonths(e.target.value) })
                  }
                  className="w-full rounded-lg border border-gray-200 px-2.5 py-2 text-sm"
                >
                  <option value="мес">мес</option>
                  <option value="3 мес">3 мес</option>
                  <option value="6 мес">6 мес</option>
                  <option value="год">год</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">Популярный</label>
                <select
                  value={row.is_popular ? "yes" : "no"}
                  onChange={(e) => patchLocal(row.id, { is_popular: e.target.value === "yes" })}
                  className="w-full rounded-lg border border-gray-200 px-2.5 py-2 text-sm"
                >
                  <option value="no">Нет</option>
                  <option value="yes">Да</option>
                </select>
              </div>
            </div>
          </div>
        ))}
      </div>

      {err && items.length > 0 && <p className="text-sm text-red-700">{err}</p>}

      <button
        type="button"
        onClick={() => void onSave()}
        disabled={saving || items.length === 0}
        className="flex items-center gap-2 rounded-xl bg-[#1DB954] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {saving && <Loader2 size={14} className="animate-spin" />}
        {saved && <Check size={14} />}
        {saved ? "Сохранено!" : "Сохранить тарифы"}
      </button>
    </div>
  );
}
