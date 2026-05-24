"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Check } from "lucide-react";
import { profileUpdateSchema, type ProfileUpdateInput } from "@/lib/validations";
import { getSiteBySlug } from "@/lib/sites";
import { cn } from "@/lib/utils";

function formatAccountCreated(iso: string): string | null {
  if (!iso || typeof iso !== "string") return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

interface Props {
  siteSlug?: "gpt-store" | "subs-store";
  initialData: {
    username: string;
    telegram_username: string;
    email: string;
    createdAt: string;
  };
}

export function ProfileForm({ siteSlug = "gpt-store", initialData }: Props) {
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const accountCreatedLabel = formatAccountCreated(initialData.createdAt);
  const site = getSiteBySlug(siteSlug);
  const accent = site.primaryColor;

  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<ProfileUpdateInput>({
      resolver: zodResolver(profileUpdateSchema),
      defaultValues: {
        username: initialData.username,
        telegram_username: initialData.telegram_username,
      },
    });

  async function onSubmit(data: ProfileUpdateInput) {
    setError(null);
    const res = await fetch("/api/profile/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, site: siteSlug }),
    });
    const json = (await res.json()) as { error?: string };

    if (!res.ok) {
      setError(json.error ?? "Не удалось сохранить профиль");
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  const isSubs = siteSlug === "subs-store";
  const labelClass = cn(
    "mb-1.5 block text-sm font-medium",
    isSubs ? "text-gray-400" : "text-gray-700",
  );
  const inputClass = (hasError?: boolean) =>
    cn(
      "w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none transition-shadow",
      isSubs
        ? "border-white/15 bg-[#161616] text-gray-100 placeholder:text-gray-500"
        : "border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 focus:border-[#10a37f]",
      hasError ? "border-red-500" : isSubs ? "border-white/15" : "border-gray-300",
    );

  return (
    <div className="space-y-5">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div>
          <label className={labelClass}>Email</label>
          <input
            type="email"
            value={initialData.email}
            disabled
            className={cn(
              "w-full cursor-not-allowed rounded-xl border px-3.5 py-2.5 text-sm",
              isSubs
                ? "border-white/10 bg-[#1a1a1a] text-gray-500"
                : "border-gray-200 bg-gray-50 text-gray-600",
            )}
          />
        </div>

        <div>
          <label className={labelClass}>Имя</label>
          <input
            type="text"
            {...register("username")}
            className={inputClass(!!errors.username)}
            style={
              {
                ["--profile-accent" as string]: accent,
              } as React.CSSProperties
            }
            onFocus={(e) => {
              e.currentTarget.style.boxShadow = `0 0 0 3px ${accent}40`;
              e.currentTarget.style.borderColor = accent;
            }}
            onBlur={(e) => {
              e.currentTarget.style.boxShadow = "";
              e.currentTarget.style.borderColor = errors.username
                ? "#ef4444"
                : isSubs
                  ? "rgba(255,255,255,0.15)"
                  : "#d1d5db";
            }}
            placeholder="Ваше имя"
          />
          {errors.username && <p className="mt-1 text-xs text-red-400">{errors.username.message}</p>}
        </div>

        <div>
          <label className={labelClass}>Telegram @username</label>
          <input
            type="text"
            {...register("telegram_username")}
            className={inputClass()}
            onFocus={(e) => {
              e.currentTarget.style.boxShadow = `0 0 0 3px ${accent}40`;
              e.currentTarget.style.borderColor = accent;
            }}
            onBlur={(e) => {
              e.currentTarget.style.boxShadow = "";
              e.currentTarget.style.borderColor = isSubs ? "rgba(255,255,255,0.15)" : "#d1d5db";
            }}
            placeholder="@username"
          />
        </div>

        {accountCreatedLabel && (
          <p className="text-xs text-gray-500">Аккаунт создан: {accountCreatedLabel}</p>
        )}

        {error && (
          <p className="rounded-lg border border-red-700/40 bg-red-950/50 px-3 py-2 text-sm text-red-400">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          style={{
            backgroundColor: accent,
            boxShadow: `0 4px 20px ${accent}55`,
          }}
        >
          {isSubmitting && <Loader2 size={14} className="animate-spin" />}
          {saved && <Check size={14} />}
          {saved ? "Сохранено!" : "Сохранить"}
        </button>
      </form>
    </div>
  );
}
