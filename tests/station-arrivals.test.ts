import assert from "node:assert/strict";
import { test } from "vitest";
import type { Station } from "../src/domain/model.ts";
import { calculateStationArrivals } from "../src/domain/station-arrivals.ts";
import type { DomainTimetable } from "../src/domain/timetable.ts";
import { renderStationDetail } from "../src/ui/station-detail.ts";

const timetable: DomainTimetable = { trips: [
  { tripId: "U01", vehicleId: "VU1", circulationId: "CU1", direction: "up", classification: "revenue", events: [{ locationId: "b-central", arrival: "10:00:20", departure: "10:00:50" }, { locationId: "b-west", arrival: "10:10:00" }] },
  { tripId: "U02", vehicleId: "VU2", circulationId: "CU2", direction: "up", classification: "revenue", events: [{ locationId: "b-central", arrival: "10:02:05", departure: "10:02:35" }, { locationId: "b-west", arrival: "10:12:00" }] },
  { tripId: "D01", vehicleId: "VD1", circulationId: "CD1", direction: "down", classification: "revenue", events: [{ locationId: "b-central", arrival: "10:00:10" }, { locationId: "b-east", arrival: "10:10:00" }] },
  { tripId: "START", vehicleId: "VS1", circulationId: "CS1", direction: "down", classification: "revenue", events: [{ locationId: "b-west", departure: "10:00:15" }, { locationId: "b-east", arrival: "10:12:00" }] },
  { tripId: "PASS", vehicleId: "VP1", circulationId: "CP1", direction: "down", classification: "revenue", events: [{ locationId: "b-garden", departure: "10:00:00" }, { locationId: "b-central", pass: "10:01:00" }, { locationId: "b-east", arrival: "10:10:00" }] },
], circulations: [] };
const stations = [
  { id: "b-west", nameZh: "新城西站", lineId: "MV-LB", sequence: 1, stationType: "operational" },
  { id: "b-central", nameZh: "星河站", lineId: "MV-LB", sequence: 3, stationType: "operational" },
  { id: "b-east", nameZh: "云谷东站", lineId: "MV-LB", sequence: 5, stationType: "operational" },
] as Station[];

test("station board keeps two passenger trains per direction", () => { const board = calculateStationArrivals(10 * 3600, "b-central", timetable); assert.deepEqual(board.up.map((item) => [item.tripId, item.etaSeconds, item.imminent]), [["U01", 20, true], ["U02", 125, false]]); assert.deepEqual(board.down.map((item) => item.tripId), ["D01", "PASS"]); const html = renderStationDetail(stations[1]!, board, stations); assert.match(html, /星河/); assert.match(html, /即将进站/); });
test("origin events are presented as departures", () => { const board = calculateStationArrivals(10 * 3600, "b-west", timetable); assert.equal(board.down[0]?.tripId, "START"); assert.equal(board.down[0]?.kind, "departure"); assert.equal(board.down[0]?.imminent, true); assert.match(renderStationDetail(stations[0]!, board, stations), /即将发车/); });
test("pass events are shown as skipped stops", () => { const board = calculateStationArrivals(10 * 3600 + 30, "b-central", timetable); assert.equal(board.down.find((item) => item.tripId === "PASS")?.kind, "pass"); assert.match(renderStationDetail(stations[1]!, board, stations), /列车跳停/); });
