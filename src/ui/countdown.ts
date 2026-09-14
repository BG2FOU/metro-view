export function formatCountdown(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.ceil(totalSeconds));
  if (safeSeconds < 60) return `${safeSeconds}秒`;
  const minutes = Math.floor(safeSeconds / 60);
  return `${minutes}分${String(safeSeconds % 60).padStart(2, "0")}秒`;
}
