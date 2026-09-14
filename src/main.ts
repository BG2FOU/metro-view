import "./styles.css";
import "flatpickr/dist/flatpickr.min.css";
import "./legal.css";
import "./improvements.css";
import metroIconUrl from "./assets/icons/metro.svg";
import stationIconUrl from "./assets/icons/station.svg";
import lineARaw from "./data/line-a.geojson?raw";
import lineBRaw from "./data/line-b.geojson?raw";
import { LA_BASE_TIMETABLE } from "./data/la-base-timetable.ts";
import { readRuntimeConfig } from "./config/runtime.ts";
import { buildRoute } from "./domain/geometry.ts";
import { parseLineData } from "./domain/map-data.ts";
import { calculateStationArrivals } from "./domain/station-arrivals.ts";
import {
  SCHEDULE_MODE_STORAGE_KEY,
  isScheduleSelectionMode,
  resolveActiveSchedules,
  resolveScheduleGeneration,
  nonOperatingStationIds,
  type RuntimeScheduleId,
  type ScheduleSelectionMode,
} from "./domain/schedule-selection.ts";
import { serviceDaySecondsAt, type DomainTimetable } from "./domain/timetable.ts";
import { calculateTrainStates } from "./domain/train-state.ts";
import { createBaseLayerController } from "./map/base-layer-control.ts";
import { createRouteLayer } from "./map/route-layer.ts";
import { createStationLayer } from "./map/station-layer.ts";
import { createTrainLayer } from "./map/train-layer.ts";
import { loadAmap } from "./services/amap.ts";
import { readClock } from "./services/clock.ts";
import { SimulationClock } from "./services/simulation-clock.ts";
import { mountDialogControl } from "./ui/dialog-control.ts";
import { mountMapControls, type TrainViewMode } from "./ui/map-controls.ts";
import { mountScheduleControls } from "./ui/schedule-controls.ts";
import { mountSimulationControls } from "./ui/simulation-controls.ts";
import { renderStatusPanel } from "./ui/status-panel.ts";
import { renderStationDetail } from "./ui/station-detail.ts";
import { renderTrainDetail } from "./ui/train-detail.ts";
import { infoWindowFontSize } from "./ui/info-window-scale.ts";

const root = document.querySelector<HTMLElement>("#app");
if (!root) throw new Error("Missing #app root");
root.innerHTML = `<header><div class="brand"><p class="eyebrow">METRO VIEW · 示例 A 线 / B 线</p><h1>Metro View 轨道交通运行图演示</h1></div><nav class="header-actions" aria-label="显示与时间控制"><button type="button" data-dialog-trigger="schedule-dialog" aria-haspopup="dialog" aria-controls="schedule-dialog">运行图</button><button type="button" data-dialog-trigger="map-settings-dialog" aria-haspopup="dialog" aria-controls="map-settings-dialog">地图设置</button><button type="button" data-dialog-trigger="simulation-dialog" aria-haspopup="dialog" aria-controls="simulation-dialog">时间控制</button></nav><div class="disclaimer"><b>模拟位置</b><span>非 GPS 实时位置 · 非运营方实时数据</span><small id="clock-source">正在校时</small></div></header><dialog id="schedule-dialog" class="control-dialog schedule-dialog" aria-labelledby="schedule-title"><section class="dialog-card"><div class="dialog-heading"><h2 id="schedule-title">运行图切换</h2><button type="button" data-close-dialog aria-label="关闭运行图切换">×</button></div><div id="schedule-controls" class="schedule-controls" aria-label="运行图切换设置"></div></section></dialog><dialog id="map-settings-dialog" class="control-dialog map-dialog" aria-labelledby="map-settings-title"><section class="dialog-card"><div class="dialog-heading"><h2 id="map-settings-title">地图与列车显示</h2><button type="button" data-close-dialog aria-label="关闭地图设置">×</button></div><div id="map-controls" class="map-toolbar" aria-label="地图显示设置"><p class="dialog-loading">正在加载地图设置…</p></div></section></dialog><dialog id="simulation-dialog" class="control-dialog simulation-dialog" aria-labelledby="simulation-title"><section class="dialog-card"><div class="dialog-heading"><h2 id="simulation-title">时间与模拟控制</h2><button type="button" data-close-dialog aria-label="关闭时间控制">×</button></div><div id="simulation" class="controls" aria-label="模拟控制"></div></section></dialog><main class="layout"><section class="map-card"><div id="map" aria-label="示例 A 线与 B 线地图"><div class="map-loading">正在加载地图…</div></div><div class="site-watermark" aria-hidden="true">© BG2FOU</div><details class="route-legend-module"><summary>图例</summary><div class="route-legend" aria-label="图例"><span><i class="line-a" aria-hidden="true"></i>示例 A 线</span><span><i class="line-b" aria-hidden="true"></i>示例 B 线</span><span><i class="elevated" aria-hidden="true"></i>高架段</span><span><i class="underground" aria-hidden="true"></i>隧道段</span><span><img src="${stationIconUrl}" alt="" aria-hidden="true">车站</span><span><img src="${metroIconUrl}" alt="" aria-hidden="true">列车</span></div></details><div id="map-error" class="map-error" hidden></div></section><aside id="side-dock" class="side-dock" hidden><section id="status-panel" class="panel"><h2>列车状态</h2><div id="status" class="states" aria-live="polite"></div></section></aside></main><footer><span class="footer-version">合成线路数据 · 示例运行图正在加载 · Asia/Shanghai</span><p class="legal">COPYRIGHT © <a href="https://github.com/BG2FOU" target="_blank" rel="noopener noreferrer"><strong>BG2FOU</strong></a></p></footer>`;

