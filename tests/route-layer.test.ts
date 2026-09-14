import assert from "node:assert/strict";
import { test } from "vitest";
import type { LineData } from "../src/domain/model.ts";
import { createRouteLayer } from "../src/map/route-layer.ts";
import type { AMapApi, MapInstance, Overlay } from "../src/services/amap.ts";

test("route layer renders elevated double rails and an encased underground line", () => {
  const options: Record<string, unknown>[] = [];
  const overlays: Overlay[] = [];
  const removed: Overlay[][] = [];
  const api = { Polyline: class { constructor(value: Record<string, unknown>) { options.push(value); return { setMap() {} }; } } } as unknown as AMapApi;
  const map = { add: (items: readonly Overlay[]) => overlays.push(...items), remove: (items: readonly Overlay[]) => removed.push([...items]) } as unknown as MapInstance;
  const data = { lineId: "MV-LA", lineColor: "#E54B4B", stations: [], parts: [
    { id: "elevated", segmentId: "segment-1", sequence: 1, partNo: 1, partCount: 1, fromId: "a", toId: "b", structureType: "elevated", coordinates: [[120, 30], [120.01, 30.01]] },
    { id: "underground", segmentId: "segment-2", sequence: 2, partNo: 1, partCount: 1, fromId: "b", toId: "c", structureType: "underground", coordinates: [[120.01, 30.01], [120.02, 30.02]] },
  ] } as LineData;

  const destroy = createRouteLayer(api, map, data);
  assert.equal(overlays.length, 4);
  assert.deepEqual(options.map((option) => ({ color: option.strokeColor, weight: option.strokeWeight, zIndex: option.zIndex, extData: option.extData })), [
    { color: "#E54B4B", weight: 10, zIndex: 49, extData: { partId: "elevated", lineId: "MV-LA", structureType: "elevated", role: "rails" } },
    { color: "#FFF6F6", weight: 3, zIndex: 50, extData: { partId: "elevated", structureType: "elevated", role: "track-gap" } },
    { color: "#7A2830", weight: 10, zIndex: 47, extData: { partId: "underground", lineId: "MV-LA", structureType: "underground", role: "tunnel-casing" } },
    { color: "#E54B4B", weight: 6, zIndex: 48, extData: { partId: "underground", lineId: "MV-LA", structureType: "underground", role: "tunnel-core" } },
  ]);
  destroy();
  assert.deepEqual(removed, [overlays]);
});

test("sample line B uses its configured color with the same tunnel treatment", () => {
  const options: Record<string, unknown>[] = [];
  const api = { Polyline: class { constructor(value: Record<string, unknown>) { options.push(value); return { setMap() {} }; } } } as unknown as AMapApi;
  const map = { add() {}, remove() {} } as unknown as MapInstance;
  const data = { lineId: "MV-LB", lineColor: "#3B82F6", stations: [], parts: [{ id: "LB-S01-P01", segmentId: "LB-S01", sequence: 1, partNo: 1, partCount: 1, fromId: "a", toId: "b", structureType: "underground", coordinates: [[120, 30], [120.01, 30.01]] }] } as LineData;
  createRouteLayer(api, map, data);
  assert.deepEqual(options.map((option) => option.strokeColor), ["#1E3A5F", "#3B82F6"]);
});

test("route layer renders depot branch parts", () => {
  const options: Record<string, unknown>[] = [];
  const api = { Polyline: class { constructor(value: Record<string, unknown>) { options.push(value); return { setMap() {} }; } } } as unknown as AMapApi;
  const map = { add() {}, remove() {} } as unknown as MapInstance;
  const data = { lineId: "MV-LA", lineColor: "#E54B4B", stations: [], parts: [], branchParts: [{ id: "LA-D01-P01", segmentId: "LA-D01", sequence: 12, partNo: 1, partCount: 1, fromId: "a-terminal", toId: "a-depot", structureType: "elevated", coordinates: [[120, 30], [120.01, 30.01]] }] } as LineData;
  createRouteLayer(api, map, data);
  assert.equal(options.length, 2);
  assert.equal((options[0]?.extData as { partId?: string } | undefined)?.partId, "LA-D01-P01");
});
