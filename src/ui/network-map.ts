import systemMapSvg from "../assets/sample-metro-system-map.svg?raw";
import systemMapData from "../data/system-map.json" with { type: "json" };
import type { LineData, LineId, RouteModel, Station, TrainState } from "../domain/model.ts";
import { formatCountdown } from "./countdown.ts";
import { directionArrow, locationName } from "./location-label.ts";
import { buildSchematicRoute, pointAtSchematicDistance, projectTrainPlacement, type Point, type ProjectedTrainPosition, type SchematicRoute } from "./network-map-projection.ts";

const escape = (value: string): string => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
interface SchematicLayout {
  readonly stationPoints: ReadonlyMap<string, Point>;
  readonly linePaths: ReadonlyMap<LineId, readonly Point[]>;
}
type LayoutMode = "desktop" | "mobile";
const EMBEDDED_MAP_TOP = 0;
const EMBEDDED_MAP_SIZE = { width: systemMapData.width, height: systemMapData.height - EMBEDDED_MAP_TOP };
const distance = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);

export function isNetworkTrainDisplayable(state: TrainState, depotStationIds: ReadonlySet<string>): boolean {
  if (!state.passengerService || state.status === "out-of-service") return false;
  return ![state.locationId, state.nextStationId, state.destinationId].some((locationId) => locationId !== undefined && depotStationIds.has(locationId));
}

function createSchematicLayout(lines: readonly LineData[]): SchematicLayout {
  const stationPoints = new Map<string, Point>();
  const linePaths = new Map<LineId, readonly Point[]>();
  for (const line of lines) {
    const base = systemMapData.routes.find(r => `MV-L${r.number}` === line.lineId)!;
    linePaths.set(line.lineId, base.points);
    for (const station of line.stations) {
      // Match the synthetic base using the sample station name.
      const point = base.stations.find(s => s.zh === station.nameZh);
      if (point) stationPoints.set(station.id, point);
    }
  }
  return { stationPoints, linePaths };
}

export interface NetworkMapOptions {
  readonly routes?: ReadonlyMap<LineId, RouteModel>;
  readonly onTrainSelect?: (state: TrainState, anchor: Point) => void;
  readonly onStationSelect?: (station: Station, anchor: Point) => void;
}

export interface NetworkMapController {
  update(states: readonly TrainState[]): void;
  setVisible(visible: boolean): void;
  setLineVisible(lineId: LineId, visible: boolean): void;
  setNonOperatingStations(stationIds: ReadonlySet<string>): void;
  destroy(): void;
}

const SVG_NS = "http://www.w3.org/2000/svg";