const dialogDisposers = [
  ["schedule-dialog", "schedule-dialog"],
  ["map-settings-dialog", "map-settings-dialog"],
  ["simulation-dialog", "simulation-dialog"],
].map(([dialogId, triggerId]) => mountDialogControl(
  document.querySelector<HTMLDialogElement>(`#${dialogId}`)!,
  document.querySelector<HTMLButtonElement>(`[data-dialog-trigger="${triggerId}"]`)!,
));

const lineA = parseLineData(JSON.parse(lineARaw), "MV-LA");
const lineB = parseLineData(JSON.parse(lineBRaw), "MV-LB");
const allStations = [...lineA.stations, ...lineB.stations];
const lineARoute = buildRoute(lineA);
const lineBRoute = buildRoute(lineB);
const emptyTimetable: DomainTimetable = { trips: [], circulations: [], conventions: { serviceDayRollover: "03:00:00" } };
const timetableCache = new Map<RuntimeScheduleId, DomainTimetable>([["LA-BASE", LA_BASE_TIMETABLE as unknown as DomainTimetable]]);
const timetableLoads = new Map<RuntimeScheduleId, Promise<DomainTimetable>>();
let lineATimetable = timetableCache.get("LA-BASE")!;
let lineBTimetable = emptyTimetable;
const runtime = readRuntimeConfig({
  ...import.meta.env,
  ...(!import.meta.env.PROD && __METRO_VIEW_LOCAL_AMAP_KEY__ ? { VITE_AMAP_API_KEY: __METRO_VIEW_LOCAL_AMAP_KEY__ } : {}),
  ...(!import.meta.env.PROD && __METRO_VIEW_LOCAL_AMAP_SECURITY_JS_CODE__ ? { AMAP_SECURITY_JS_CODE: __METRO_VIEW_LOCAL_AMAP_SECURITY_JS_CODE__ } : {}),
});
let clockOffset = 0;
const clock = new SimulationClock(() => Date.now() + clockOffset);
const readScheduleMode = (): ScheduleSelectionMode => {
  try {
    const value = window.localStorage.getItem(SCHEDULE_MODE_STORAGE_KEY);
    return isScheduleSelectionMode(value) ? value : "auto";
  } catch {
    return "auto";
  }
};
const saveScheduleMode = (mode: ScheduleSelectionMode): void => {
  try { window.localStorage.setItem(SCHEDULE_MODE_STORAGE_KEY, mode); } catch { /* Storage can be unavailable in privacy modes. */ }
};
let scheduleMode = readScheduleMode();
const status = document.querySelector<HTMLElement>("#status")!;
const sideDock = document.querySelector<HTMLElement>("#side-dock")!;
const layout = document.querySelector<HTMLElement>(".layout")!;
let trainViewMode: TrainViewMode = "popup";
let latestStates: ReturnType<typeof calculateTrainStates> = [];
let latestDaySeconds = 0;
let updateMap: ((states: ReturnType<typeof calculateTrainStates>) => void) | undefined;
let refreshSelectedTrain: ((states: ReturnType<typeof calculateTrainStates>) => void) | undefined;
let updateStationServiceStatus: ((stationIds: ReadonlySet<string>) => void) | undefined;

async function loadRuntimeTimetable(scheduleId: RuntimeScheduleId): Promise<DomainTimetable> {
  switch (scheduleId) {
    case "LA-BASE": return LA_BASE_TIMETABLE as unknown as DomainTimetable;
    case "LA-NEXT": return (await import("./data/runtime/la-next.json")).default as unknown as DomainTimetable;
    case "LB-WEEKDAY-BASE": return (await import("./data/runtime/lb-weekday-base.json")).default as unknown as DomainTimetable;
    case "LB-WEEKDAY-NEXT": return (await import("./data/runtime/lb-weekday-next.json")).default as unknown as DomainTimetable;
    case "LB-WEEKEND-BASE": return (await import("./data/runtime/lb-weekend-base.json")).default as unknown as DomainTimetable;
    case "LB-WEEKEND-NEXT": return (await import("./data/runtime/lb-weekend-next.json")).default as unknown as DomainTimetable;
  }
}

