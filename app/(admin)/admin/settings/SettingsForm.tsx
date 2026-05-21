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
  badge?: string;
  description: string;
  features: string[];
  isPopular: boolean;
  cta: string;
  currency: string;
};

function toEditable(plan: ExtendedPlan): EditablePlan {
  return {
    ...plan,
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
            badge: typeof p.badge === "string" ? p.badge : fallback?.badge,
            description:
              typeof p.description === "string" ? p.description : fallback?.description ?? "",
            features: Array.isArray(p.features)
              ? p.features.filter((f): f is string => typeof f === "string")
              : (fallback?.features ?? []),
            isPopular: typeof p.isPopular === "boolean" ? p.isPopular : Boolean(fallback?.isPopular),
            cta: typeof p.cta === "string" ? p.cta : fallback?.cta ?? "Подключить",
            currency: typeof p.currency === "string" ? p.currency : fallback?.currency ?? "₽",
          } satisfies EditablePlan;
        })
        .filter((p): p is NonNullable<typeof p> => p !== null) as EditablePlan[]
    : [];

  const plusPlans = parsedRaw.filter((p) => p.productId === "chatgpt-plus");
  const plusFallback = fallbackPlans.filter((p) => p.productId === "chatgpt-plus");

  const normalizedPlus = plusPlans.length
    ? plusPlans
    : plusFallback;

  // Для Pro в админке всегда показываем canonical 5x/20x.
  // Если в БД legacy pro-1, он не подменяет canonical набор.
  const proFallback = fallbackPlans.filter((p) => p.productId === "chatgpt-pro");
  const proById = new Map(parsedRaw.filter((p) => p.productId === "chatgpt-pro").map((p) => [p.id, p]));
  const normalizedPro = proFallback.map((p) => proById.get(p.id) ?? p);

  return [...normalizedPlus, ...normalizedPro];
}

const FIELDS = [
  { key: "auto_reply_delay_minutes", label: "Задержка авто-ответа", type: "select" as const },
  { key: "operator_telegram_url", label: "Ссылка на оператора в Telegram", type: "text" },
  { key: "night_start_hour", label: "Начало ночного режима", type: "select" as const },
  { key: "night_end_hour", label: "Конец ночного режима", type: "select" as const },
];

