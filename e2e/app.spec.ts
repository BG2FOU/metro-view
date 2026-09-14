import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { (window as Window & { __metroViewRuntimeErrors?: string[] }).__metroViewRuntimeErrors = []; window.addEventListener("error", (event) => (window as Window & { __metroViewRuntimeErrors?: string[] }).__metroViewRuntimeErrors?.push(event.message)); });
  if (!process.env.METRO_VIEW_LIVE_MAP) await page.route(/^https:\/\//, (route) => route.abort());
  await page.goto("/", { waitUntil: "domcontentloaded" });
});

test("live AMap renders only synthetic sample features", async ({ page }) => {
  test.skip(!process.env.METRO_VIEW_LIVE_MAP, "Live map is checked only when explicitly enabled");
  await expect.poll(async () => await page.locator(".amap-maps").isVisible() ? "loaded" : await page.locator("#map-error").isVisible() ? "error" : "loading", { timeout: 20_000 }).toBe("loaded");
  await expect(page.locator('.station-marker[data-line-id="MV-LA"]')).toHaveCount(6);
  await expect(page.locator('.station-marker[data-line-id="MV-LB"]')).toHaveCount(5);
  await expect(page.locator(".station-marker.reserved")).toHaveCount(1);
  await page.getByRole("button", { name: "运行图" }).click();
  await page.getByLabel("运行图类型").selectOption("next");
  await expect(page.locator(".station-marker.non-operating")).toHaveCount(2);
  await page.getByRole("button", { name: "关闭运行图切换" }).click();
  await page.getByRole("button", { name: "地图设置" }).click();
  await page.getByLabel("示例 A 线").uncheck().catch(() => undefined);
  await page.getByRole("button", { name: "关闭地图设置" }).click();
  const runtimeErrors = await page.evaluate(() => (window as Window & { __metroViewRuntimeErrors?: string[] }).__metroViewRuntimeErrors ?? []);
  expect(runtimeErrors.filter((message) => /decodeStyle|Unimplemented type/u.test(message))).toEqual([]);
});

test("simulation and controls work without loading the map", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "Metro View 轨道交通运行图演示" })).toBeVisible();
  await expect(page.getByText("非 GPS 实时位置")).toBeVisible();
  await expect(page.getByRole("link", { name: "BG2FOU" })).toHaveAttribute("href", "https://github.com/BG2FOU");
  await page.getByRole("button", { name: "运行图" }).click();
  await page.getByLabel("运行图类型").selectOption("next");
  await expect(page.locator("[data-schedule-current]")).toContainText("示例 A 线 LA-NEXT");
  await expect(page.locator("[data-schedule-current]")).toContainText(/示例 B 线 LB-(WEEKDAY|WEEKEND)-NEXT/);
  await page.getByRole("button", { name: "关闭运行图切换" }).click();
  await page.getByRole("button", { name: "时间控制" }).click();
  await expect(page.getByLabel("运行控制台")).toBeVisible();
  await expect(page.locator("[data-time-slider]")).toBeVisible();
  await page.getByRole("button", { name: "60×" }).click();
  await expect(page.getByText(/模拟时间 · 60×/)).toBeVisible();
  await page.getByRole("button", { name: "暂停", exact: true }).click();
  await expect(page.getByText("模拟时间 · 已暂停")).toBeVisible();
});

test("automatic and manual sample schedule switching is persisted", async ({ page }) => {
  await page.getByRole("button", { name: "时间控制" }).click();
  await page.locator("[data-time-input]").fill("2030-01-05 12:00:00");
  await page.locator("[data-time-input]").dispatchEvent("change");
  await page.getByRole("button", { name: "关闭时间控制" }).click();
  await page.getByRole("button", { name: "运行图" }).click();
  await page.getByLabel("自动切换").check();
  await expect(page.locator("[data-schedule-current]")).toHaveText("示例 A 线 LA-NEXT · 示例 B 线 LB-WEEKEND-NEXT");
  await page.getByLabel("运行图类型").selectOption("legacy");
  await expect(page.locator("[data-schedule-current]")).toHaveText("示例 A 线 LA-BASE · 示例 B 线 LB-WEEKEND-BASE");
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "运行图" }).click();
  await expect(page.getByLabel("运行图类型")).toHaveValue("legacy");
});

test("360px viewport has no horizontal overflow", async ({ page }) => { await page.setViewportSize({ width: 360, height: 800 }); const sizes = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth })); expect(sizes.scroll).toBeLessThanOrEqual(sizes.client); await expect(page.getByRole("button", { name: "运行图" })).toBeVisible(); });
