import type { Station } from "../domain/model.ts";

export function stationDisplayName(station: Pick<Station, "nameZh">): string { return station.nameZh.replace(/站$/u, ""); }
export function locationName(locationId: string, stations: readonly Station[]): string { const station = stations.find((candidate) => candidate.id === locationId); return station ? stationDisplayName(station) : locationId; }
export function directionArrow(direction: "up" | "down"): "▶" | "◀" { return direction === "up" ? "▶" : "◀"; }
