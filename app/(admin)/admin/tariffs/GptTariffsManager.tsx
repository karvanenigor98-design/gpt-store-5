"use client";

import { useMemo, useState } from "react";
import { Loader2, Check } from "lucide-react";
import { CHATGPT_PLANS, type ExtendedPlan } from "@/lib/chatgpt-data";

interface Props {
  initialSettings: Record<string, unknown>;
}

type EditablePlan = {
  id: string;
  productId: "chatgpt-plus" | "chatgpt-pro";
  name: string;
  price: number;
  period: string;
  isPopular: boolean;
  currency: string;
};

function toEditable(plan: ExtendedPlan): EditablePlan {
  return {
    id: plan.id,
    productId: plan.productId,
    name: plan.name,
    price: plan.price,
    period: plan.period,
    isPopular: plan.isPopular,
    currency: plan.currency ?? "₽",
  };
}

function normalizeAdminPlans(rawPlans: unknown, fallbackPlans: EditablePlan[]): EditablePlan[] {
  const parsedRaw = Array.isArray(rawPlans)
    ? rawPlans
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const p = item as Record<string, unknown>;
          const id = typeof p.id === "string" ? p.id : "";
          if (!id) return null;
          const fallback = fallbackPlans.find((x) => x.id === id) ?? fallbackPlans[0];
          return {
            id,
            productId: p.productId === "chatgpt-pro" ? "chatgpt-pro" : "chatgpt-plus",
            name: typeof p.name === "string" ? p.name : fallback?.name ?? id,
            price: typeof p.price === "number" ? p.price : Number(p.price ?? fallback?.price ?? 0),
            period: typeof p.period === "string" ? p.period : fallback?.period ?? "мес",
            isPopular: typeof p.isPopular === "boolean" ? p.isPopular : Boolean(fallback?.isPopular),
            currency: typeof p.currency === "string" ? p.currency : fallback?.currency ?? "₽",
          } satisfies EditablePlan;
        })
        .filter((p): p is NonNullable<typeof p> => p !== null) as EditablePlan[]
    : [];

  const plusPlans = parsedRaw.filter((p) => p.productId === "chatgpt-plus");
  const plusFallback = fallbackPlans.filter((p) => p.productId === "chatgpt-plus");
  const normalizedPlus = plusPlans.length ? plusPlans : plusFallback;
  const proFallback = fallbackPlans.filter((p) => p.productId === "chatgpt-pro");
  const proById = new Map(parsedRaw.filter((p) => p.productId === "chatgpt-pro").map((p) => [p.id, p]));
  return [...normalizedPlus, ...proFallback.map((p) => proById.get(p.id) ?? p)];
}

export function GptTariffsManager({ initialSettings }: Props) {
  const fallbackPlans = useMemo(
    () => [...CHATGPT_PLANS.plus, ...CHATGPT_PLANS.pro].map(toEditable),
    [],
  );
  const initialPlans = useMemo(
    () => normalizeAdminPlans(initialSettings.pricing_plans, fallbackPlans),
    [fallbackPlans, initialSettings.pricing_plans],
  );

  const [pricingPlans, setPricingPlans] = useState<EditablePlan[]>(initialPlans);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updatePlan(id: string, patch: Partial<EditablePlan>) {
    setPricingPlans((prev) => prev.map((plan) => (plan.id === id ? { ...plan, ...patch } : plan)));
  }

  async function onSave() {
    setSaving(true);
    setError(null);
    try {
      const fullPlans = pricingPlans.map((plan) => {
        const canonical = [...CHATGPT_PLANS.plus, ...CHATGPT_PLANS.pro].find((p) => p.id === plan.id);
        return {
          ...(canonical ?? CHATGPT_PLANS.plus[0]),
          ...plan,
          price: Math.max(0, Number(plan.price || 0)),
        } satisfies ExtendedPlan;
      });

      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pricing_plans: fullPlans }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Ошибка сохранения тарифов");
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError("Не удалось сохранить тарифы.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {pricingPlans.map((plan) => (
          <div key={plan.id} className="rounded-xl border border-gray-200 bg-white p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-gray-800">{plan.name}</p>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-gray-500">
                {plan.id}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <div>
                <label className="mb-1 block text-xs text-gray-500">Продукт</label>
                <select
                  value={plan.productId}
                  onChange={(e) =>
                    updatePlan(plan.id, {
                      productId: e.target.value === "chatgpt-pro" ? "chatgpt-pro" : "chatgpt-plus",
                    })
                  }
                  className="w-full rounded-lg border border-gray-200 px-2.5 py-2 text-sm"
                >
                  <option value="chatgpt-plus">ChatGPT Plus</option>
                  <option value="chatgpt-pro">ChatGPT Pro</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">Цена (₽)</label>
                <input
                  type="number"
                  value={plan.price}
                  onChange={(e) => updatePlan(plan.id, { price: Number(e.target.value) })}
                  className="w-full rounded-lg border border-gray-200 px-2.5 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">Период</label>
                <select
                  value={plan.period}
                  onChange={(e) => updatePlan(plan.id, { period: e.target.value })}
                  className="w-full rounded-lg border border-gray-200 px-2.5 py-2 text-sm"
                >
                  <option value="мес">мес</option>
                  <option value="3 мес">3 мес</option>
                  <option value="год">год</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">Популярный</label>
                <select
                  value={plan.isPopular ? "yes" : "no"}
                  onChange={(e) => updatePlan(plan.id, { isPopular: e.target.value === "yes" })}
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

      {error && <p className="text-sm text-red-700">{error}</p>}

      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        className="flex items-center gap-2 rounded-xl bg-[#10a37f] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {saving && <Loader2 size={14} className="animate-spin" />}
        {saved && <Check size={14} />}
        {saved ? "Сохранено!" : "Сохранить тарифы"}
      </button>
    </div>
  );
}
