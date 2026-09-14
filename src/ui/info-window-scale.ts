export function infoWindowFontSize(zoom: number): number {
  if (!Number.isFinite(zoom)) return 13;
  return Math.min(19, Math.max(10, 13 * 1.08 ** (zoom - 11)));
}
