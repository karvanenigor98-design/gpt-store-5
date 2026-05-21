"use client";

import { useState } from "react";

type UserItem = {
  id: string;
  email: string | null;
  telegram_username: string | null;
  role: "client" | "operator" | "admin";
  created_at: string;
  ordersCount: number;
  paidTotal: number;
  lastOrderAt: string | null;
};

export function UsersRoleManager({
  users,
  currentUserId,
  adminSite = "gpt-store",
}: {
  users: UserItem[];
  currentUserId: string;
  /** В какую базу писать роли (profiles + опционально role_audit). */
  adminSite?: "gpt-store" | "subs-store";
}) {
  const [roles, setRoles] = useState<Record<string, UserItem["role"]>>(
    Object.fromEntries(users.map((u) => [u.id, u.role]))
  );
  const [operatorEmail, setOperatorEmail] = useState("");
  const [addingOperator, setAddingOperator] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [transferTargetId, setTransferTargetId] = useState("");
  const [transferGrant, setTransferGrant] = useState<"admin" | "operator">("operator");
  const [transferMigrate, setTransferMigrate] = useState(true);
  const [transferring, setTransferring] = useState(false);

  async function saveRole(userId: string) {
    setSavingId(userId);
    setMessage(null);
    const role = roles[userId];
    const res = await fetch("/api/admin/users/role", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, role, site: adminSite }),
    });
    const json = (await res.json()) as { error?: string };
    setSavingId(null);
    setMessage(res.ok ? "Роль обновлена" : json.error ?? "Ошибка обновления роли");
  }

  async function addOperatorByEmail() {
    const email = operatorEmail.trim().toLowerCase();
    if (!email) return;
    setAddingOperator(true);
    setMessage(null);

    const res = await fetch("/api/admin/users/operator-by-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, site: adminSite }),
    });
    const json = (await res.json()) as { error?: string; message?: string };
    setAddingOperator(false);

    if (!res.ok) {
      setMessage(json.error ?? "Не удалось назначить оператора");
      return;
    }

    setMessage(json.message ?? "Оператор назначен");
    setOperatorEmail("");
  }

  async function runTransfer() {
    if (!transferTargetId) return;
    if (transferMigrate && !currentUserId) {
      setMessage(
        adminSite === "subs-store" ?
          "Для переноса заказов и чатов нужен ваш профиль в Subs Store с тем же email, что у входа в админку."
        : "Не удалось определить ваш аккаунт для переноса данных.",
      );
      return;
    }
    setTransferring(true);
    setMessage(null);
    const res = await fetch("/api/admin/users/transfer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targetUserId: transferTargetId,
        grant: transferGrant,
        migrateData: transferMigrate,
        site: adminSite,
      }),
    });
    const json = (await res.json()) as {
      error?: string;
      role?: UserItem["role"];
      counts?: { orders: number; chat_sessions: number; chat_messages: number };
    };
    setTransferring(false);
    if (!res.ok) {
      setMessage(json.error ?? "Не удалось передать");
      return;
    }
    if (json.role) {
      setRoles((prev) => ({ ...prev, [transferTargetId]: json.role! }));
    }
    const c = json.counts;
    const extra =
      c && transferMigrate
        ? ` Перенесено: заказов ${c.orders}, чатов ${c.chat_sessions}, сообщений ${c.chat_messages}.`
        : "";
    setMessage(`Роль выдана получателю.${extra} Обновите сессию (перелогин или жёсткое обновление страницы), чтобы JWT подтянул контекст.`);
  }

  const transferCandidates = users.filter((u) => u.id !== currentUserId);

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <p className="text-sm font-semibold text-gray-900">Передача роли и данных</p>
        <p className="mt-1 text-xs text-gray-600">
          Выберите уже зарегистрированный аккаунт в{" "}
          {adminSite === "subs-store" ? "Subs Store" : "GPT Store"}. Ваша роль в системе не
          снимается; получателю выдаётся админ или оператор. При переносе данных заказы и чаты
          {adminSite === "subs-store" ?
            " поддержки с вашего Subs-профиля (тот же email, что у входа в админку)"
          : " с вашего user_id"}{" "}
          привязываются к получателю (заметки и теги профиля объединяются, если есть в базе).
        </p>
        {adminSite === "subs-store" && !currentUserId && (
          <p className="mt-2 text-xs text-amber-700">
            Ваш email не найден в Subs profiles — выдача роли работает, перенос заказов/чатов будет
            доступен после регистрации на Subs Store с тем же email.
          </p>
        )}
        <div className="mt-3 flex flex-col gap-3">
            <select
              value={transferTargetId}
              onChange={(e) => setTransferTargetId(e.target.value)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#10a37f]"
            >
              <option value="">— Кому передать —</option>
              {transferCandidates.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.email ?? u.id.slice(0, 8) + "…"} ({u.role})
                </option>
              ))}
            </select>
            <div className="flex flex-wrap gap-4 text-xs text-gray-700">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="grant"
                  checked={transferGrant === "operator"}
                  onChange={() => setTransferGrant("operator")}
                  className="accent-[#10a37f]"
                />
                Оператор
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="grant"
                  checked={transferGrant === "admin"}
                  onChange={() => setTransferGrant("admin")}
                  className="accent-[#10a37f]"
                />
                Администратор
              </label>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-xs text-gray-600">
              <input
                type="checkbox"
                checked={transferMigrate}
                onChange={(e) => setTransferMigrate(e.target.checked)}
                className="accent-[#10a37f]"
              />
              {adminSite === "subs-store" ?
                "Перенести заказы и чаты поддержки с моего Subs-аккаунта"
              : "Перенести заказы, сессии чата и сообщения с моего аккаунта"}
            </label>
            <button
              type="button"
              onClick={() => void runTransfer()}
              disabled={transferring || !transferTargetId}
              className="w-fit rounded-lg bg-[#10a37f] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {transferring ? "Передаём..." : "Передать"}
            </button>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <p className="text-sm font-semibold text-gray-900">Операторы поддержки</p>
        <p className="mt-1 text-xs text-gray-600">
          Введите email аккаунта и назначьте роль оператора одним кликом.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            type="email"
            value={operatorEmail}
            onChange={(e) => setOperatorEmail(e.target.value)}
            placeholder="operator@example.com"
            className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#10a37f]"
          />
          <button
            type="button"
            onClick={() => void addOperatorByEmail()}
            disabled={addingOperator || !operatorEmail.trim()}
            className="rounded-lg bg-[#10a37f] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {addingOperator ? "Назначаем..." : "Назначить оператором"}
          </button>
        </div>
      </div>

      {message && <p className="text-xs text-gray-600">{message}</p>}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr className="text-left text-xs font-semibold uppercase tracking-widest text-gray-500">
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Telegram</th>
              <th className="px-4 py-3">Роль</th>
              <th className="px-4 py-3">Заказов</th>
              <th className="px-4 py-3">Оплачено</th>
              <th className="px-4 py-3">Последний заказ</th>
              <th className="px-4 py-3">Регистрация</th>
              <th className="px-4 py-3">Действие</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map((u) => (
              <tr key={u.id} className="text-sm text-gray-700">
                <td className="px-4 py-3">{u.email ?? "—"}</td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {u.telegram_username ? `@${u.telegram_username}` : "—"}
                </td>
                <td className="px-4 py-3">
                  <select
                    value={roles[u.id]}
                    onChange={(e) =>
                      setRoles((prev) => ({
                        ...prev,
                        [u.id]: e.target.value as UserItem["role"],
                      }))
                    }
                    className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs text-gray-800"
                  >
                    <option value="client">client</option>
                    <option value="operator">operator</option>
                    <option value="admin">admin</option>
                  </select>
                </td>
                <td className="px-4 py-3 text-xs">{u.ordersCount}</td>
                <td className="px-4 py-3 text-xs font-semibold text-emerald-600">
                  {u.paidTotal.toLocaleString("ru-RU")} ₽
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {u.lastOrderAt ? new Date(u.lastOrderAt).toLocaleDateString("ru-RU") : "—"}
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {new Date(u.created_at).toLocaleDateString("ru-RU")}
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => void saveRole(u.id)}
                    disabled={savingId === u.id}
                    className="rounded-lg bg-[#10a37f] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                  >
                    {savingId === u.id ? "Сохранение..." : "Сохранить"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
