/** Короткий звук при новом уведомлении (админка / оператор). */

export function playNotificationPing(): void {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.06, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    o.start(ctx.currentTime);
    o.stop(ctx.currentTime + 0.15);
    window.setTimeout(() => ctx.close(), 300);
  } catch {
    /* noop */
  }
}

export function loadNotificationSoundEnabled(): boolean {
  try {
    const v = localStorage.getItem("gptstore-admin-sound-enabled");
    return v === null ? true : v === "true";
  } catch {
    return true;
  }
}
