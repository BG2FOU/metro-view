import metroIconRaw from "../assets/icons/metro.svg?raw";
import type { LineId, Station, TrainState } from "../domain/model.ts";
import type { AMapApi, MapInstance, MarkerInstance } from "../services/amap.ts";
import { directionArrow, locationName } from "../ui/location-label.ts";

const iconCache = new Map<string, string>();
function iconFor(color: string): string {
  const cached = iconCache.get(color); if (cached) return cached;
  const source = metroIconRaw.replaceAll("#E71419", color).replaceAll("#e71419", color).replaceAll("#F4B2B0", color === "#BA28B9" ? "#E7B4E7" : "#F4B2B0");
  const url = `data:image/svg+xml,${encodeURIComponent(source)}`; iconCache.set(color, url); return url;
}
const label = (state: TrainState): string => `${state.vehicleId}${state.tripId ? ` · ${state.tripId}` : ""}`;
const createContent = (state: TrainState, stations: readonly Station[], onSelect: (state: TrainState) => void): HTMLButtonElement => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `train-marker ${state.status === "moving" ? "moving" : ""}${state.passengerService ? "" : " non-revenue"}`;
  button.setAttribute("aria-label", `查看列车 ${label(state)} 状态`);
  const color = state.lineColor ?? "#E71419";
  button.style.setProperty("--line-color", color);
  button.dataset.lineId = state.lineId ?? "MV-LA";
  button.innerHTML = `<img src="${iconFor(color)}" alt=""><span class="train-marker-label"><b></b><small></small></span>`;
  const trip = button.querySelector<HTMLElement>("b");
  if (trip) trip.textContent = state.tripId ?? state.vehicleId;
  const direction = button.querySelector<HTMLElement>("small");
  if (direction && state.direction && state.destinationId) direction.textContent = `${state.passengerService ? "" : "非载客 · "}${directionArrow(state.direction)} ${locationName(state.destinationId, stations)}`;
  else direction?.remove();
  button.addEventListener("click", (event) => { event.stopPropagation(); onSelect(state); });
  return button;
};

export function createTrainLayer(api: AMapApi, map: MapInstance, onSelect: (state: TrainState) => void, stations: readonly Station[] = []): { update(states: readonly TrainState[]): void; setLineVisible(lineId: LineId, visible: boolean): void; destroy(): void } {
  const markers = new Map<string, { marker: MarkerInstance; state: TrainState }>();
  const visibleLines = new Set<LineId>(["MV-LA", "MV-LB"]);
  let latestStates: readonly TrainState[] = [];
  const lineIdOf = (state: TrainState): LineId => state.lineId ?? "MV-LA";
  return {
    update(states) {
      latestStates = states;
      const visible = new Set<string>();
      for (const state of states) {
        const lineId = lineIdOf(state);
        if (!state.position || !visibleLines.has(lineId)) continue;
        const id = `${lineId}:${state.vehicleId}`; visible.add(id);
        let entry = markers.get(id); const content = createContent(state, stations, onSelect);
        if (!entry) { const marker = new api.Marker({ position: state.position, anchor: "center", zIndex: 200, content }); entry = { marker, state }; markers.set(id, entry); map.add(marker); }
        entry.state = state; entry.marker.setPosition(state.position); entry.marker.setContent?.(content);
      }
      for (const [id, entry] of markers) if (!visible.has(id)) { map.remove(entry.marker); markers.delete(id); }
    },
    setLineVisible(lineId, visible) {
      if (visible) visibleLines.add(lineId); else visibleLines.delete(lineId);
      this.update(latestStates);
    },
    destroy() { map.remove([...markers.values()].map((entry) => entry.marker)); markers.clear(); },
  };
}
