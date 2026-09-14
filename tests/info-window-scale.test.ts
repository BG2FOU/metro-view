import assert from "node:assert/strict";
import { test } from "vitest";
import { infoWindowFontSize } from "../src/ui/info-window-scale.ts";

test("information window font size follows map zoom with safe limits", () => {
  assert.equal(infoWindowFontSize(11), 13);
  assert.ok(infoWindowFontSize(12) > infoWindowFontSize(11));
  assert.ok(infoWindowFontSize(10) < infoWindowFontSize(11));
  assert.equal(infoWindowFontSize(-100), 10);
  assert.equal(infoWindowFontSize(100), 19);
  assert.equal(infoWindowFontSize(Number.NaN), 13);
});
