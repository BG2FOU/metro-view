import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    (window as Window & { __metroViewRuntimeErrors?: string[] }).__metroViewRuntimeErrors = [];
    window.addEventListener('error', event => (window as Window & { __metroViewRuntimeErrors?: string[] }).__metroViewRuntimeErrors?.push(event.message));
  });
  if (!process.env.METRO_VIEW_LIVE_MAP) await page.route(/^https:\/\//, route => route.abort());
  await page.goto('/', { waitUntil: 'domcontentloaded' });
});

test('live map renders synthetic sample features', async ({ page }) => {
  test.skip(!process.env.METRO_VIEW_LIVE_MAP, 'Live map is checked only when explicitly enabled');
  await expect(page.locator('.amap-maps')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('.station-marker[data-line-id="MV-LA"]')).toHaveCount(6);
  await expect(page.locator('.station-marker[data-line-id="MV-LB"]')).toHaveCount(5);
});

test('simulation and independent line selections work without loading the map', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Metro View 轨道交通运行图演示' })).toBeVisible();
  await expect(page.getByText('非 GPS 实时位置')).toBeVisible();
  await page.getByRole('button', { name: '运行图' }).click();
  await page.getByLabel('A 线列车运行图').selectOption('LA-SPECIAL');
  await page.getByLabel('B 线列车运行图').selectOption('LB-SPECIAL');
  await expect(page.locator('[data-schedule-current]')).toHaveText('A 线 LA-SPECIAL · B 线 LB-SPECIAL');
  await expect(page.getByLabel('自动切换')).not.toBeChecked();
  await page.getByRole('button', { name: '关闭运行图切换' }).click();
  await page.getByRole('button', { name: '时间控制' }).click();
  await expect(page.getByLabel('运行控制台')).toBeVisible();
  await page.getByRole('button', { name: '60×' }).click();
  await expect(page.getByText(/模拟时间 · 60×/)).toBeVisible();
  await page.getByRole('button', { name: '暂停', exact: true }).click();
  await expect(page.getByText('模拟时间 · 已暂停')).toBeVisible();
});

test('automatic and manual sample schedules persist independently', async ({ page }) => {
  await page.getByRole('button', { name: '时间控制' }).click();
  await page.locator('[data-time-input]').fill('2030-01-05 12:00:00');
  await page.locator('[data-time-input]').dispatchEvent('change');
  await page.getByRole('button', { name: '关闭时间控制' }).click();
  await page.getByRole('button', { name: '运行图' }).click();
  await page.getByLabel('自动切换').check();
  await expect(page.locator('[data-schedule-current]')).toHaveText('A 线 LA-NEXT · B 线 LB-WEEKEND-NEXT');
  await page.getByLabel('A 线列车运行图').selectOption('LA-BASE');
  await expect(page.locator('[data-schedule-current]')).toHaveText('A 线 LA-BASE · B 线 LB-WEEKEND-NEXT');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: '运行图' }).click();
  await expect(page.getByLabel('A 线列车运行图')).toHaveValue('LA-BASE');
  await expect(page.getByLabel('B 线列车运行图')).toHaveValue('LB-WEEKEND-NEXT');
  await expect(page.getByLabel('自动切换')).not.toBeChecked();
});

test('topology renders without AMap, resets to auto and opens station PIS', async ({ page }) => {
  await page.getByRole('button', { name: '运行图' }).click();
  await page.getByLabel('A 线列车运行图').selectOption('LA-SPECIAL');
  await page.getByRole('button', { name: '关闭运行图切换' }).click();
  await page.getByRole('button', { name: '时间控制' }).click();
  await page.locator('[data-time-input]').fill('2030-02-02 10:02:00');
  await page.locator('[data-time-input]').dispatchEvent('change');
  await page.getByRole('button', { name: '关闭时间控制' }).click();
  await page.getByRole('button', { name: '地图设置' }).click();
  await page.getByRole('button', { name: '线网图', exact: true }).click();
  await page.getByRole('button', { name: '关闭地图设置' }).click();
  await expect(page.locator('#network-map')).toBeVisible();
  await expect(page.locator('[data-route]')).toHaveCount(2);
  await expect(page.locator('.network-station')).toHaveCount(10);
  await expect(page.locator('.network-train')).not.toHaveCount(0);
  await expect(page.getByRole('button', { name: '运行图', exact: true })).toBeHidden();
  await page.locator('[data-network-station="a-terminal"]').click();
  await expect(page.locator('.pis-station-system')).toBeVisible();
  await expect(page.locator('.pis-station-name b').first()).toHaveText('晨曦站');
  await expect(page.locator('.pis-schedule')).toHaveCount(0);
  await page.getByRole('button', { name: '关闭信息' }).click();
  await page.getByRole('button', { name: '放大线网图' }).click();
  await expect(page.locator('.network-canvas')).toHaveCSS('width', /.+/);
  expect(await page.evaluate(() => localStorage.getItem('metro-view.schedule-selection.v1'))).toBe('auto');
  expect(await page.evaluate(() => (window as Window & { __metroViewRuntimeErrors?: string[] }).__metroViewRuntimeErrors)).toEqual([]);
});

test('360px viewport has no horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  const sizes = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(sizes.scroll).toBeLessThanOrEqual(sizes.client);
  await expect(page.getByRole('button', { name: '运行图' })).toBeVisible();
});
