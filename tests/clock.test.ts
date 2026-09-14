import assert from "node:assert/strict";
import { test } from "vitest";
import { readClock } from "../src/services/clock.ts";
import { readRuntimeConfig } from "../src/config/runtime.ts";

test("clock prefers configured JSON time and applies RTT midpoint", async () => { let now = 1000; const result = await readClock({ timeApiUrl: "/time", deviceNow: () => { now += 100; return now; }, fetch: async () => new Response(JSON.stringify({ datetime: "2030-01-02T00:00:00Z" }), { status: 200 }) }); assert.equal(result.source, "json-api"); assert.equal(result.degraded, false); assert.equal(result.now.getTime(), Date.parse("2030-01-02T00:00:00Z") + 50); });
test("clock falls back to device when remote sources fail", async () => { const result = await readClock({ timeApiUrl: "/time", deviceNow: () => 1234, fetch: async () => { throw new Error("offline"); } }); assert.equal(result.source, "device"); assert.equal(result.degraded, true); assert.equal(result.now.getTime(), 1234); });
test("production runtime forces proxy authentication", () => { assert.deepEqual(readRuntimeConfig({ PROD: true, VITE_AMAP_AUTH_MODE: "direct", VITE_AMAP_API_KEY: "key", VITE_AMAP_SERVICE_HOST: "https://example.test/_AMapService" }), { amapKey: "key", authMode: "proxy", serviceHost: "https://example.test/_AMapService" }); });
test("production runtime rejects a missing proxy host", () => { assert.throws(() => readRuntimeConfig({ PROD: true, VITE_AMAP_AUTH_MODE: "direct", VITE_AMAP_API_KEY: "key" }), /requires VITE_AMAP_SERVICE_HOST/); });
test("development runtime supports the provided Web Key and security code", () => { assert.deepEqual(readRuntimeConfig({ DEV: true, VITE_AMAP_API_KEY: "key", AMAP_SECURITY_JS_CODE: "local-security" }), { amapKey: "key", authMode: "direct", securityJsCode: "local-security" }); });
test("proxy runtime never consumes securityJsCode", () => { const config = readRuntimeConfig({ PROD: true, VITE_AMAP_AUTH_MODE: "proxy", VITE_AMAP_API_KEY: "key", VITE_AMAP_SERVICE_HOST: "https://example.test/_AMapService", AMAP_SECURITY_JS_CODE: "forbidden" }); assert.deepEqual(config, { amapKey: "key", authMode: "proxy", serviceHost: "https://example.test/_AMapService" }); });
