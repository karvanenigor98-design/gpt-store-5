/** Next 14: sync object; Next 15+: Promise — безопасно для обоих. */
export async function resolvePageSearchParams<
  T extends Record<string, string | string[] | undefined> = Record<string, string | undefined>,
>(searchParams: T | Promise<T> | undefined): Promise<T> {
  if (searchParams == null) {
    return {} as T;
  }
  if (typeof (searchParams as Promise<T>).then === "function") {
    return searchParams as Promise<T>;
  }
  return searchParams;
}
