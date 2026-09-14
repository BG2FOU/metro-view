import stationIconUrl from "../assets/icons/station.svg";
import type { LineData, Station } from "../domain/model.ts";
import type { AMapApi, MapInstance, MarkerInstance, Overlay } from "../services/amap.ts";
import { stationDisplayName } from "../ui/location-label.ts";

const escape = (value: string): string => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

export interface StationLayer {
  readonly overlays: readonly Overlay[];
  setVisible(visible: boolean): void;
  setNonOperatingStations(stationIds: ReadonlySet<string>): void;
  destroy(): void;
}

function markerContent(station: Station, data: LineData, nonOperatingStations: ReadonlySet<string>): string {
  const classes = [
    "station-marker",
    station.stationType === "reserved" ? "reserved" : "",
    station.stationType === "depot" ? "depot" : "",
    station.stationType === "operational" && nonOperatingStations.has(station.id) ? "non-operating" : "",
  ].filter(Boolean).join(" ");
  return `<div class="${classes}" data-line-id="${data.lineId}" data-station-id="${escape(station.id)}" style="--line-color:${escape(data.lineColor)}"><img src="${escape(stationIconUrl)}" alt="" aria-hidden="true"><b>${escape(stationDisplayName(station))}</b></div>`;
}

export function createStationLayer(api: AMapApi, map: MapInstance, data: LineData, onSelect?: (station: Station) => void): StationLayer {
  let nonOperatingStations: ReadonlySet<string> = new Set();
  const entries = data.stations.map((station) => {
    const name = stationDisplayName(station);
    const marker = new api.Marker({ position: station.coordinates, anchor: "center", zIndex: 120, content: markerContent(station, data, nonOperatingStations), title: name });
    if (onSelect) marker.on?.("click", () => onSelect(station));
    return { station, marker };
  });
  const overlays: readonly MarkerInstance[] = entries.map(({ marker }) => marker);
  map.add(overlays);
  return {
    overlays,
    setVisible: (visible) => overlays.forEach((overlay) => overlay.setMap(visible ? map : null)),
    setNonOperatingStations: (stationIds) => {
      nonOperatingStations = stationIds;
      entries.forEach(({ station, marker }) => marker.setContent?.(markerContent(station, data, nonOperatingStations)));
    },
    destroy: () => map.remove(overlays),
  };
}
