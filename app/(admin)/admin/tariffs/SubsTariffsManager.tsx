"use client";

import { useCallback, useEffect, useState } from "react";

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

const CATEGORY_LABEL: Record<string, string> = {
  individual: "Индивидуальная",
  duo: "Для двоих",
  family: "Family",
};

export function SubsTariffsManager() {
  const [items, setItems] = useState<TariffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

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

  async function saveRow(row: TariffRow) {
    setSavingId(row.id);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/subs-store/tariffs", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: row.id,
          price: row.price,
          old_price: row.old_price,
          title: row.title,
          badge: row.badge,
          short_description: row.short_description,
          description: row.description,
          duration_months: row.duration_months,
          monthly_price: row.monthly_price,
          savings_text: row.savings_text,
          is_popular: row.is_popular,
          is_best_value: row.is_best_value,
          is_active: row.is_active,
          sort_order: row.sort_order,
          cta_text: row.cta_text,
          allow_promocodes: row.allow_promocodes,
          allow_discounts: row.allow_discounts,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setMsg(json.error ?? "Не удалось сохранить");
      } else {
        setMsg("Сохранено — лендинг обновится в течение нескольких секунд.");
        await load();
      }
    } catch {
      setMsg("Ошибка сети при сохранении.");
    }
    setSavingId(null);
  }

  function patchLocal(id: string, patch: Partial<TariffRow>) {
    setItems((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  if (loading) return <p className="text-sm text-gray-500">Загрузка тарифов…</p>;
  if (err) return <p className="text-sm text-red-600">{err}</p>;

  return (
    <div className="space-y-4">
      {msg && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {msg}
        </p>
      )}
      <p className="text-sm text-gray-600">
        Изменения цены, бейджа, популярности и порядка сразу попадают на лендинг Subs Store (poll каждые 5 с).
        GPT STORE не затрагивается.
      </p>
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="min-w-[960px] w-full text-left text-sm">
          <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-3 py-2">Порядок</th>
              <th className="px-3 py-2">Категория</th>
              <th className="px-3 py-2">Название / slug</th>
              <th className="px-3 py-2">Цена</th>
              <th className="px-3 py-2">Старая</th>
              <th className="px-3 py-2">₽/мес</th>
              <th className="px-3 py-2">Бейдж</th>
              <th className="px-3 py-2">Флаги</th>
              <th className="px-3 py-2">Активен</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row.id} className="border-b border-gray-100 align-top">
                <td className="px-3 py-2">
                  <input
                    type="number"
                    className="w-14 rounded border px-2 py-1"
                    value={row.sort_order}
                    onChange={(e) =>
                      patchLocal(row.id, { sort_order: Number(e.target.value) || 0 })
                    }
                  />
                </td>
                <td className="px-3 py-2 text-xs text-gray-600">
                  {CATEGORY_LABEL[row.category] ?? row.category}
                </td>
                <td className="px-3 py-2">
                  <input
                    className="mb-1 w-full min-w-[140px] rounded border px-2 py-1 font-medium"
                    value={row.title}
                    onChange={(e) => patchLocal(row.id, { title: e.target.value })}
                  />
                  <span className="text-xs text-gray-400">{row.slug}</span>
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    className="w-20 rounded border px-2 py-1"
                    value={row.price}
                    onChange={(e) => patchLocal(row.id, { price: Number(e.target.value) || 0 })}
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    className="w-20 rounded border px-2 py-1"
                    value={row.old_price ?? ""}
                    placeholder="—"
                    onChange={(e) =>
                      patchLocal(row.id, {
                        old_price: e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    className="w-16 rounded border px-2 py-1"
                    value={row.monthly_price ?? ""}
                    placeholder="авто"
                    onChange={(e) =>
                      patchLocal(row.id, {
                        monthly_price: e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    className="w-28 rounded border px-2 py-1 text-xs"
                    value={row.badge ?? ""}
                    placeholder="Популярный"
                    onChange={(e) => patchLocal(row.id, { badge: e.target.value || null })}
                  />
                </td>
                <td className="px-3 py-2">
                  <label className="mb-1 flex items-center gap-1 text-xs">
                    <input
                      type="checkbox"
                      checked={row.is_popular}
                      onChange={(e) => patchLocal(row.id, { is_popular: e.target.checked })}
                    />
                    Популярный
                  </label>
                  <label className="flex items-center gap-1 text-xs">
                    <input
                      type="checkbox"
                      checked={row.is_best_value}
                      onChange={(e) => patchLocal(row.id, { is_best_value: e.target.checked })}
                    />
                    Макс. выгода
                  </label>
                </td>
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={row.is_active}
                    onChange={(e) => patchLocal(row.id, { is_active: e.target.checked })}
                  />
                </td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    disabled={savingId === row.id}
                    onClick={() => void saveRow(row)}
                    className="rounded-lg bg-[#1DB954] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    {savingId === row.id ? "…" : "Сохранить"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {items.length === 0 && (
        <p className="text-sm text-amber-700">
          Тарифы в Supabase пусты — на лендинге используется static fallback из кода. Добавьте строки в
          таблицу tariffs или выполните seed.
        </p>
      )}
    </div>
  );
}
