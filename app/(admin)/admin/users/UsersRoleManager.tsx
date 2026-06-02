"use client";

import { useCallback, useRef, useState } from "react";

type UserItem = {
  id: string;
  email: string | null;
  telegram_username: string | null;
  role: "client" | "operator" | "admin";
  created_at: string;
  ordersCount: number;
  paidTotal: number;
  lastOrderAt: string | null;
  referralCode?: string | null;
  referredByEmail?: string | null;
  referralsCount?: number;
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
  const [savedRoles, setSavedRoles] = useState<Record<string, UserItem["role"]>>(
    Object.fromEntries(users.map((u) => [u.id, u.role]))
  );
  const [rowStatus, setRowStatus] = useState<Record<string, "ok" | "error">>({});
  const [rowError, setRowError] = useState<Record<string, string>>({});
  const usersByIdRef = useRef(new Map(users.map((u) => [u.id, u])));
  usersByIdRef.current = new Map(users.map((u) => [u.id, u]));
  const [operatorEmail, setOperatorEmail] = useState("");
  const [addingOperator, setAddingOperator] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [transferTargetId, setTransferTargetId] = useState("");
  const [transferGrant, setTransferGrant] = useState<"admin" | "operator">("operator");
  const [transferMigrate, setTransferMigrate] = useState(true);
  const [transferring, setTransferring] = useState(false);

  const saveRole = useCallback(
    async (userId: string, role: UserItem["role"]) => {
      const previous = savedRoles[userId];
      if (previous === role) return true;

      setSavingId(userId);
      setRowStatus((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
      setRowError((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });

      const res = await fetch("/api/admin/users/role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role, site: adminSite }),
      });
      const json = (await res.json()) as { error?: string; role?: UserItem["role"] };

      setSavingId(null);

      if (!res.ok) {
        setRoles((prev) => ({ ...prev, [userId]: previous }));
        setRowStatus((prev) => ({ ...prev, [userId]: "error" }));
        setRowError((prev) => ({
          ...prev,
          [userId]: json.error ?? "Не удалось сохранить роль",
        }));
        setMessage(json.error ?? "Ошибка обновления роли");
        return false;
      }

      const persisted = json.role ?? role;
      setRoles((prev) => ({ ...prev, [userId]: persisted }));
      setSavedRoles((prev) => ({ ...prev, [userId]: persisted }));
      setRowStatus((prev) => ({ ...prev, [userId]: "ok" }));
      const email = usersByIdRef.current.get(userId)?.email;
      setMessage(
        email ?
          `Роль ${email} → ${persisted}`
        : `Роль обновлена → ${persisted}`,
      );
      return true;
    },
    [adminSite, savedRoles],
  );

  function handleRoleChange(userId: string, role: UserItem["role"]) {
    setRoles((prev) => ({ ...prev, [userId]: role }));
    void saveRole(userId, role);
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
      setSavedRoles((prev) => ({ ...prev, [transferTargetId]: json.role! }));
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
          {adminSite === "subs-store" ? "SPOTIFY STORE" : "GPT STORE"}. Ваша роль в системе не
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
      <p className="text-xs text-gray-500">
        Роль сохраняется сразу при выборе в списке (в базе profiles и site_memberships).
      </p>
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr className="text-left text-xs font-semibold uppercase tracking-widest text-gray-500">
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Telegram</th>
              <th className="px-4 py-3">Роль</th>
              <th className="px-4 py-3">Реф. код</th>
              <th className="px-4 py-3">Кто привёл</th>
              <th className="px-4 py-3">Пригласил</th>
              <th className="px-4 py-3">Заказов</th>
              <th className="px-4 py-3">Оплачено</th>
              <th className="px-4 py-3">Последний заказ</th>
              <th className="px-4 py-3">Регистрация</th>
              <th className="px-4 py-3">Статус</th>
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
                      handleRoleChange(u.id, e.target.value as UserItem["role"])
                    }
                    disabled={savingId === u.id}
                    className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs text-gray-800 disabled:opacity-60"
                  >
                    <option value="client">client</option>
                    <option value="operator">operator</option>
                    <option value="admin">admin</option>
                  </select>
                </td>
                <td className="px-4 py-3 text-xs font-mono text-gray-500">{u.referralCode ?? "—"}</td>
                <td className="px-4 py-3 text-xs text-gray-500">{u.referredByEmail ?? "—"}</td>
                <td className="px-4 py-3 text-xs">{u.referralsCount ?? 0}</td>
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
                <td className="px-4 py-3 text-xs">
                  {savingId === u.id ?
                    <span className="text-gray-500">Сохранение…</span>
                  : rowStatus[u.id] === "ok" ?
                    <span className="font-medium text-emerald-600">Сохранено</span>
                  : rowStatus[u.id] === "error" ?
                    <span className="text-red-600" title={rowError[u.id]}>
                      Ошибка
                    </span>
                  : roles[u.id] !== savedRoles[u.id] ?
                    <span className="text-amber-600">…</span>
                  : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
