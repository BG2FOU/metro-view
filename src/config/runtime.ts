export interface RuntimeConfig { readonly amapKey?: string; readonly authMode: "direct" | "proxy"; readonly serviceHost?: string; readonly securityJsCode?: string; readonly timeApiUrl?: string }
export function readRuntimeConfig(env: Record<string, string | boolean | undefined> = import.meta.env): RuntimeConfig {
  const key = typeof env.VITE_AMAP_API_KEY === "string" && env.VITE_AMAP_API_KEY !== "your_amap_web_api_key" ? env.VITE_AMAP_API_KEY.trim() : undefined;
  const production = env.PROD === true;
  const mode = production || env.VITE_AMAP_AUTH_MODE === "proxy" ? "proxy" : "direct";
  const host = typeof env.VITE_AMAP_SERVICE_HOST === "string" ? env.VITE_AMAP_SERVICE_HOST.trim() : undefined;
  const securityJsCode = !production && typeof env.AMAP_SECURITY_JS_CODE === "string" ? env.AMAP_SECURITY_JS_CODE.trim() : undefined;
  if (mode === "proxy" && key && !host) throw new Error("Proxy authentication requires VITE_AMAP_SERVICE_HOST");
  return { ...(key ? { amapKey: key } : {}), authMode: mode, ...(host ? { serviceHost: host } : {}), ...(securityJsCode ? { securityJsCode } : {}), ...(typeof env.VITE_TIME_API_URL === "string" && env.VITE_TIME_API_URL ? { timeApiUrl: env.VITE_TIME_API_URL } : {}) };
}
