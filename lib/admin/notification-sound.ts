/** Звук уведомлений (админка / оператор / чат staff). */

export const NOTIFICATION_SOUND_ENABLED_KEY = "gptstore-admin-sound-enabled";
export const NOTIFICATION_SOUND_VOLUME_KEY = "gptstore-notification-volume";

export const NOTIFICATION_VOLUME_MIN = 1;
export const NOTIFICATION_VOLUME_MAX = 10;
export const NOTIFICATION_VOLUME_DEFAULT = 10;

/** Пик gain на Web Audio при volume=10. */
const PEAK_GAIN_AT_MAX = 0.72;

export function clampNotificationVolume(value: number): number {
  if (!Number.isFinite(value)) return NOTIFICATION_VOLUME_DEFAULT;
  return Math.min(
    NOTIFICATION_VOLUME_MAX,
    Math.max(NOTIFICATION_VOLUME_MIN, Math.round(value)),
  );
}

export function loadNotificationSoundEnabled(): boolean {
  try {
    const v = localStorage.getItem(NOTIFICATION_SOUND_ENABLED_KEY);
    return v === null ? true : v === "true";
  } catch {
    return true;
  }
}

export function saveNotificationSoundEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(NOTIFICATION_SOUND_ENABLED_KEY, String(enabled));
  } catch {
    /* noop */
  }
}

export function loadNotificationVolume(): number {
  try {
    const raw = localStorage.getItem(NOTIFICATION_SOUND_VOLUME_KEY);
    if (raw === null || raw === "") return NOTIFICATION_VOLUME_DEFAULT;
    const n = Number.parseInt(raw, 10);
    return clampNotificationVolume(n);
  } catch {
    return NOTIFICATION_VOLUME_DEFAULT;
  }
}

export function saveNotificationVolume(level: number): void {
  try {
    localStorage.setItem(
      NOTIFICATION_SOUND_VOLUME_KEY,
      String(clampNotificationVolume(level)),
    );
  } catch {
    /* noop */
  }
}

function peakGainForVolume(level: number): number {
  const v = clampNotificationVolume(level);
  return (v / NOTIFICATION_VOLUME_MAX) * PEAK_GAIN_AT_MAX;
}

export type NotificationPingOptions = {
  /** 1–10, по умолчанию из localStorage */
  volume?: number;
  frequency?: number;
};

/** Короткий звук при новом уведомлении. */
export function playNotificationPing(options?: NotificationPingOptions): void {
  if (typeof window === "undefined") return;

  const isPreview = options?.volume !== undefined;
  if (!isPreview && !loadNotificationSoundEnabled()) return;

  const level = options?.volume ?? loadNotificationVolume();

  const peak = peakGainForVolume(level);
  const freq = options?.frequency ?? 880;

  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.connect(g);
    g.connect(ctx.destination);
    o.frequency.value = freq;
    const t0 = ctx.currentTime;
    const dur = 0.28;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0001), t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.start(t0);
    o.stop(t0 + dur);

    const o2 = ctx.createOscillator();
    const g2 = ctx.createGain();
    o2.type = "sine";
    o2.frequency.value = freq * 1.25;
    o2.connect(g2);
    g2.connect(ctx.destination);
    g2.gain.setValueAtTime(0.0001, t0 + 0.08);
    g2.gain.exponentialRampToValueAtTime(Math.max(peak * 0.55, 0.0001), t0 + 0.1);
    g2.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + 0.05);
    o2.start(t0 + 0.08);
    o2.stop(t0 + dur + 0.06);

    window.setTimeout(() => void ctx.close(), 500);
  } catch {
    /* noop */
  }
}

/** Второй тон для входящего сообщения в чате (staff). */
export function playChatMessagePing(volume?: number): void {
  playNotificationPing({ volume, frequency: 660 });
}