function ensureTimetable(scheduleId: RuntimeScheduleId): void {
  if (timetableCache.has(scheduleId) || timetableLoads.has(scheduleId)) return;
  const load = loadRuntimeTimetable(scheduleId)
    .then((timetable) => {
      timetableCache.set(scheduleId, timetable);
      timetableLoads.delete(scheduleId);
      update();
      return timetable;
    })
    .catch((error: unknown) => {
      timetableLoads.delete(scheduleId);
      console.error(`Unable to load ${scheduleId} runtime timetable`, error);
      throw error;
    });
  timetableLoads.set(scheduleId, load);
  void load.catch(() => undefined);
}

const scheduleControls = mountScheduleControls(
  document.querySelector<HTMLElement>("#schedule-controls")!,
  scheduleMode,
  (mode) => {
    scheduleMode = mode;
    saveScheduleMode(mode);
    update();
  },
);

function update(): void {
  const now = clock.snapshot().now;
  const daySeconds = serviceDaySecondsAt(now);
  const schedules = resolveActiveSchedules(scheduleMode, now);
  lineATimetable = timetableCache.get(schedules.lineA) ?? emptyTimetable;
  lineBTimetable = timetableCache.get(schedules.lineB) ?? emptyTimetable;
  ensureTimetable(schedules.lineA);
  ensureTimetable(schedules.lineB);
  scheduleControls.update(scheduleMode, schedules);
  updateStationServiceStatus?.(nonOperatingStationIds(schedules));
  const footerVersion = document.querySelector<HTMLElement>(".footer-version");
  if (footerVersion) footerVersion.textContent = `合成线路数据 · 运行图 ${schedules.lineA}/${schedules.lineB} · Asia/Shanghai`;
  latestDaySeconds = daySeconds;
  latestStates = [
    ...calculateTrainStates(daySeconds, lineATimetable, lineARoute, "MV-LA", "#E54B4B"),
    ...calculateTrainStates(daySeconds, lineBTimetable, lineBRoute, "MV-LB", "#3B82F6"),
  ];
  renderStatusPanel(status, latestStates, allStations);
  updateMap?.(latestStates);
  refreshSelectedTrain?.(latestStates);
}

const destroySimulationControls = mountSimulationControls(
  document.querySelector<HTMLElement>("#simulation")!,
  clock,
  update,
  (now) => resolveScheduleGeneration(scheduleMode, now),
);
update();
const timer = window.setInterval(update, 1_000);

async function synchronizeClock(): Promise<void> {
  const reading = await readClock({ ...(runtime.timeApiUrl ? { timeApiUrl: runtime.timeApiUrl } : {}) });
  clockOffset = reading.now.getTime() - Date.now();
  const source = document.querySelector<HTMLElement>("#clock-source");
  if (source) source.textContent = reading.source === "json-api" ? "时间源：远程校时" : reading.source === "http-date" ? "时间源：站点 HTTP Date" : "时间源：设备时间（降级）";
  update();
}
void synchronizeClock();
const syncTimer = window.setInterval(() => void synchronizeClock(), 300_000);
const onVisibility = () => { if (document.visibilityState === "visible") void synchronizeClock(); };
document.addEventListener("visibilitychange", onVisibility);

