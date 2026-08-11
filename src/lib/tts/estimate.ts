/** Client-safe duration estimate (keep in sync with server mock TTS). */
export function estimateDurationMs(text: string, rate = 1): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const chars = text.replace(/\s/g, "").length;
  const baseMs = Math.max(words * 420, chars * 55, 1500);
  return Math.round(baseMs / Math.max(0.5, Math.min(rate, 2)));
}

export function formatSeconds(ms: number | null | undefined): string {
  const sec = Math.max(0, Math.round((ms || 0) / 1000));
  return `${sec}s`;
}