export function createNetworkMap(container: HTMLElement, lines: readonly LineData[], options: NetworkMapOptions = {}): NetworkMapController {
  const visibleLines = new Set<LineId>(["MV-LA", "MV-LB"]);
  const nonOperatingStations = new Set<string>();
  const depotStationIds = new Set(lines.flatMap((line) => line.stations.filter((station) => station.stationType === "depot").map((station) => station.id)));
  const latestStates: TrainState[] = [];
  const trainMarkers = new Map<string, SVGGElement>();
  const schematicRoutes = new Map<LineId, SchematicRoute>();
  const mediaQuery = typeof window.matchMedia === "function" ? window.matchMedia("(max-width: 520px)") : undefined;
  let mode: LayoutMode = mediaQuery?.matches ? "mobile" : "desktop";
  let currentLayout: SchematicLayout | undefined;

  const lineIdOf = (state: TrainState): LineId => state.lineId ?? "MV-LA";
  const trainKey = (state: TrainState): string => `${lineIdOf(state)}:${state.vehicleId}`;
  const stationsById = (): ReadonlyMap<string, Station> => new Map(lines.flatMap((line) => line.stations.map((station) => [station.id, station] as const)));

  const pointForState = (state: TrainState): Point | undefined => {
    return placementForState(state)?.point;
  };

  const placementForState = (state: TrainState): { readonly point: Point; readonly projection?: ProjectedTrainPosition } | undefined => {
    const lineId = lineIdOf(state);
    const route = options.routes?.get(lineId);
    const schematic = schematicRoutes.get(lineId);
    if (route && schematic) return projectTrainPlacement(state, route, schematic);
    const point = state.locationId ? currentLayout?.stationPoints.get(state.locationId) : undefined;
    return point ? { point } : undefined;
  };

  const textForState = (state: TrainState, stations: ReadonlyMap<string, Station>): string => {
    const next = state.nextStationId ? stations.get(state.nextStationId) : undefined;
    if (state.status === "dwelling" && state.departureInSeconds !== undefined) return `发车 ${formatCountdown(state.departureInSeconds)}`;
    if (next && state.etaSeconds !== undefined) return `${next.nameZh} ${formatCountdown(state.etaSeconds)}`;
    if (state.direction && state.destinationId) return `${directionArrow(state.direction)} ${locationName(state.destinationId, [...stations.values()])}`;
    return state.passengerService ? "" : "非载客";
  };

  const updateMarker = (marker: SVGGElement, state: TrainState, point: Point, stations: ReadonlyMap<string, Station>, showLabel: boolean): void => {
    const lineId = lineIdOf(state);
    marker.setAttribute("transform", `translate(${point.x.toFixed(1)} ${point.y.toFixed(1)})`);
    marker.className.baseVal = `network-train${state.status === "moving" ? " moving" : ""}${state.passengerService ? "" : " non-revenue"}`;
    if (showLabel) marker.classList.add("show-label");
    marker.style.setProperty("--line-color", state.lineColor ?? (lineId === "MV-LB" ? "#3B82F6" : "#E54B4B"));
    marker.dataset.lineId = lineId;
    marker.dataset.vehicleId = state.vehicleId;
    marker.dataset.trainKey = trainKey(state);
    const stateSummary = textForState(state, stations);
    marker.setAttribute("aria-label", `查看列车 ${state.tripId ?? state.vehicleId} 状态${stateSummary ? `：${stateSummary}` : ""}`);
    const detail = marker.querySelector<SVGTextElement>(".network-train-detail");
    if (detail) detail.textContent = textForState(state, stations);
    const title = marker.querySelector<SVGTitleElement>("title");
    if (title) title.textContent = `${lineId === "MV-LB" ? "B 线" : "A 线"}${stateSummary ? ` · ${stateSummary}` : ""}`;
  };

  const applyVisibility = (): void => {
    container.querySelectorAll<SVGElement>("[data-line-id]").forEach((element) => { element.style.display = visibleLines.has(element.dataset.lineId as LineId) ? "" : "none"; });
  };

  const updateTrains = (): void => {
    const stations = stationsById();
    const visible = new Set<string>();
    const positioned = latestStates.map((state) => ({ state, placement: placementForState(state) })).filter((item): item is { state: TrainState; placement: { readonly point: Point; readonly projection?: ProjectedTrainPosition } } => item.placement !== undefined && item.state.position !== undefined);
    const groups: { readonly items: { state: TrainState; placement: { readonly point: Point; readonly projection?: ProjectedTrainPosition } }[] }[] = [];
    for (const item of positioned) {
      const group = groups.find((candidate) => candidate.items[0] && lineIdOf(candidate.items[0].state) === lineIdOf(item.state) && distance(candidate.items[0].placement.point, item.placement.point) < 18);
      if (group) group.items.push(item);
      else groups.push({ items: [item] });
    }
    const displayPoints = new Map<string, Point>();
    for (const group of groups) {
      group.items.forEach((item, index) => {
        const projection = item.placement.projection;
        if (!projection || group.items.length === 1) { displayPoints.set(trainKey(item.state), item.placement.point); return; }
        const spacing = Math.min(22, Math.max(12, projection.path.length / 90));
        const offset = (index - (group.items.length - 1) / 2) * spacing;
        displayPoints.set(trainKey(item.state), pointAtSchematicDistance(projection.path.points, projection.distance + offset) ?? item.placement.point);
      });
    }
    for (const state of latestStates) {
      const lineId = lineIdOf(state);
      const placement = placementForState(state);
      const point = placement?.point;
      if (!state.position || !point || !visibleLines.has(lineId)) continue;
      const key = trainKey(state);
      const displayPoint = displayPoints.get(key) ?? point;
      visible.add(key);
      let marker = trainMarkers.get(key);
      if (!marker) {
        marker = document.createElementNS(SVG_NS, "g");
        marker.innerHTML = `<circle class="network-train-dot" r="9"></circle><text class="network-train-detail" y="24" text-anchor="middle"></text><title></title>`;
        marker.setAttribute("tabindex", "0");
        marker.setAttribute("role", "button");
        trainMarkers.set(key, marker);
        container.querySelector<SVGGElement>(".network-trains")?.append(marker);
      }
      const crowdedByTrain = positioned.some((item) => item.state !== state && lineIdOf(item.state) === lineId && distance(item.placement.point, point) < 34);
      const crowdedByStation = [...stations.values()].some((station) => station.lineId === lineId && currentLayout?.stationPoints.get(station.id) && distance(currentLayout.stationPoints.get(station.id)!, point) < 28);
      updateMarker(marker, state, displayPoint, stations, !crowdedByTrain && !crowdedByStation);
    }
    for (const [key, marker] of trainMarkers) {
      if (!visible.has(key)) { marker.remove(); trainMarkers.delete(key); }
    }
  };

  const render = (): void => {
    const layout = createSchematicLayout(lines);
    currentLayout = layout;
    schematicRoutes.clear();
    for (const line of lines) {
      const route = options.routes?.get(line.lineId);
      if (route) schematicRoutes.set(line.lineId, buildSchematicRoute(line, route, layout.stationPoints, layout.linePaths.get(line.lineId) ?? [], new Map()));
    }
    container.innerHTML = `<div class="network-zoom-controls" aria-label="线网图缩放"><button type="button" data-network-zoom="out" aria-label="缩小线网图">−</button><button type="button" data-network-zoom="fit">全图</button><button type="button" data-network-zoom="in" aria-label="放大线网图">＋</button></div><div class="network-canvas">${systemMapSvg}</div></div>`;
    const svg = container.querySelector<SVGSVGElement>('svg')!;
    svg.querySelector('.map-heading')?.remove();
    svg.setAttribute('viewBox', `0 ${EMBEDDED_MAP_TOP} ${EMBEDDED_MAP_SIZE.width} ${EMBEDDED_MAP_SIZE.height}`);
    svg.dataset.layout = mode;
    for (const line of lines) {
      const number = line.lineId.slice(4);
      const baseRoute = svg.querySelector<SVGGElement>(`[data-route="line-${number}"]`);
      if (baseRoute) baseRoute.dataset.lineId = line.lineId;
      svg.querySelectorAll<SVGGElement>(`[data-lines="${number}"]`).forEach(element => { element.dataset.lineId = line.lineId; });
      const group = document.createElementNS(SVG_NS, 'g');
      group.dataset.lineId = line.lineId;
      group.innerHTML = line.stations.filter(station => station.stationType !== 'depot').map(station => {
        const point = layout.stationPoints.get(station.id);
        if (!point) return '';
        return `<g class="network-station network-station-hit${nonOperatingStations.has(station.id) ? ' non-operating' : ''}" data-network-station="${escape(station.id)}" data-line-id="${line.lineId}" tabindex="0" role="button" aria-label="查看${number}号线 ${escape(station.nameZh)}到站信息" transform="translate(${point.x} ${point.y})"><circle class="network-hit-target" r="18"/><title>${escape(station.nameZh)}</title></g>`;
      }).join('');
      svg.append(group);
    }
    const trainGroup = document.createElementNS(SVG_NS, 'g');
    trainGroup.classList.add('network-trains');
    svg.append(trainGroup);
    applyZoom();
    for (const marker of trainMarkers.values()) marker.remove();
    trainMarkers.clear();
    applyVisibility();
    updateTrains();
  };

  let zoom = 1;
  function applyZoom(): void {
    const canvas = container.querySelector<HTMLElement>('.network-canvas');
    if (canvas) canvas.style.width = `${zoom * 100}%`;
  }
  const onInteraction = (event: Event): void => {
    const target = event.target instanceof Element ? event.target : undefined;
    if (!target) return;
    const zoomButton = target.closest<HTMLElement>('[data-network-zoom]');
    if (zoomButton && event.type === 'click') {
      const action = zoomButton.dataset.networkZoom;
      zoom = action === 'fit' ? 1 : Math.max(1, Math.min(5, zoom * (action === 'in' ? 1.5 : 1 / 1.5)));
      applyZoom();
      if (action === 'fit') { container.scrollTop = 0; container.scrollLeft = 0; }
      return;
    }
    const keyboard = event.type === "keydown";
    if (keyboard && event instanceof KeyboardEvent && event.key !== "Enter" && event.key !== " ") return;
    const train = target.closest<SVGGElement>(".network-train");
    if (train) {
      event.preventDefault();
      const state = latestStates.find((candidate) => trainKey(candidate) === train.dataset.trainKey);
      const point = state ? pointForState(state) : undefined;
      if (state && point) options.onTrainSelect?.(state, point);
      return;
    }
    const station = target.closest<SVGGElement>(".network-station");
    if (station) {
      event.preventDefault();
      const item = lines.flatMap((line) => line.stations).find((candidate) => candidate.id === station.dataset.networkStation);
      const point = item ? currentLayout?.stationPoints.get(item.id) : undefined;
      if (item && point) options.onStationSelect?.(item, point);
      return;
    }
  };

  const onMediaChange = (event: MediaQueryListEvent): void => {
    mode = event.matches ? "mobile" : "desktop";
    render();
  };
  container.addEventListener("click", onInteraction);
  container.addEventListener("keydown", onInteraction);
  mediaQuery?.addEventListener("change", onMediaChange);
  render();
  return {
    update(states) { latestStates.splice(0, latestStates.length, ...states.filter((state) => isNetworkTrainDisplayable(state, depotStationIds))); updateTrains(); },
    setVisible(visible) { container.hidden = !visible; },
    setLineVisible(lineId, visible) { if (visible) visibleLines.add(lineId); else visibleLines.delete(lineId); applyVisibility(); updateTrains(); },
    setNonOperatingStations(stationIds) {
      if (stationIds.size === nonOperatingStations.size && [...stationIds].every((stationId) => nonOperatingStations.has(stationId))) return;
      nonOperatingStations.clear(); stationIds.forEach((stationId) => nonOperatingStations.add(stationId)); render();
    },
    destroy() { mediaQuery?.removeEventListener("change", onMediaChange); container.removeEventListener("click", onInteraction); container.removeEventListener("keydown", onInteraction); container.innerHTML = ""; trainMarkers.clear(); },
  };
}
