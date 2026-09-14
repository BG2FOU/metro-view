import assert from "node:assert/strict";
import { test } from "vitest";
import { formatServiceDateTimeLocal, parseServiceDateTimeLocal } from "../src/services/service-time.ts";

test("datetime-local values are interpreted as configured service time", () => {
  assert.equal(parseServiceDateTimeLocal("2030-01-02T05:11")?.toISOString(), "2030-01-01T21:11:00.000Z");
  assert.equal(parseServiceDateTimeLocal("2030-01-02T10:16:30")?.toISOString(), "2030-01-02T02:16:30.000Z");
});

test("invalid datetime-local values are rejected", () => {
  assert.equal(parseServiceDateTimeLocal(""), undefined);
  assert.equal(parseServiceDateTimeLocal("2030-01-02 05:11"), undefined);
});

test("instants are formatted as service datetime-local values", () => {
  assert.equal(formatServiceDateTimeLocal(new Date("2030-01-01T21:11:30Z")), "2030-01-02T05:11:30");
});
