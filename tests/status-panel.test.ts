// @vitest-environment jsdom
import assert from "node:assert/strict";
import { test } from "vitest";
import type { Station, TrainState } from "../src/domain/model.ts";
import { renderStatusPanel } from "../src/ui/status-panel.ts";

test("status panel keeps Sample line B non-revenue trains visible and distinguishable", () => {
  const container = document.createElement("div");
  const state: TrainState = {
    vehicleId: "LB-001",
    circulationId: "LB-WEEKDAY-BASE-C001",
    tripId: "DEMO-102",
    status: "moving",
    position: [120, 30],
    direction: "up",
    destinationId: "b-west",
    nextStationId: "a-depot",
    etaSeconds: 146,
    passengerService: false,
    notice: "本次列车不载客",
    lineId: "MV-LB",
    lineColor: "#3B82F6",
  };
  renderStatusPanel(container, [state], [{ id: "a-depot", nameZh: "示例车辆段" } as Station]);
  const card = container.querySelector<HTMLElement>(".state-card");
  assert.ok(card?.classList.contains("non-revenue"));
  assert.equal(card?.dataset.trainKey, "MV-LB:LB-001");
  assert.equal(card?.style.getPropertyValue("--line-color"), "#3B82F6");
  assert.match(card?.textContent ?? "", /示例 B 线 · DEMO-102/);
  assert.match(card?.textContent ?? "", /本次列车不载客/);
  assert.match(card?.textContent ?? "", /前方 示例车辆段/);
  assert.doesNotMatch(card?.textContent ?? "", /a-depot/);
});
