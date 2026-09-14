import assert from "node:assert/strict";
import { test } from "vitest";
import type { Station, TrainState } from "../src/domain/model.ts";
import { renderTrainDetail } from "../src/ui/train-detail.ts";

const stations = [{ id: "a-central", nameZh: "中央", nameEn: "Central" }, { id: "a-terminal", nameZh: "晨曦站", nameEn: "Dawn" }, { id: "a-depot", nameZh: "示例车辆段", nameEn: "Sample Depot" }] as Station[];

test("train detail renders Chinese state without station English name", () => {
  const state: TrainState = { vehicleId: "V01", circulationId: "C001", tripId: "DEMO-101", status: "dwelling", position: [120, 30], locationId: "a-central", nextStationId: "a-terminal", direction: "down", destinationId: "a-depot", departureInSeconds: 45, passengerService: true };
  const html = renderTrainDetail(state, stations);
  assert.match(html, /当前位置<\/dt><dd>中央/);
  assert.match(html, /前方到站<\/dt><dd>晨曦/);
  assert.doesNotMatch(html, /中央站/);
  assert.match(html, /开往示例车辆段方向/);
  assert.match(html, /预计发车<\/dt><dd>还有45秒/);
  assert.match(html, /停站中/);
  assert.doesNotMatch(html, /Central/);
});

test("train detail formats arrival countdown with minutes and seconds", () => {
  const state: TrainState = { vehicleId: "V01", circulationId: "C001", tripId: "DEMO-101", status: "moving", position: [120, 30], nextStationId: "a-terminal", etaSeconds: 125, passengerService: true };
  const html = renderTrainDetail(state, stations);
  assert.match(html, /预计到达<\/dt><dd>2分05秒/);
  assert.match(html, /前方到站<\/dt><dd>晨曦/);
  assert.doesNotMatch(html, /晨曦站站/);
});

test("train detail exposes non-passenger notice", () => {
  const state: TrainState = { vehicleId: "V01", circulationId: "C001", status: "moving", position: [120, 30], passengerService: false };
  assert.match(renderTrainDetail(state, stations), /本次列车不载客/);
});

test("Sample line B train detail keeps New Town West as the onboard direction", () => {
  const lineBStations = [{ id: "b-west", nameZh: "新城西", nameEn: "New Town West" }] as Station[];
  const state: TrainState = { vehicleId: "LB-001", circulationId: "LB-WEEKDAY-BASE-C001", tripId: "DEMO-103", status: "moving", position: [120, 30], direction: "up", destinationId: "b-west", passengerService: true, lineId: "MV-LB", lineColor: "#3B82F6" };
  const html = renderTrainDetail(state, lineBStations);
  assert.match(html, /车辆<\/dt><dd>LB-001/);
  assert.match(html, /开往新城西方向/);
  assert.doesNotMatch(html, /LB-WEEKDAY-BASE|trainset|开往示例终点方向/);
});

test("sample depot destination is resolved from the supplied station list as its destination", () => {
  const state: TrainState = { vehicleId: "LB-017", circulationId: "LB-WEEKDAY-BASE-C017", tripId: "DEMO-704", status: "moving", position: [120.03, 30.02], direction: "down", destinationId: "a-depot", passengerService: false, lineId: "MV-LB", lineColor: "#3B82F6" };
  const html = renderTrainDetail(state, [{ id: "a-depot", nameZh: "示例车辆段" } as Station]);
  assert.match(html, /开往示例车辆段方向/);
  assert.doesNotMatch(html, /开往a-depot方向/);
});
