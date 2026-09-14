// @vitest-environment jsdom
import assert from "node:assert/strict";
import { test } from "vitest";
import type { Station, TrainState } from "../src/domain/model.ts";
import { createTrainLayer } from "../src/map/train-layer.ts";
import type { AMapApi, MapInstance } from "../src/services/amap.ts";

test("train marker shows trip and destination direction on separate lines", () => {
  const contents: HTMLElement[] = [];
  class Marker { constructor(options: Record<string, unknown>) { contents.push(options.content as HTMLElement); } setMap() {} setPosition() {} setContent(content: HTMLElement) { contents.push(content); } }
  const api = { Marker } as unknown as AMapApi;
  const map = { add() {}, remove() {} } as unknown as MapInstance;
  const stations = [{ id: "a-harbor", nameZh: "远航" }] as Station[];
  const state: TrainState = { vehicleId: "V01", circulationId: "C01", tripId: "DEMO-104", status: "moving", position: [120, 30], direction: "up", destinationId: "a-harbor", passengerService: true };
  createTrainLayer(api, map, () => {}, stations).update([state]);
  assert.equal(contents[0]?.querySelector("b")?.textContent, "DEMO-104");
  assert.equal(contents[0]?.querySelector("small")?.textContent, "▶ 远航");
});

test("Sample line B non-revenue trains keep their purple marker and visible service notice", () => {
  const contents: HTMLElement[] = [];
  class Marker { constructor(options: Record<string, unknown>) { contents.push(options.content as HTMLElement); } setMap() {} setPosition() {} setContent(content: HTMLElement) { contents.push(content); } }
  const api = { Marker } as unknown as AMapApi;
  const map = { add() {}, remove() {} } as unknown as MapInstance;
  const stations = [{ id: "b-west", nameZh: "新城西" }] as Station[];
  const state: TrainState = { vehicleId: "LB-001", circulationId: "LB-WEEKDAY-BASE-C001", tripId: "DEMO-102", status: "moving", position: [120, 30], direction: "up", destinationId: "b-west", passengerService: false, lineId: "MV-LB", lineColor: "#3B82F6" };
  createTrainLayer(api, map, () => {}, stations).update([state]);
  const marker = contents[0];
  assert.ok(marker?.classList.contains("non-revenue"));
  assert.equal(marker?.dataset.lineId, "MV-LB");
  assert.equal(marker?.style.getPropertyValue("--line-color"), "#3B82F6");
  assert.match(marker?.querySelector("small")?.textContent ?? "", /^非载客 ·/);
});

test("return-to-depot markers show the depot while keeping their boundary positions", () => {
  const contents: HTMLElement[] = [];
  class Marker { constructor(options: Record<string, unknown>) { contents.push(options.content as HTMLElement); } setMap() {} setPosition() {} setContent(content: HTMLElement) { contents.push(content); } }
  const api = { Marker } as unknown as AMapApi;
  const map = { add() {}, remove() {} } as unknown as MapInstance;
  const states: TrainState[] = [
    { vehicleId: "LA-001", circulationId: "LA-BASE-C001", tripId: "DEMO-119", status: "moving", position: [120.02, 30.01], direction: "down", destinationId: "a-depot", passengerService: false, lineId: "MV-LA", lineColor: "#E54B4B" },
    { vehicleId: "LB-017", circulationId: "LB-WEEKDAY-BASE-C017", tripId: "DEMO-704", status: "moving", position: [120.03, 30.02], direction: "down", destinationId: "a-depot", passengerService: false, lineId: "MV-LB", lineColor: "#3B82F6" },
  ];
  createTrainLayer(api, map, () => {}, [{ id: "a-depot", nameZh: "示例车辆段" } as Station]).update(states);
  const directions = contents.map((content) => content.querySelector("small")?.textContent ?? "");
  assert.ok(directions.some((direction) => /示例车辆段/u.test(direction)));
  assert.ok(directions.length >= 2 && directions.every((direction) => /示例车辆段/u.test(direction)));
});
