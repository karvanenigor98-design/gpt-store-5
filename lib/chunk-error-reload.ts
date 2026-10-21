export function isStaleChunkError(error: unknown): boolean {
  const err = error as { name?: string; message?: string } | null;
  const text = `${err?.name ?? ""} ${err?.message ?? ""}`;
  return /ChunkLoadError|Loading chunk|Loading CSS chunk|Failed to fetch dynamically imported module|\/_next\/static\/|URI malformed|URIError/i.test(
    text,
  );
}

function cacheBustCurrentUrl(): string {
  const url = new URL(window.location.href);
  url.searchParams.set("_r", String(Date.now()));
  return url.pathname + url.search + url.hash;
}

export function reloadOnceForStaleChunk(error: unknown): void {
  if (typeof window === "undefined") return;
  if (!isStaleChunkError(error)) return;
  try {
    if (new URL(window.location.href).searchParams.has("_r")) return;
  } catch {
    return;
  }
  try {
    if (sessionStorage.getItem("gpt_chunk_reload") === "1") return;
    sessionStorage.setItem("gpt_chunk_reload", "1");
  } catch {
    /* private mode — URL _r is the loop breaker */
  }
  window.location.replace(cacheBustCurrentUrl());
}

export function hardReloadCurrentPage(): void {
  try {
    sessionStorage.removeItem("gpt_chunk_reload");
  } catch {
    /* ignore */
  }
  if (typeof window === "undefined") return;
  window.location.replace(cacheBustCurrentUrl());
}

export function hardOpenHome(): void {
  try {
    sessionStorage.removeItem("gpt_chunk_reload");
  } catch {
    /* ignore */
  }
  window.location.replace("/");
}
