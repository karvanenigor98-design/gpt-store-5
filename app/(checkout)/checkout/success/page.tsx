import type { Metadata } from "next";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { createSubsStoreAdminClient } from "@/lib/supabase/subs-store-admin";
import { CheckoutSuccessOrderRedirect } from "@/components/checkout/CheckoutSuccessOrderRedirect";
import { OrderStatusTracker } from "@/components/ui/OrderStatusTracker";
import { TokenSafetyBlock } from "@/components/ui/TokenSafetyBlock";
import { CheckCircle2 } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = { title: "Заказ создан" };

interface Props {
  searchParams: Promise<{
    order?: string;
    orderId?: string;
    order_id?: string;
    site?: string;
  }>;
}

export default async function CheckoutSuccessPage({ searchParams }: Props) {
  const params = await searchParams;
  const orderId = params.order ?? params.orderId ?? params.order_id;
  const siteParam = params.site;

  if (!orderId) {
    return (
      <>
        <Suspense fallback={null}>
          <CheckoutSuccessOrderRedirect />
        </Suspense>
        <div className="text-center">
          <p className="text-gray-500">Загрузка заказа…</p>
          <p className="mt-2 text-xs text-gray-400">
            Если страница не обновилась, откройте{" "}
            <Link href="/dashboard" className="text-[#10a37f] hover:underline">
              личный кабинет
            </Link>
            .
          </p>
        </div>
      </>
    );
  }

  const preferSubs = siteParam === "subs-store";

  if (!preferSubs) {
    const supabase = await createClient();
    const { data: order } = await supabase.from("orders").select("*").eq("id", orderId).single();

    if (order) {
      return (
        <div className="w-full max-w-lg space-y-5">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#10a37f]/10">
              <CheckCircle2 size={28} className="text-[#10a37f]" />
            </div>
            <h1 className="font-heading text-2xl font-bold text-gray-900">Заказ оформлен!</h1>
            <p className="mt-2 text-sm text-gray-500">
              Мы уже начали активировать вашу подписку. Следите за статусом ниже.
            </p>
          </div>

          <OrderStatusTracker
            orderId={orderId}
            initialStatus={order.status}
            siteSlug="gpt-store"
            planId={order.plan_id}
            activatedAt={order.activated_at}
          />

          {order.status === "waiting_client" && <TokenSafetyBlock compact={false} />}

          <div className="rounded-xl border border-black/[0.07] bg-gray-50 px-4 py-3 text-sm text-gray-600">
            <p>
              Email аккаунта: <strong>{order.account_email}</strong>
            </p>
            <p className="mt-1">
              Ваш чат открыт в кабинете в{" "}
              <a
                href={`${process.env.NEXT_PUBLIC_APP_URL ?? ""}/dashboard/chat`}
                className="text-[#10a37f] hover:underline"
              >
                чате поддержки
              </a>
            </p>
          </div>

          <Link href="/dashboard" className="block text-center text-sm text-gray-500 hover:text-gray-800">
            Перейти в личный кабинет →
          </Link>
        </div>
      );
    }
  }

  const subs = createSubsStoreAdminClient();
  if (subs) {
    const { data: subsOrder } = await subs
      .from("orders")
      .select("id,status,payment_status,final_price,customer_email,tariff_id")
      .eq("id", orderId)
      .maybeSingle();

    if (subsOrder) {
      let planName = "Spotify Premium";
      if (subsOrder.tariff_id) {
        const { data: tariff } = await subs
          .from("tariffs")
          .select("title")
          .eq("id", subsOrder.tariff_id)
          .maybeSingle();
        if (tariff?.title) planName = tariff.title;
      }

      const isPaid =
        subsOrder.payment_status === "paid" ||
        ["paid", "processing", "awaiting_data", "activated", "completed"].includes(
          String(subsOrder.status),
        );

      const statusLabel = isPaid
        ? "В работе"
        : subsOrder.status === "awaiting_payment"
          ? "Ожидает оплаты"
          : subsOrder.status;

      return (
        <div className="w-full max-w-lg space-y-5">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#1DB954]/10">
              <CheckCircle2 size={28} className="text-[#1DB954]" />
            </div>
            <h1 className="font-heading text-2xl font-bold text-gray-900">Заказ SPOTIFY STORE</h1>
            <p className="mt-2 text-sm text-gray-500">
              {isPaid
                ? "Оплата получена. Оператор подключит подписку в ближайшее время."
                : "Заказ создан. Если оплата прошла — статус обновится автоматически."}
            </p>
          </div>

          <OrderStatusTracker
            orderId={orderId}
            initialStatus={String(subsOrder.status)}
            siteSlug="subs-store"
            variant="subs"
          />

          <div className="rounded-xl border border-black/[0.07] bg-gray-50 px-4 py-3 text-sm text-gray-600 space-y-1">
            <p>
              Тариф: <strong>{planName}</strong>
            </p>
            <p>
              Сумма: <strong>{Number(subsOrder.final_price).toLocaleString("ru")} ₽</strong>
            </p>
            <p>
              Статус: <strong>{statusLabel}</strong>
            </p>
            <p>
              Email: <strong>{subsOrder.customer_email}</strong>
            </p>
          </div>

          <Link
            href="/spotify"
            className="block text-center text-sm text-[#1DB954] hover:underline"
          >
            На главную SPOTIFY STORE →
          </Link>
        </div>
      );
    }
  }

  return (
    <div className="text-center">
      <p className="text-gray-500">Заказ не найден или был удалён</p>
      <Link href="/" className="mt-4 inline-block text-[#10a37f] hover:underline">
        На главную
      </Link>
    </div>
  );
}
