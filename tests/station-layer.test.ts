import assert from "node:assert/strict";
import { test } from "vitest";
import type { LineData } from "../src/domain/model.ts";
import { createStationLayer } from "../src/map/station-layer.ts";
import type { AMapApi, MapInstance, Overlay } from "../src/services/amap.ts";

test("station markers use station.svg, a Chinese-only label and a click callback", () => {
  const options: Record<string, unknown>[] = [];
  const contents: string[] = [];
  const clickHandlers: (() => void)[] = [];
  class Marker {
    private readonly index: number;
    constructor(value: Record<string, unknown>) { this.index = options.length; options.push(value); contents.push(String(value.content)); }
    setMap() {}
    setContent(value: string) { contents[this.index] = value; }
    on(event: string, handler: () => void) { if (event === "click") clickHandlers.push(handler); }
  }
  const map = { add() {}, remove() {} } as unknown as MapInstance;
  const api = { Marker } as unknown as AMapApi;
  const data = { lineId: "MV-LA", lineColor: "#E54B4B", stations: [{ id: "a-central", nameZh: "中央", nameEn: "Central", sequence: 1, stationType: "operational", structureType: "underground", coordinates: [120, 30] }, { id: "a-museum-reserved", nameZh: "博览", nameEn: "Museum Reserved", sequence: 2, stationType: "reserved", structureType: "underground", coordinates: [120.01, 30.01] }, { id: "a-depot", nameZh: "示例车辆段", nameEn: "Sample Depot", sequence: 3, stationType: "depot", structureType: "elevated", coordinates: [120.02, 30.02] }, { id: "a-terminal", nameZh: "晨曦站", nameEn: "Dawn", sequence: 4, stationType: "operational", structureType: "underground", coordinates: [120.03, 30.03] }], parts: [] } as LineData;
  let selected = "";
  const layer = createStationLayer(api, map, data, (station) => { selected = station.id; });
  const content = String(options[0]?.content);
  assert.match(content, /<img[^>]+src="(?:data:image\/svg\+xml|[^"]*station\.svg)/);
  assert.match(content, /中央/);
  assert.doesNotMatch(content, /Central/);
  assert.equal(options[0]?.title, "中央");
  assert.equal(options[0]?.anchor, "center");
  assert.deepEqual(options[0]?.position, [120, 30]);
  assert.match(String(options[1]?.content), /station-marker reserved/);
  assert.match(String(options[1]?.content), /博览/);
  assert.match(String(options[2]?.content), /station-marker depot/);
  assert.equal(options[3]?.title, "晨曦");
  assert.match(contents[3]!, />晨曦<\/b>/);
  layer.setNonOperatingStations(new Set(["a-central", "a-museum-reserved", "a-depot"]));
  assert.match(contents[0]!, /station-marker non-operating/);
  assert.doesNotMatch(contents[1]!, /non-operating/);
  assert.doesNotMatch(contents[2]!, /non-operating/);
  clickHandlers[0]?.();
  assert.equal(selected, "a-central");
});
