import type { Station, TrainState } from "../domain/model.ts";
import { formatCountdown } from "./countdown.ts";
import { locationName } from "./location-label.ts";

const STATUS: Record<TrainState["status"], string> = { waiting: "等待上线", moving: "运行中", dwelling: "停站中", turning: "折返中", standby: "备用", "out-of-service": "已下线" };
const escape = (value: string): string => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

export function renderTrainDetail(state: TrainState, stations: readonly Station[]): string {
  const location = state.locationId ? locationName(state.locationId, stations) : undefined;
  const nextStation = state.nextStationId ? locationName(state.nextStationId, stations) : undefined;
  const destination = state.destinationId ? locationName(state.destinationId, stations) : undefined;
  const rows = [
    ["车辆", state.vehicleId],
    ["车次", state.tripId ?? "待命"],
    ["状态", STATUS[state.status]],
    ...(destination ? [["运行方向", `开往${destination}方向`]] : []),
    ...(location ? [["当前位置", location]] : []),
    ...(nextStation ? [["前方到站", nextStation]] : []),
    ...(state.status === "dwelling" && state.departureInSeconds !== undefined ? [["预计发车", `还有${formatCountdown(state.departureInSeconds)}`]] : state.etaSeconds !== undefined ? [["预计到达", formatCountdown(state.etaSeconds)]] : []),
  ];
  return `<article class="train-detail"><h3>列车状态</h3><dl>${rows.map(([term, value]) => `<div><dt>${escape(term!)}</dt><dd>${escape(value!)}</dd></div>`).join("")}</dl>${!state.passengerService || state.notice ? `<p>${escape(state.notice ?? "本次列车不载客")}</p>` : ""}</article>`;
}
