import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "vitest";
import { buildRoute, distanceMeters } from "../src/domain/geometry.ts";
import { parseLineData } from "../src/domain/map-data.ts";

async function load(path: string, lineId: "MV-LA" | "MV-LB") { return parseLineData(JSON.parse(await readFile(path, "utf8")), lineId); }
test("sample line A builds a continuous route and depot branch", async () => { const route = buildRoute(await load("src/data/line-a.geojson", "MV-LA")); assert.equal(route.stationChainage.size, 5); assert.ok(route.lengthMeters > 4_000); const branch = route.branchRoutes?.get("a-depot"); assert.ok(branch); assert.equal(branch.fromId, "a-terminal"); assert.equal(branch.toId, "a-depot"); });
test("sample line B visits all mainline stations in sequence", async () => { const route = buildRoute(await load("src/data/line-b.geojson", "MV-LB")); assert.equal(route.stationChainage.size, 5); const chainages = [...route.stationChainage.values()]; assert.ok(chainages.every((item, index) => index === 0 || item > chainages[index - 1]!)); });
test("distance uses geographic coordinates", () => { assert.ok(distanceMeters([120, 30], [120.01, 30]) > 900); });
