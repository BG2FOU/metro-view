import assert from "node:assert/strict";
import { test } from "vitest";
import { SimulationClock } from "../src/services/simulation-clock.ts";

test("60x advances 600 simulated seconds in ten real seconds", () => { let wall = 1_700_000_000_000; let monotonic = 0; const clock = new SimulationClock(() => wall, () => monotonic); clock.setTime(new Date(wall)); clock.setRate(60); monotonic += 10_000; assert.equal(clock.snapshot().now.getTime(), wall + 600_000); });
test("rate changes retain the current simulation instant", () => { let monotonic = 0; const clock = new SimulationClock(() => 1000, () => monotonic); clock.setTime(new Date(5000)); clock.setRate(5); monotonic = 1000; const before = clock.snapshot().now.getTime(); clock.setRate(10); assert.equal(clock.snapshot().now.getTime(), before); monotonic = 2000; assert.equal(clock.snapshot().now.getTime(), before + 10_000); });
