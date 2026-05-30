import type { Metadata } from "next";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createSubsStoreAdminClient } from "@/lib/supabase/subs-store-admin";
import { CheckoutSuccessOrderRedirect } from "@/components/checkout/CheckoutSuccessOrderRedirect";
import { CheckoutSuccessLiveTracker } from "@/components/checkout/CheckoutSuccessLiveTracker";
import { TokenSafetyBlock } from "@/components/ui/TokenSafetyBlock";
import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import type { SiteSlug } from "@/lib/auth/siteUiSession";
import {
  CHECKOUT_RETURN_COOKIE,
  parseCheckoutReturnCookieValue,
} from "@/lib/payments/checkout-return-cookie";
import { reconcileUnpaidOrderPayment } from "@/lib/payments/reconcile-unpaid-order";
import { isPaidLikeStatus } from "@/lib/orders/paid-like-status";
import { buildCustomerOrderFocusHref } from "@/lib/dashboard/customer-order-view";

export const metadata: Metadata = { title: "Заказ создан" };

interface Props {
  searchParams: Promise<{
    order?: string;
    orderId?: string;
    order_id?: string;
    site?: string;
  }>;
}

async function resolveSuccessContext(params: {
  order?: string;
  orderId?: string;
  order_id?: string;
  site?: string;
}): Promise<{ orderId: string | null; siteSlug: SiteSlug }> {
  const fromQuery = params.order ?? params.orderId ?? params.order_id ?? null;
  const siteFromQuery: SiteSlug = params.site === "subs-store" ? "subs-store" : "gpt-store";

  if (fromQuery) {
    return { orderId: fromQuery, siteSlug: siteFromQuery };
  }

  const jar = await cookies();
  const parsed = parseCheckoutReturnCookieValue(jar.get(CHECKOUT_RETURN_COOKIE)?.value);
  if (parsed) {
    return parsed;
  }

  return { orderId: null, siteSlug: siteFromQuery };
}

export default async function CheckoutSuccessPage({ searchParams }: Props) {
  const params = await searchParams;
  const { orderId, siteSlug } = await resolveSuccessContext(params);

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
            <Link
              href={`/dashboard/orders?site=${siteSlug}`}
              className="text-[#10a37f] hover:underline"
            >
              личный кабинет
            </Link>
            .
          </p>
        </div>
      </>
    );
  }

  const preferSubs = siteSlug === "subs-store";
  const dashboardOrdersHref = buildCustomerOrderFocusHref(siteSlug, orderId);

  if (!preferSubs) {
    await reconcileUnpaidOrderPayment({ siteSlug: "gpt-store", orderId }).catch(() => undefined);

    const supabase = await createClient();
    const { data: order } = await supabase.from("orders").select("*").eq("id", orderId).single();

    if (order) {
      if (isPaidLikeStatus(String(order.status), "gpt-store")) {
        redirect(dashboardOrdersHref);
      }

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

          <CheckoutSuccessLiveTracker
            orderId={orderId}
            initialStatus={order.status}
            siteSlug="gpt-store"
            planId={order.plan_id}
            activatedAt={order.activated_at}
            dashboardHref="/dashboard/orders?site=gpt-store"
            autoRedirectWhenPaid
          />

          {order.status === "waiting_client" && <TokenSafetyBlock compact={false} />}

          <div className="rounded-xl border border-black/[0.07] bg-gray-50 px-4 py-3 text-sm text-gray-600">
            <p>
              Email аккаунта: <strong>{order.account_email}</strong>
            </p>
            <p className="mt-1">
              Ваш чат открыт в кабинете в{" "}
              <Link href="/dashboard/chat?site=gpt-store" className="text-[#10a37f] hover:underline">
                чате поддержки
              </Link>
            </p>
          </div>

          <Link
            href="/dashboard/orders?site=gpt-store"
            className="block text-center text-sm text-gray-500 hover:text-gray-800"
          >
            Перейти в личный кабинет →
          </Link>
        </div>
      );
    }
  }

  const subs = createSubsStoreAdminClient();
  if (subs) {
    await reconcileUnpaidOrderPayment({ siteSlug: "subs-store", orderId }).catch(() => undefined);

    const { data: subsOrder } = await subs
      .from("orders")
      .select("id,status,payment_status,final_price,customer_email,tariff_id")
      .eq("id", orderId)
      .maybeSingle();

    if (subsOrder) {
      const isPaid =
        subsOrder.payment_status === "paid" ||
        isPaidLikeStatus(String(subsOrder.status), "subs-store");

      if (isPaid) {
        redirect(dashboardOrdersHref);
      }

      let planName = "Spotify Premium";
      if (subsOrder.tariff_id) {
        const { data: tariff } = await subs
          .from("tariffs")
          .select("title")
          .eq("id", subsOrder.tariff_id)
          .maybeSingle();
        if (tariff?.title) planName = tariff.title;
      }

      const statusLabel =
        subsOrder.status === "awaiting_payment" ? "Ожидает оплаты" : String(subsOrder.status);

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

          <CheckoutSuccessLiveTracker
            orderId={orderId}
            initialStatus={String(subsOrder.status)}
            siteSlug="subs-store"
            variant="subs"
            dashboardHref="/dashboard/orders?site=subs-store"
            autoRedirectWhenPaid
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
            href="/dashboard/orders?site=subs-store"
            className="block text-center text-sm text-[#1DB954] hover:underline"
          >
            Открыть заказы в кабинете →
          </Link>

          <Link
            href="/spotify"
            className="block text-center text-sm text-gray-500 hover:text-gray-800"
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
      <p className="mt-2 text-sm text-gray-400">
        Проверьте, что вы вошли в кабинет того же магазина, где оформляли заказ.
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-3">
        <Link href="/dashboard/orders?site=gpt-store" className="text-[#10a37f] hover:underline">
          Кабинет GPT STORE
        </Link>
        <Link href="/dashboard/orders?site=subs-store" className="text-[#1DB954] hover:underline">
          Кабинет SPOTIFY STORE
        </Link>
        <Link href="/" className="text-gray-500 hover:underline">
          На главную
        </Link>
      </div>
    </div>
  );
}
