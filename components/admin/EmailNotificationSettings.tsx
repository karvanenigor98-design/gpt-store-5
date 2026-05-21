"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";

import type { SiteEmailNotificationSettings } from "@/lib/email/settings";

type Props = {
  siteSlug: "gpt-store" | "subs-store";
  brandLabel: string;
};

const TOGGLES: { key: keyof SiteEmailNotificationSettings; label: string }[] = [
  { key: "enabled_clients", label: "Email клиентам" },
  { key: "enabled_admins", label: "Email админам" },
  { key: "enabled_operators", label: "Email операторам" },
  { key: "enabled_chat", label: "Уведомления по чату" },
  { key: "enabled_orders", label: "Уведомления по заказам" },
  { key: "enabled_reviews", label: "Уведомления по отзывам" },
  { key: "enabled_payments", label: "Уведомления по оплатам" },
  { key: "enabled_promocodes", label: "Уведомления по промокодам" },
];

export function EmailNotificationSettings({ siteSlug, brandLabel }: Props) {
  const [settings, setSettings] = useState<SiteEmailNotificationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/email-notification-settings?site=${siteSlug}`);
      const data = (await res.json()) as { settings?: SiteEmailNotificationSettings; error?: string };
      if (!res.ok) throw new Error(data.error ?? "load_failed");
      setSettings(data.settings ?? null);
    } catch {
      setError("Не удалось загрузить настройки email");
    } finally {
      setLoading(false);
    }
  }, [siteSlug]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(next: SiteEmailNotificationSettings) {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch(`/api/admin/email-notification-settings?site=${siteSlug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "save_failed");
      setSettings(next);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError("Не удалось сохранить. Проверьте SMTP-настройки и миграцию 010.");
    } finally {
      setSaving(false);
    }
  }

  function toggle(key: keyof SiteEmailNotificationSettings) {
    if (!settings) return;
    const next = { ...settings, [key]: !settings[key] };
    setSettings(next);
    void save(next);
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
        <Loader2 className="inline h-4 w-4 animate-spin mr-2" />
        Загрузка email-настроек…
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        {error ?? "Настройки недоступны"}
      </div>
    );
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-gray-50 p-5 space-y-3">
      <div>
        <h3 className="text-base font-semibold text-gray-900">Email-уведомления — {brandLabel}</h3>
        <p className="text-xs text-gray-500 mt-1">
          Дублируют важные события из кабинета и админки на почту. Не влияют на Supabase Auth (регистрация, сброс пароля).
        </p>
      </div>
      {error ? <p className="text-sm text-amber-700">{error}</p> : null}
      <div className="grid gap-2 sm:grid-cols-2">
        {TOGGLES.map(({ key, label }) => (
          <label
            key={key}
            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 cursor-pointer hover:bg-gray-50"
          >
            <input
              type="checkbox"
              checked={settings[key]}
              disabled={saving}
              onChange={() => toggle(key)}
              className="rounded"
            />
            {label}
          </label>
        ))}
      </div>
      <p className="text-xs text-gray-500 flex items-center gap-1">
        {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : saved ? <Check className="h-3 w-3 text-emerald-600" /> : null}
        {saving ? "Сохранение…" : saved ? "Сохранено" : "Изменения применяются сразу"}
      </p>
    </section>
  );
}
