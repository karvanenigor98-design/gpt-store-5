/** Next 14: sync object. Next 15+: Promise. */
export async function resolveSearchParams<T extends Record<string, string | undefined>>(
  searchParams: Promise<T> | T | undefined,
): Promise<T> {
  if (searchParams == null) return {} as T;
  if (typeof (searchParams as Promise<T>).then === "function") {
    return searchParams as Promise<T>;
  }
  return searchParams as T;
}
