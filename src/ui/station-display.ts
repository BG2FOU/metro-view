import type { Station } from "../domain/model.ts";
export function isReservedDisplayStation(station: Pick<Station, "id" | "lineId" | "stationType">): boolean {
  return station.stationType === "reserved";
}
/** A depot retains its data type while using the non-operating visual treatment. */
export function isNonOperatingDisplayStation(station: Pick<Station, "id" | "lineId">): boolean {
  return station.lineId === "MV-LA" && station.id === "a-depot";
}
