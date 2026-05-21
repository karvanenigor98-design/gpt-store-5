import type { UserRole } from "@/types/database";

/**
 * Куда вести пользователя после входа, с учётом роли и returnUrl.
 * Сотрудников не отправляем в клиентский кабинет по умолчанию.
 */
export function resolvePostLoginPath(returnUrl: string, role: UserRole): string {
  const safe =
    returnUrl.startsWith("/") && !returnUrl.startsWith("//") ? returnUrl : "/dashboard";

  if (role === "admin" || role === "operator") {
    const staffBase = role === "admin" ? "/admin" : "/operator";
    if (safe.startsWith("/dashboard/chat")) {
      return `${staffBase}/chat`;
    }
    if (
      safe.startsWith("/dashboard") ||
      safe.startsWith("/cabinet") ||
      safe === "/" ||
      safe.startsWith("/support") ||
      safe.startsWith("/login") ||
      safe.startsWith("/register")
    ) {
      return staffBase;
    }
    return safe;
  }

  return safe;
}
