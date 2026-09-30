import { expect, test } from "@playwright/test";

for (const width of [1280, 390]) {
  for (const line of ["A", "B"]) {
    for (const mode of ["A", "B"]) {
      test(`PIS synthetic states at ${width}px, line ${line}, mode ${mode}`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(`/pis-demo.html?screen=train&mode=${mode}`);
        await page.locator(`[data-demo-line="${line}"]`).click();
        for (const direction of ["up", "down"]) {
          await page.locator(`[data-demo-direction="${direction}"]`).click();
          for (const stop of ["ordinary", "transfer"]) {
            await page.locator(`[data-demo-stop="${stop}"]`).click();
            for (const phase of ["moving", "approaching", "dwelling"]) {
              await page.locator(`[data-demo-phase="${phase}"]`).click();
              const highlighted = page.locator(".pis-stop.is-highlighted");
              await expect(highlighted).toHaveCount(1);
              await expect(highlighted.locator(".pis-stop-name b")).toHaveCSS("color", "rgb(199, 25, 50)");
              await expect(highlighted.locator(".pis-stop-name small")).toHaveCSS("color", "rgb(199, 25, 50)");
              await expect(page.locator(".pis-stop.is-current")).toHaveCount(phase === "moving" ? 0 : 1);
              await expect(page.locator(".pis-route-segment.is-running i")).toHaveCount(phase === "moving" ? 3 : 0);
              await expect(page.locator(".pis-stop.is-past").first().locator(".pis-stop-name")).toHaveCSS("color", "rgb(140, 155, 171)");
              if (phase === "moving") {
                await expect(page.locator(".pis-route-segment.is-running")).toHaveCSS("background-image", "none");
              } else if (stop === "transfer") {
                await expect(highlighted.locator(".pis-transfer-inner-arrows")).toBeVisible();
                await expect(highlighted.locator(".pis-transfer-badge")).toBeVisible();
                await expect(highlighted.locator(".pis-stop-eta")).toHaveCount(0);
              } else {
                const center = await highlighted.locator(".pis-stop-dot").evaluate((element) => getComputedStyle(element, "::after").backgroundColor);
                expect(center).toBe("rgb(199, 25, 50)");
              }
              expect(await page.locator(".demo-dialog").evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
              if (mode === "A" && direction === "up" && phase !== "dwelling") {
                await page.locator(".pis-train-system").screenshot({ path: `test-results/pis-${width}-${line}-${stop}-${phase}.png` });
              }
            }
          }
        }
      });
    }
  }
}

for (const viewport of [{ width: 320, height: 600 }, { width: 360, height: 800 }, { width: 390, height: 844 }]) {
  for (const mode of ["A", "B"]) {
    test(`mobile PIS station labels remain complete at ${viewport.width}px in mode ${mode}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto(`/pis-demo.html?screen=train&mode=${mode}`);
      for (const line of ["A", "B"]) {
        await page.locator(`[data-demo-line="${line}"]`).click();
        await page.evaluate(() => document.fonts.ready);
        const labels = await page.locator(".pis-stop-name").evaluateAll(elements => elements.map(element => {
          const frame = element.closest(".pis-route-fit")!.getBoundingClientRect();
          const bounds = element.getBoundingClientRect();
          const circle = element.parentElement!.querySelector(".pis-stop-dot, .pis-transfer-ring")!.getBoundingClientRect();
          const chinese = element.querySelector("b")!.getBoundingClientRect();
          const english = element.querySelector("small")!.getBoundingClientRect();
          return {
            name: element.querySelector("b")!.textContent,
            transform: getComputedStyle(element).transform,
            centerOffset: Math.abs((bounds.left + bounds.right - circle.left - circle.right) / 2),
            circleGap: circle.top - bounds.bottom,
            bilingualGap: english.left - chinese.right,
            inside: bounds.left >= frame.left && bounds.right <= frame.right && bounds.top >= frame.top,
            fullText: [...element.children].every(child => child.scrollWidth <= child.clientWidth),
          };
        }));
        expect(labels[0]!.name).toBe(line === "A" ? "远航站" : "云谷东站");
        expect(labels[0]!.transform).toBe(labels[1]!.transform);
        for (const label of labels) {
          expect(label.centerOffset, `${label.name}: aligned with its own circle`).toBeLessThan(1);
          expect(label.circleGap, `${label.name}: close to circle`).toBeGreaterThanOrEqual(3.5);
          expect(label.circleGap, `${label.name}: close to circle`).toBeLessThanOrEqual(4.5);
          expect(Math.abs(label.bilingualGap), `${label.name}: compact bilingual label`).toBeLessThan(1);
          expect(label.fullText, `${label.name}: full Chinese and English names`).toBe(true);
          expect(label.inside, `${label.name}: label stays within the route screen`).toBe(true);
        }
        await page.locator(".pis-train-system").screenshot({ path: `test-results/pis-labels-${viewport.width}-${line}-${mode}.png` });
      }
    });
  }
}


test("actual mobile train dialogs keep bilingual names close to their station circles", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route(/^https:\/\//, route => route.abort());
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "时间控制" }).click();
  await page.locator("[data-time-input]").fill("2030-02-02 10:02:00");
  await page.locator("[data-time-input]").dispatchEvent("change");
  await page.getByRole("button", { name: "关闭时间控制" }).click();
  await page.getByRole("button", { name: "地图设置" }).click();
  const settings = page.getByRole("dialog", { name: "地图与列车显示" });
  await settings.getByRole("button", { name: "列车状态侧栏：隐藏" }).click();
  await settings.getByRole("button", { name: "关闭地图设置" }).click();
  for (const line of ["A", "B"]) {
    await page.locator(`.state-card:not(.non-revenue)[data-train-key^="MV-L${line}:"]`).first().click();
    const screen = page.locator(".pis-train-system");
    await expect(screen).toBeVisible();
    const geometry = await screen.locator(".pis-stop-name").evaluateAll(elements => elements.map(element => {
      const label = element.getBoundingClientRect();
      const circle = element.parentElement!.querySelector(".pis-stop-dot, .pis-transfer-ring")!.getBoundingClientRect();
      const chinese = element.querySelector("b")!.getBoundingClientRect();
      const english = element.querySelector("small")!.getBoundingClientRect();
      return { name: element.textContent, offset: Math.abs((label.left + label.right - circle.left - circle.right) / 2), gap: circle.top - label.bottom, bilingualGap: english.left - chinese.right };
    }));
    for (const item of geometry) {
      expect(item.offset, item.name!).toBeLessThan(1);
      expect(item.gap, item.name!).toBeGreaterThanOrEqual(3.5);
      expect(item.gap, item.name!).toBeLessThanOrEqual(4.5);
      expect(Math.abs(item.bilingualGap), item.name!).toBeLessThan(1);
    }
    await screen.screenshot({ path: `test-results/pis-actual-mobile-${line}.png` });
    await page.getByRole("button", { name: "关闭信息" }).click();
  }
});
