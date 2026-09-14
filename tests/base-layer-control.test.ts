import assert from "node:assert/strict";
import { test } from "vitest";
import { createBaseLayerController } from "../src/map/base-layer-control.ts";
import type { AMapApi, MapInstance, Overlay } from "../src/services/amap.ts";

test("base layers switch between standard, satellite and satellite road network", () => {
  const standard = {} as Overlay;
  const satellite = {} as Overlay;
  const roadNet = {} as Overlay;
  const applied: (readonly Overlay[])[] = [];
  const map = { getLayers: () => [standard], setLayers: (layers: readonly Overlay[]) => applied.push(layers) } as unknown as MapInstance;
  const api = {
    createDefaultLayer: () => standard,
    TileLayer: {
      Satellite: class { constructor() { return satellite; } },
      RoadNet: class { constructor() { return roadNet; } },
    },
  } as unknown as AMapApi;

  const controller = createBaseLayerController(api, map);
  assert.equal(applied.length, 0);
  assert.equal(controller.mode, "standard");
  controller.setMode("satellite");
  assert.deepEqual(applied.at(-1), [satellite, roadNet]);
  controller.setRoadNetVisible(false);
  assert.deepEqual(applied.at(-1), [satellite]);
  controller.setMode("standard");
  assert.deepEqual(applied.at(-1), [standard]);
});
