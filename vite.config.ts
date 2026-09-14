import { defineConfig } from "vitest/config";
import { existsSync, readFileSync } from "node:fs";
import { loadEnv } from "vite";

function readLocalAmapInput(): { key?: string; securityJsCode?: string } {
  if (!existsSync("amap-api-key.txt")) return {};
  const values = new Map<string, string>();
  for (const line of readFileSync("amap-api-key.txt", "utf8").split(/\r?\n/u)) {
    const match = line.match(/^\s*([^#:=]+)\s*[:=]\s*(.*?)\s*$/u);
    if (match?.[1] && match[2]) {
      const rawValue = match[2].trim();
      const quoted = (rawValue.startsWith('"') && rawValue.endsWith('"')) || (rawValue.startsWith("'") && rawValue.endsWith("'"));
      values.set(match[1].trim(), quoted ? rawValue.slice(1, -1) : rawValue);
    }
  }
  const key = values.get("AMAP_API_KEY");
  const securityJsCode = values.get("AMAP_SECURITY_JS_CODE");
  return { ...(key ? { key } : {}), ...(securityJsCode ? { securityJsCode } : {}) };
}

export default defineConfig(({ command, mode }) => {
  const localAmap = command === "serve" ? readLocalAmapInput() : {};
  const localEnv = command === "serve" ? loadEnv(mode, process.cwd(), "") : {};
  const localKey = localEnv.VITE_AMAP_API_KEY || localAmap.key || "";
  const localSecurityJsCode = localEnv.AMAP_SECURITY_JS_CODE || localAmap.securityJsCode || "";
  return {
    base: "./",
    define: {
      __METRO_VIEW_LOCAL_AMAP_KEY__: JSON.stringify(localKey),
      __METRO_VIEW_LOCAL_AMAP_SECURITY_JS_CODE__: JSON.stringify(localSecurityJsCode),
    },
    build: { target: "es2022", sourcemap: true },
    test: { environment: "node", include: ["tests/**/*.test.ts"] },
  };
});
