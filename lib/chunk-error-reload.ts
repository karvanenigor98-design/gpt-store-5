export function isStaleChunkError(error: unknown): boolean {
  const err = error as { name?: string; message?: string } | null;
  const text = `${err?.name ?? ""} ${err?.message ?? ""}`;
  return /ChunkLoadError|Loading chunk|Loading CSS chunk|Failed to fetch dynamically imported module/i.test(
    text,
  );
}

function cacheBustCurrentUrl(): string {
  const url = new URL(window.location.href);
  url.searchParams.set("_r", String(Date.now()));
  return url.pathname + url.search + url.hash;
}

/** Auto-reload killed — Yandex URIError / missing sessionStorage painted a blank loop. */
export function reloadOnceForStaleChunk(_error: unknown): void {
  return;
}

export function hardReloadCurrentPage(): void {
  if (typeof window === "undefined") return;
  window.location.replace(cacheBustCurrentUrl());
}

export function hardOpenHome(): void {
  window.location.replace("/");
}
