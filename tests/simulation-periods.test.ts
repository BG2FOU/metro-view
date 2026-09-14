import assert from "node:assert/strict";
import { test } from "vitest";
import { isServiceWeekend, servicePeriodsForDate } from "../src/ui/simulation-periods.ts";

test("weekday timeline contains both weekday sample peak periods", () => {
  assert.equal(isServiceWeekend("2030-01-02"), false);
  const peaks = servicePeriodsForDate("2030-01-02").filter((period) => period.kind === "peak");
  assert.deepEqual(peaks.map(({ start, end }) => [start, end]), [[7 * 3600, 9 * 3600], [17 * 3600, 19 * 3600]]);
});

test("weekend timeline contains weekend sample flat and low periods", () => {
  assert.equal(isServiceWeekend("2030-01-05"), true);
  const periods = servicePeriodsForDate("2030-01-05");
  assert.equal(periods.some((period) => period.kind === "peak"), false);
  assert.equal(periods.some((period) => period.kind === "flat"), true);
  assert.equal(periods.filter((period) => period.kind === "off-peak").length, 2);
});

test("next weekend sample evening low period begins at 21:00", () => {
  const periods = servicePeriodsForDate("2030-01-05", "next");
  const eveningLow = periods.find((period) => period.kind === "off-peak" && period.start >= 20 * 3600);
  assert.deepEqual(eveningLow, { start: 21 * 3600, end: 22 * 3600 + 30 * 60, kind: "off-peak", label: "低峰" });
});
