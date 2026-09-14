import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "vitest";
import { LA_BASE_TIMETABLE } from "../src/data/la-base-timetable.ts";
import { buildRoute } from "../src/domain/geometry.ts";
import { parseLineData } from "../src/domain/map-data.ts";
import { calculateTrainStates } from "../src/domain/train-state.ts";
import { serviceCalendarAt, type DomainTimetable } from "../src/domain/timetable.ts";

async function setup() { const line = parseLineData(JSON.parse(await readFile("src/data/line-a.geojson", "utf8")), "MV-LA"); return { route: buildRoute(line), timetable: LA_BASE_TIMETABLE as DomainTimetable }; }
test("synthetic timetable places a train between sample stations", async () => { const { route, timetable } = await setup(); const state = calculateTrainStates(6 * 3600 + 4 * 60, timetable, route, "MV-LA").find((item) => item.tripId === "LA-BASE-D-001"); assert.equal(state?.vehicleId, "LA-002"); assert.equal(state?.status, "moving"); assert.equal(state?.nextStationId, "a-central"); assert.equal(state?.destinationId, "a-harbor"); assert.ok(state?.position); });
test("dwelling state exposes departure countdown", async () => { const { route, timetable } = await setup(); const state = calculateTrainStates(6 * 3600 + 3 * 60 + 10, timetable, route, "MV-LA").find((item) => item.tripId === "LA-BASE-D-001"); assert.equal(state?.status, "dwelling"); assert.equal(state?.locationId, "a-museum-reserved"); assert.equal(state?.departureInSeconds, 20); assert.equal(state?.nextStationId, "a-central"); });
test("non-revenue sample trips expose the standard notice", async () => { const { route } = await setup(); const timetable: DomainTimetable = { trips: [{ tripId: "DEMO-NR", direction: "down", circulationId: "DEMO-C", vehicleId: "sample-trainset-099", classification: "non-revenue", events: [{ locationId: "a-terminal", departure: "07:00:00" }, { locationId: "a-central", arrival: "07:06:00" }] }], circulations: [{ circulationId: "DEMO-C", vehicleId: "sample-trainset-099", tripIds: ["DEMO-NR"], connections: [] }] }; const state = calculateTrainStates(7 * 3600 + 60, timetable, route, "MV-LA")[0]; assert.equal(state?.passengerService, false); assert.equal(state?.notice, "本次列车不载客"); });
test("service calendar respects the configured service-day rollover", () => { assert.equal(serviceCalendarAt(new Date("2030-01-06T18:00:00Z")), "weekend"); assert.equal(serviceCalendarAt(new Date("2030-01-06T20:00:00Z")), "weekday"); });
