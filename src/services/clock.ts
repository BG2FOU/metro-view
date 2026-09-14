export interface ClockReading { readonly now: Date; readonly source: "json-api" | "http-date" | "device"; readonly degraded: boolean }
export async function readClock(options: { readonly timeApiUrl?: string; readonly fetch?: typeof fetch; readonly deviceNow?: () => number } = {}): Promise<ClockReading> {
  const request = options.fetch ?? fetch; const deviceNow = options.deviceNow ?? Date.now;
  if (options.timeApiUrl) { try { const started = deviceNow(); const response = await request(options.timeApiUrl, { cache: "no-store" }); const completed = deviceNow(); if (response.ok) { const body = await response.json() as { datetime?: string; now?: string }; const parsed = Date.parse(body.datetime ?? body.now ?? ""); if (Number.isFinite(parsed)) return { now: new Date(parsed + (completed - started) / 2), source: "json-api", degraded: false }; } } catch { /* fall through */ } }
  try { const started = deviceNow(); const response = await request(globalThis.location?.href ?? "/", { method: "HEAD", cache: "no-store" }); const completed = deviceNow(); const date = response.headers.get("date"); if (date) { const parsed = Date.parse(date); if (Number.isFinite(parsed)) return { now: new Date(parsed + (completed - started) / 2), source: "http-date", degraded: false }; } } catch { /* fall through */ }
  return { now: new Date(deviceNow()), source: "device", degraded: true };
}
