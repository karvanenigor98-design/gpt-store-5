import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, Settings } from "lucide-react";
import { SITES } from "@/lib/sites";

export const metadata: Metadata = { title: "Магазины — Admin" };

export default function SitesPage() {
  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Магазины</h1>
          <p className="mt-1 text-sm text-gray-500">
            Управляйте магазинами и лендингами в одной панели
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SITES.map((site) => (
          <div
            key={site.id}
            className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-base font-bold text-white"
                  style={{ backgroundColor: site.primaryColor }}
                >
                  {site.logoLetter}
                </div>
                <div>
                  <h2 className="text-sm font-bold text-gray-900">{site.brandName}</h2>
                  <p className="text-xs text-gray-400">/{site.slug}</p>
                </div>
              </div>
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                style={{
                  backgroundColor: site.primaryColor + "20",
                  color: site.primaryColor,
                }}
              >
                Активен
              </span>
            </div>

            <p className="mb-4 text-xs text-gray-500">{site.description}</p>

            <div className="mb-4 space-y-1.5 rounded-xl bg-gray-50 p-3 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-400">Тип продукта</span>
                <span className="font-medium text-gray-700">{site.productType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Поддержка</span>
                <span className="font-medium text-gray-700">{site.supportTelegram}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Checkout</span>
                <span className="font-medium text-gray-700">{site.checkoutPath}</span>
              </div>
            </div>

            <div className="flex gap-2">
              <a
                href={site.landingPath}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 transition-colors hover:border-gray-300 hover:text-gray-900"
              >
                <ExternalLink size={12} />
                Лендинг
              </a>
              <Link
                href={`/admin/settings?site=${site.slug}`}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: site.primaryColor }}
              >
                <Settings size={12} />
                Настройки
              </Link>
            </div>
          </div>
        ))}

        {/* Add new site placeholder */}
        <div className="rounded-2xl border-2 border-dashed border-gray-200 p-5 flex flex-col items-center justify-center gap-3 min-h-[200px] text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-gray-400 text-xl">
            +
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Добавить магазин</p>
            <p className="mt-1 text-xs text-gray-400">
              Новые магазины можно добавить через настройки
            </p>
          </div>
          <Link
            href="/admin/settings"
            className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-medium text-gray-600 hover:border-gray-300 transition-colors"
          >
            Подробнее
          </Link>
        </div>
      </div>

      {/* Quick stats */}
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-400">Всего магазинов</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{SITES.length}</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-400">Активных</p>
          <p className="mt-1 text-2xl font-bold text-[#10a37f]">{SITES.length}</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-400">Главный админ</p>
          <p className="mt-1 text-sm font-semibold text-gray-700">nbuzanov0@mail.ru</p>
          <p className="text-xs text-gray-400">Все магазины</p>
        </div>
      </div>
    </div>
  );
}
