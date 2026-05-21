"use client";

import { useMemo, useState } from "react";
import { Check, Loader2 } from "lucide-react";

interface Props {
  initialMap: Record<string, unknown>;
}

export function SubsSiteSettingsManager({ initialMap }: Props) {
  const keys = useMemo(() => Object.keys(initialMap).sort(), [initialMap]);
  const [values, setValues] = useState<Record<string, string>>(() => {
    const o: Record<string, string> = {};
    for (const k of Object.keys(initialMap)) {
      const v = initialMap[k];
      o[k] = typeof v === "string" ? v : JSON.stringify(v ?? null, null, 2);
    }
    return o;
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const payload: Record<string, unknown> = {};
      for (const k of keys) {
        const raw = values[k]?.trim() ?? "";
        if (!raw) {
          payload[k] = null;
          continue;
        }
        try {
          payload[k] = JSON.parse(raw) as unknown;
        } catch {
          payload[k] = raw;
        }
      }
      const res = await fetch("/api/admin/settings?site=subs-store", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(j.error ?? "Ошибка сохранения");
        setSaving(false);
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setError("Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Пары ключ / значение из таблицы <code className="rounded bg-gray-100 px-1">site_settings</code> проекта Subs
        Store. Значение — JSON или строка.
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {keys.length === 0 && <p className="text-sm text-gray-500">Записей пока нет.</p>}
      {keys.map((k) => (
        <label key={k} className="block">
          <span className="mb-1 block text-xs font-medium text-gray-600">{k}</span>
          <textarea
            className="min-h-[72px] w-full rounded-lg border border-gray-200 bg-white p-2 font-mono text-xs text-gray-900"
            value={values[k] ?? ""}
            onChange={(e) => setValues((v) => ({ ...v, [k]: e.target.value }))}
          />
        </label>
      ))}
      <button
        type="button"
        onClick={() => void save()}
        disabled={saving}
        className="inline-flex items-center gap-2 rounded-lg bg-[#1DB954] px-4 py-2 text-sm font-medium text-white hover:opacity-95 disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        Сохранить в Subs Store
      </button>
      {saved && <span className="text-sm text-[#1DB954]">Сохранено</span>}
    </div>
  );
}
