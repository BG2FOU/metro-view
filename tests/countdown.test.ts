import assert from "node:assert/strict";
import { test } from "vitest";
import { formatCountdown } from "../src/ui/countdown.ts";

test("countdown uses seconds below one minute and minute-second format otherwise", () => {
  assert.equal(formatCountdown(0), "0秒");
  assert.equal(formatCountdown(59), "59秒");
  assert.equal(formatCountdown(60), "1分00秒");
  assert.equal(formatCountdown(125), "2分05秒");
});