const mapError = document.querySelector<HTMLElement>("#map-error")!;
const describeError = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") return error.message;
  return "未知错误";
};
loadAmap(runtime).then((api) => {
  const mapElement = document.querySelector<HTMLElement>("#map")!;
  const map = new api.Map(mapElement, { zoom: 11, center: [120.024, 30.01], viewMode: "2D", resizeEnable: true });
  const syncInfoWindowScale = () => { const zoom = map.getZoom?.() ?? 11; mapElement.dataset.mapZoom = String(zoom); mapElement.style.setProperty("--map-info-font-size", `${infoWindowFontSize(zoom).toFixed(2)}px`); };
  const setTestZoom = (event: Event) => { if (!import.meta.env.PROD && event instanceof CustomEvent && typeof event.detail === "number") map.setZoom?.(event.detail); };
  map.on?.("zoomchange", syncInfoWindowScale);
  if (!import.meta.env.PROD) mapElement.addEventListener("metro-view:set-test-zoom", setTestZoom);
  syncInfoWindowScale();
  const baseLayers = createBaseLayerController(api, map);
  const routeLayers = [createRouteLayer(api, map, lineA), createRouteLayer(api, map, lineB)];
  const infoWindow = new api.InfoWindow({ closeWhenClickMap: true, offset: [0, -18] });
  const trainKey = (state: (typeof latestStates)[number]): string => `${state.lineId ?? "MV-LA"}:${state.vehicleId}`;
  const stationTimetable = (station: (typeof allStations)[number]): DomainTimetable => station.lineId === "MV-LB" ? lineBTimetable : lineATimetable;
  let selectedTrainKey: string | undefined;
  let selectedStationId: string | undefined;
  const showTrain = (state: (typeof latestStates)[number]): void => {
    selectedTrainKey = trainKey(state);
    selectedStationId = undefined;
    if (trainViewMode === "sidebar") {
      document.querySelector<HTMLElement>(`[data-train-key="${trainKey(state)}"]`)?.focus();
      return;
    }
    if (!state.position) return;
    infoWindow.setContent(renderTrainDetail(state, allStations));
    infoWindow.open(map, state.position);
  };
  const showStation = (station: (typeof allStations)[number]): void => {
    selectedTrainKey = undefined;
    selectedStationId = station.id;
    infoWindow.setContent(renderStationDetail(station, calculateStationArrivals(latestDaySeconds, station.id, stationTimetable(station)), allStations));
    infoWindow.open(map, station.coordinates);
  };
  const showTestStation = (event: Event): void => {
    if (import.meta.env.PROD || !(event instanceof CustomEvent) || typeof event.detail !== "string") return;
    const station = allStations.find((candidate) => candidate.id === event.detail);
    if (station) showStation(station);
  };
  if (!import.meta.env.PROD) mapElement.addEventListener("metro-view:show-station", showTestStation);
  const stationLayers = [createStationLayer(api, map, lineA, showStation), createStationLayer(api, map, lineB, showStation)];
  updateStationServiceStatus = (stationIds) => stationLayers.forEach((layer) => layer.setNonOperatingStations(stationIds));
  const trains = createTrainLayer(api, map, showTrain, allStations);
  const setTrainViewMode = (mode: TrainViewMode): void => {
    trainViewMode = mode;
    const sidebar = mode === "sidebar";
    sideDock.hidden = !sidebar;
    layout.classList.toggle("sidebar-open", sidebar);
    if (sidebar) infoWindow.close();
  };
  const setLineVisible = (lineId: "MV-LA" | "MV-LB", visible: boolean): void => {
    const index = lineId === "MV-LA" ? 0 : 1;
    routeLayers[index]?.setVisible(visible);
    stationLayers[index]?.setVisible(visible);
    trains.setLineVisible(lineId, visible);
  };
  const destroyMapControls = mountMapControls(document.querySelector<HTMLElement>("#map-controls")!, baseLayers, setTrainViewMode, setLineVisible);
  updateMap = (states) => trains.update(states);
  refreshSelectedTrain = (states) => {
    if (selectedStationId) {
      const station = allStations.find((candidate) => candidate.id === selectedStationId);
      if (station) infoWindow.setContent(renderStationDetail(station, calculateStationArrivals(latestDaySeconds, station.id, stationTimetable(station)), allStations));
      return;
    }
    if (trainViewMode !== "popup" || !selectedTrainKey) return;
    const state = states.find((candidate) => trainKey(candidate) === selectedTrainKey);
    if (state?.position) infoWindow.setContent(renderTrainDetail(state, allStations));
    else { selectedTrainKey = undefined; infoWindow.close(); }
  };
  update();
  map.setFitView(stationLayers.flatMap((layer) => [...layer.overlays]));
  document.querySelector<HTMLElement>(".map-loading")?.remove();
  window.addEventListener("pagehide", () => { updateStationServiceStatus = undefined; destroyMapControls(); infoWindow.close(); trains.destroy(); stationLayers.forEach((layer) => layer.destroy()); routeLayers.forEach((destroy) => destroy()); map.off?.("zoomchange", syncInfoWindowScale); mapElement.removeEventListener("metro-view:set-test-zoom", setTestZoom); mapElement.removeEventListener("metro-view:show-station", showTestStation); map.destroy(); }, { once: true });
}).catch((error: unknown) => {
  document.querySelector<HTMLElement>(".map-loading")?.remove();
  const mapControls = document.querySelector<HTMLElement>("#map-controls");
  if (mapControls) mapControls.innerHTML = `<p class="dialog-error">地图暂不可用，无法调整底图与列车显示。</p>`;
  mapError.hidden = false;
  mapError.textContent = `地图暂不可用：${describeError(error)}。时间模拟和列车推演仍可使用。`;
});

window.addEventListener("pagehide", () => {
  window.clearInterval(timer);
  window.clearInterval(syncTimer);
  document.removeEventListener("visibilitychange", onVisibility);
  dialogDisposers.forEach((dispose) => dispose());
  scheduleControls.destroy();
  destroySimulationControls();
}, { once: true });
