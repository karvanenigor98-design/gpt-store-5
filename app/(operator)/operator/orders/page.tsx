import type { Metadata } from "next";

import AdminOrdersPage from "../../../(admin)/admin/orders/page";

export const metadata: Metadata = { title: "Operator · Заказы" };

export default async function OperatorOrdersPage(props: {
  searchParams: Promise<{ status?: string; page?: string; site?: string; highlight?: string }>;
}) {
  return (
    <div>
      <div className="border-b border-black/[0.06] bg-amber-50/80 px-6 py-3">
        <p className="text-sm text-amber-950">
          <span className="font-semibold">Оператор:</span> меняйте статус в колонке «Изменить» или в чате
          справа у текущего заказа. Клиент увидит обновление в кабинете за несколько секунд.
        </p>
      </div>
      <AdminOrdersPage searchParams={props.searchParams} />
    </div>
  );
}