export function SettingsForm({ initialSettings }: Props) {
  const fallbackPlans = useMemo<EditablePlan[]>(
    () => [...CHATGPT_PLANS.plus, ...CHATGPT_PLANS.pro].map(toEditable),
    []
  );

  const initialPlans = useMemo<EditablePlan[]>(() => {
    return normalizeAdminPlans(initialSettings.pricing_plans, fallbackPlans);
  }, [fallbackPlans, initialSettings.pricing_plans]);

  const initialAvailability = useMemo<Record<string, boolean>>(() => {
    const raw = initialSettings.plan_availability;
    const fromDb: Record<string, boolean> = {};
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
        fromDb[id] = value !== false;
      }
    }
    for (const plan of initialPlans) {
      if (!(plan.id in fromDb)) fromDb[plan.id] = true;
    }
    return fromDb;
  }, [initialPlans, initialSettings.plan_availability]);

  const [values, setValues] = useState<Record<string, string>>({
    auto_reply_delay_minutes: String(initialSettings.auto_reply_delay_minutes ?? 15),
    operator_telegram_url: String(initialSettings.operator_telegram_url ?? ""),
    night_start_hour: String(initialSettings.night_start_hour ?? 22),
    night_end_hour: String(initialSettings.night_end_hour ?? 9),
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pricingPlans, setPricingPlans] = useState<EditablePlan[]>(initialPlans);
  const [planAvailability, setPlanAvailability] = useState<Record<string, boolean>>(initialAvailability);
  const [sections, setSections] = useState<{
    showReviews: boolean;
    showFaq: boolean;
    showCompare: boolean;
  }>({
    showReviews: initialSettings.landing_sections
      ? (initialSettings.landing_sections as Record<string, unknown>).showReviews !== false
      : true,
    showFaq: initialSettings.landing_sections
      ? (initialSettings.landing_sections as Record<string, unknown>).showFaq !== false
      : true,
    showCompare: initialSettings.landing_sections
      ? (initialSettings.landing_sections as Record<string, unknown>).showCompare !== false
      : true,
  });

  const delayOptions = [0, 2, 5, 10, 15, 20, 30, 45, 60];
  const hourOptions = Array.from({ length: 24 }, (_, i) => i);

  function updatePlan(id: string, patch: Partial<EditablePlan>) {
    setPricingPlans((prev) => prev.map((plan) => (plan.id === id ? { ...plan, ...patch } : plan)));
  }

  async function onSave() {
    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {};
      for (const field of FIELDS) {
        payload[field.key] = field.type === "select" ? Number(values[field.key]) : values[field.key];
      }
      const plansToSave: ExtendedPlan[] = pricingPlans.map((plan) => ({
        id: plan.id,
        productId: plan.productId,
        name: plan.name,
        price: Math.max(0, Number(plan.price || 0)),
        currency: plan.currency || "₽",
        period: plan.period || "мес",
        badge: plan.badge || undefined,
        description: plan.description,
        features: plan.features,
        isPopular: plan.isPopular,
        cta: plan.cta,
      }));

      payload.pricing_plans = plansToSave;
      payload.landing_sections = sections;
      payload.plan_availability = planAvailability;

      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Ошибка сохранения настроек");
        setSaving(false);
        return;
      }

      setSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setSaving(false);
      setError("Не удалось сохранить настройки. Проверьте заполнение полей.");
    }
  }

  return (
    <div className="space-y-4">
      {FIELDS.map((field) => (
        <div key={field.key}>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            {field.label}
          </label>
          {field.type === "text" ? (
            <input
              type="text"
              value={values[field.key] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
              className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 outline-none focus:border-[#10a37f] focus:ring-2 focus:ring-[#10a37f]/20"
            />
          ) : (
            <select
              value={values[field.key] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
              className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 outline-none focus:border-[#10a37f] focus:ring-2 focus:ring-[#10a37f]/20"
            >
              {(field.key === "auto_reply_delay_minutes" ? delayOptions : hourOptions).map((option) => (
                <option key={option} value={option}>
                  {field.key === "auto_reply_delay_minutes"
                    ? `${option} мин`
                    : `${option.toString().padStart(2, "0")}:00`}
                </option>
              ))}
            </select>
          )}
        </div>
      ))}

      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">Наличие подписок</label>
        <div className="space-y-2 rounded-xl border border-gray-200 bg-white p-3">
          {pricingPlans.length ? (
            pricingPlans.map((plan) => (
              <label
                key={plan.id}
                className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-gray-100 px-3 py-2"
              >
                <span className="text-sm text-gray-700">
                  {plan.name}
                  <span className="ml-2 text-xs text-gray-400">({plan.productId})</span>
                </span>
                <span className="flex items-center gap-2 text-xs text-gray-500">
                  <input
                    type="checkbox"
                    checked={planAvailability[plan.id] !== false}
                    onChange={(e) =>
                      setPlanAvailability((prev) => ({
                        ...prev,
                        [plan.id]: e.target.checked,
                      }))
                    }
                    className="h-4 w-4 rounded border-gray-300 accent-[#10a37f]"
                  />
                  В наличии
                </span>
              </label>
            ))
          ) : (
            <p className="text-xs text-gray-500">Тарифы не найдены.</p>
          )}
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">Тарифы</label>
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
                    className="w-full rounded-lg border border-gray-200 px-2.5 py-2 text-sm outline-none focus:border-[#10a37f]"
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
                    className="w-full rounded-lg border border-gray-200 px-2.5 py-2 text-sm outline-none focus:border-[#10a37f]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-500">Период</label>
                  <select
                    value={plan.period}
                    onChange={(e) => updatePlan(plan.id, { period: e.target.value })}
                    className="w-full rounded-lg border border-gray-200 px-2.5 py-2 text-sm outline-none focus:border-[#10a37f]"
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
                    className="w-full rounded-lg border border-gray-200 px-2.5 py-2 text-sm outline-none focus:border-[#10a37f]"
                  >
                    <option value="no">Нет</option>
                    <option value="yes">Да</option>
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">Видимость блоков лендинга</label>
        <div className="space-y-2 rounded-xl border border-gray-200 bg-white p-3">
          {[
            { key: "showReviews", label: "Показывать отзывы" },
            { key: "showFaq", label: "Показывать FAQ" },
            { key: "showCompare", label: "Показывать сравнение Plus/Pro" },
          ].map((item) => (
            <label key={item.key} className="flex cursor-pointer items-center justify-between rounded-lg border border-gray-100 px-3 py-2">
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
                className="h-4 w-4 rounded border-gray-300 accent-[#10a37f]"
              />
            </label>
          ))}
        </div>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        className="flex items-center gap-2 rounded-xl bg-[#10a37f] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
      >
        {saving && <Loader2 size={14} className="animate-spin" />}
        {saved && <Check size={14} />}
        {saved ? "Сохранено!" : "Сохранить"}
      </button>
    </div>
  );
}
