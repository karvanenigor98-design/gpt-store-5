"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Mail } from "lucide-react";
import type { SiteSlug } from "@/lib/sites";
import { getSiteBySlug } from "@/lib/sites";

type PreviewRecipient = {
  orderId: string;
  email: string;
  planName: string;
  price: number;
  createdAt: string;
};

type Preview = {
  totalOrders: number;
  uniqueEmails: number;
  skippedNoEmail: number;
  duplicateEmails: number;
  recipients: PreviewRecipient[];
};

interface Props {
  siteSlug: SiteSlug;
}

export function UnpaidOrdersEmailCampaign({ siteSlug }: Props) {
  const site = getSiteBySlug(siteSlug);
  const [period, setPeriod] = useState("7d");
  const [subject, setSubject] = useState("");
  const [bodyText, setBodyText] = useState(
    "Вы начали оформление, но оплата ещё не завершена.\nЗавершите оплату в личном кабинете — мы сохранили ваш заказ.",
  );
  const [preview, setPreview] = useState<Preview | null>(null);
  const [excludedEmails, setExcludedEmails] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const loadPreview = useCallback(async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(
        `/api/admin/email-campaigns/unpaid-preview?site=${siteSlug}&period=${period}`,
        { credentials: "include" },
      );
      const data = (await res.json()) as Preview;
      if (res.ok) {
        setPreview(data);
        setExcludedEmails(new Set());
      }
    } finally {
      setLoading(false);
    }
  }, [period, siteSlug]);

  useEffect(() => {
    void loadPreview();
  }, [loadPreview]);

  const activeRecipients = useMemo(() => {
    if (!preview) return [];
    return preview.recipients.filter((r) => !excludedEmails.has(r.email));
  }, [preview, excludedEmails]);

  function toggleEmail(email: string) {
    setExcludedEmails((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  }

  async function sendCampaign() {
    setSending(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/email-campaigns/unpaid-send", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          site: siteSlug,
          period,
          subject: subject.trim() || undefined,
          bodyText: bodyText.trim() || undefined,
          excludeEmails: Array.from(excludedEmails),
          confirm: true,
        }),
      });
      const data = (await res.json()) as {
        sent?: number;
        failed?: number;
        skipped?: number;
        duplicate?: number;
        excluded?: number;
        error?: string;
      };
      if (!res.ok) {
        setResult(data.error ?? "Ошибка отправки");
        return;
      }
      setResult(
        `Готово: отправлено ${data.sent ?? 0}, исключено ${data.excluded ?? 0}, пропущено ${data.skipped ?? 0}, дублей ${data.duplicate ?? 0}, ошибок ${data.failed ?? 0}`,
      );
      setConfirmOpen(false);
      void loadPreview();
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center gap-2">
        <Mail size={16} style={{ color: site.primaryColor }} />
        <h2 className="text-sm font-semibold text-gray-900">
          Email-рассылка по неоплаченным заказам · {site.brandName}
        </h2>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {[
          { id: "1h", label: "1 час" },
          { id: "today", label: "Сегодня" },
          { id: "24h", label: "24 часа" },
          { id: "7d", label: "7 дней" },
        ].map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPeriod(p.id)}
            className={`rounded-lg px-3 py-1 text-xs ${period === p.id ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600"}`}
          >
            {p.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => void loadPreview()}
          disabled={loading}
          className="rounded-lg border border-gray-200 px-3 py-1 text-xs text-gray-600 disabled:opacity-50"
        >
          {loading ? "…" : "Обновить"}
        </button>
      </div>

      {preview && (
        <p className="mb-3 text-xs text-gray-600">
          Заказов: {preview.totalOrders} · получателей: {activeRecipients.length} из {preview.uniqueEmails}
          {preview.skippedNoEmail > 0 ? ` · без email в профиле: ${preview.skippedNoEmail}` : ""}
          {preview.duplicateEmails > 0 ? ` · дублей email: ${preview.duplicateEmails}` : ""}
        </p>
      )}

      {preview && preview.recipients.length > 0 && (
        <div className="mb-3 max-h-48 overflow-y-auto rounded-lg border border-gray-100">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-gray-50 text-gray-500">
              <tr>
                <th className="px-3 py-2 font-medium">Отправить</th>
                <th className="px-3 py-2 font-medium">Email</th>
                <th className="px-3 py-2 font-medium">Тариф</th>
                <th className="px-3 py-2 font-medium">Сумма</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {preview.recipients.map((r) => {
                const checked = !excludedEmails.has(r.email);
                return (
                  <tr key={`${r.orderId}-${r.email}`} className={checked ? "" : "bg-gray-50/80 opacity-60"}>
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleEmail(r.email)}
                        aria-label={`Отправить ${r.email}`}
                      />
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px]">{r.email}</td>
                    <td className="px-3 py-2">{r.planName}</td>
                    <td className="px-3 py-2">{r.price.toLocaleString("ru")} ₽</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mb-2 grid gap-2 md:grid-cols-2">
        <input
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
          placeholder="Тема (необязательно)"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />
        <textarea
          className="min-h-[72px] rounded-lg border border-gray-200 px-3 py-2 text-sm md:col-span-2"
          placeholder="Текст письма"
          value={bodyText}
          onChange={(e) => setBodyText(e.target.value)}
        />
      </div>

      {confirmOpen ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs text-amber-700">
            Отправить письмо {activeRecipients.length} клиентам ({site.brandName})?
          </p>
          <button
            type="button"
            onClick={() => void sendCampaign()}
            disabled={sending || activeRecipients.length === 0}
            className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            style={{ background: site.primaryColor }}
          >
            {sending ? "Отправка…" : "Подтвердить отправку"}
          </button>
          <button type="button" onClick={() => setConfirmOpen(false)} className="text-xs text-gray-500">
            Отмена
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          disabled={!activeRecipients.length}
          className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          style={{ background: site.primaryColor }}
        >
          Отправить рассылку ({activeRecipients.length})
        </button>
      )}

      {result && <p className="mt-2 text-xs text-gray-700">{result}</p>}
    </div>
  );
}
