export function isStaleChunkError(error: unknown): boolean {
  const err = error as { name?: string; message?: string } | null;
  const text = `${err?.name ?? ""} ${err?.message ?? ""}`;
  return /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|\/_next\/static\//i.test(
    text,
  );
}

export function reloadOnceForStaleChunk(error: unknown): void {
  if (typeof window === "undefined") return;
  if (!isStaleChunkError(error)) return;
  try {
    if (sessionStorage.getItem("gpt_chunk_reload") === "1") return;
    sessionStorage.setItem("gpt_chunk_reload", "1");
  } catch {
    /* private mode */
  }
  window.location.reload();
}

export function hardOpenHome(): void {
  try {
    sessionStorage.removeItem("gpt_chunk_reload");
  } catch {
    /* ignore */
  }
  window.location.replace("/");
}
