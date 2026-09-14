import type { Station } from "../domain/model.ts";
import type { StationArrival, StationArrivalBoard } from "../domain/station-arrivals.ts";
import { formatCountdown } from "./countdown.ts";
import { directionArrow, locationName, stationDisplayName } from "./location-label.ts";

const escape = (value: string): string => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
function renderArrival(arrival: StationArrival | undefined): string { if (!arrival) return `<li class="no-train"><span>--</span></li>`; return `<li class="${arrival.kind === "pass" ? "skip-stop" : ""}"><b>${escape(arrival.tripId)}</b><span>${arrival.kind === "pass" ? "列车跳停" : arrival.imminent ? arrival.kind === "departure" ? "即将发车" : "即将进站" : escape(formatCountdown(arrival.etaSeconds))}</span></li>`; }
function terminalName(direction: "up" | "down", arrivals: readonly StationArrival[], stations: readonly Station[], lineId: Station["lineId"]): string {
  const destination = arrivals[0]?.destinationId;
  if (destination) return locationName(destination, stations);
  const lineStations = stations.filter((candidate) => candidate.lineId === lineId && candidate.stationType !== "depot").sort((a, b) => a.sequence - b.sequence);
  const terminal = direction === "down" ? lineStations.at(-1) : lineStations[0];
  return terminal ? stationDisplayName(terminal) : "终点站";
}
function renderDirection(direction: "up" | "down", arrivals: readonly StationArrival[], stations: readonly Station[], lineId: Station["lineId"]): string { const slots = [arrivals[0], arrivals[1]]; return `<section><h4>${directionArrow(direction)} 开往${escape(terminalName(direction, arrivals, stations, lineId))}</h4><ol>${slots.map(renderArrival).join("")}</ol></section>`; }
export function renderStationDetail(station: Station, board: StationArrivalBoard, stations: readonly Station[]): string { const name = stationDisplayName(station); const notice = station.stationType === "depot" ? "车辆段 · 非运营" : station.stationType === "reserved" ? "预留点 · 列车不停靠" : ""; return `<article class="station-detail"><h3>${escape(name)}</h3>${notice ? `<p>${notice}</p>` : ""}<div class="station-arrivals">${renderDirection("down", board.down, stations, station.lineId)}${renderDirection("up", board.up, stations, station.lineId)}</div></article>`; }
