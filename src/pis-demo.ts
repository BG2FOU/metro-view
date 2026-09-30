import "./pis-demo.css";
import type { LineData, Station, TrainState } from "./domain/model.ts";
import type { DomainTimetable } from "./domain/timetable.ts";
import { renderPisTrain } from "./ui/pis-screen.ts";

type LineNumber = "A" | "B";
type DisplayMode = "A" | "B";
type Screen = "station" | "train";
interface DemoStop {
  zh: string;
  en: string;
  transfer?: readonly string[];
  minutes?: number;
}
interface DemoLine {
  color: string;
  station: { zh: string; en: string };
  schedule: string;
  downTerminal: string;
  upTerminal: string;
  down: readonly { trip: string; destination: string; en: string; seconds: number }[];
  up: readonly { trip: string; destination: string; en: string; seconds: number }[];
  train: {
    current: string;
    next: string;
    destination: string;
    destinationEn: string;
    estimateLabel: string;
    estimateIn: string;
    vehicle: string;
    trip: string;
    status: string;
    currentIndex: number;
    stops: readonly DemoStop[];
  };
}

const lines: Record<LineNumber, DemoLine> = {
  "A": {
    "color": "#E54B4B",
    "station": {
      "zh": "中央站",
      "en": "Central"
    },
    "schedule": "LA-NEXT",
    "downTerminal": "远航站",
    "upTerminal": "晨曦站",
    "down": [
      {
        "trip": "DEMO-D01",
        "destination": "远航站",
        "en": "Voyage",
        "seconds": 80
      }
    ],
    "up": [
      {
        "trip": "DEMO-U01",
        "destination": "晨曦站",
        "en": "Dawn",
        "seconds": 225
      }
    ],
    "train": {
      "current": "滨河站",
      "next": "中央站",
      "destination": "晨曦站",
      "destinationEn": "Dawn",
      "estimateLabel": "预计到达",
      "estimateIn": "1分30秒",
      "vehicle": "DEMO-01",
      "trip": "DEMO-U01",
      "status": "运行中",
      "currentIndex": 1,
      "stops": [
        {
          "zh": "远航站",
          "en": "Voyage"
        },
        {
          "zh": "滨河站",
          "en": "Riverside"
        },
        {
          "zh": "中央站",
          "en": "Central"
        },
        {
          "zh": "博览站（预留）",
          "en": "Museum (Reserved)"
        },
        {
          "zh": "晨曦站",
          "en": "Dawn"
        }
      ]
    }
  },
  "B": {
    "color": "#3B82F6",
    "station": {
      "zh": "星河站",
      "en": "Galaxy"
    },
    "schedule": "LB-WEEKDAY-NEXT",
    "downTerminal": "云谷东站",
    "upTerminal": "新城西站",
    "down": [
      {
        "trip": "DEMO-D01",
        "destination": "云谷东站",
        "en": "Cloud Valley East",
        "seconds": 80
      }
    ],
    "up": [
      {
        "trip": "DEMO-U01",
        "destination": "新城西站",
        "en": "New Town West",
        "seconds": 225
      }
    ],
    "train": {
      "current": "科创园站",
      "next": "星河站",
      "destination": "新城西站",
      "destinationEn": "New Town West",
      "estimateLabel": "预计到达",
      "estimateIn": "1分30秒",
      "vehicle": "DEMO-01",
      "trip": "DEMO-U01",
      "status": "运行中",
      "currentIndex": 1,
      "stops": [
        {
          "zh": "云谷东站",
          "en": "Cloud Valley East"
        },
        {
          "zh": "科创园站",
          "en": "Innovation Park"
        },
        {
          "zh": "星河站",
          "en": "Galaxy"
        },
        {
          "zh": "青禾站",
          "en": "Greenfield"
        },
        {
          "zh": "新城西站",
          "en": "New Town West"
        }
      ]
    }
  }
};

const transferIds: Record<string, string> = { "中央站": "a-central", "星河站": "b-central" };
const escape = (value: string): string => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const app = document.querySelector<HTMLElement>("#pis-demo");
if (!app) throw new Error("Missing PIS demo root");

app.innerHTML = `
  <main class="demo-shell">
    <header class="demo-header">
      <div class="demo-brand"><strong>METRO VIEW PIS</strong><small>Passenger Information System · 视觉演示</small></div>
      <a href="./index.html">返回地图</a>
    </header>
    <section class="demo-intro">
      <span class="demo-eyebrow">视觉评审稿 · 仅使用示意时刻</span>
      <h1>车站屏与列车屏</h1>
      <p>使用合成数据展示普通站、换乘站的运行中与即将到站画面。此页使用示意时刻，与主地图共用列车屏渲染。</p>
    </section>
    <section class="demo-stage" aria-label="PIS 演示舞台">
      <div class="demo-map-line"><span></span><span></span><span></span><span></span><span></span></div>
      <div class="demo-stage-card"><span>METRO VIEW · PIS REVIEW</span><h2>两套信息屏，四种预览状态</h2><p>模式 A · 实际地图　/　模式 B · 线网拓扑图</p><button type="button" data-open-demo>打开演示弹窗 <b aria-hidden="true">↗</b></button></div>
    </section>
  </main>
  <dialog class="demo-dialog" aria-label="PIS 视觉演示">
    <div class="demo-dialog-shell">
      <div class="demo-review-bar">
        <div class="demo-review-title"><b>视觉演示</b><small>数据仅用于版式评审</small></div>
        <div class="demo-switches" role="group" aria-label="演示选项">
          <span class="demo-mode-label"></span><span class="demo-divider"></span>
          <button type="button" data-demo-line="A">A 线</button><button type="button" data-demo-line="B">B 线</button>
          <span class="demo-divider"></span>
          <button type="button" data-demo-screen="station">车站屏</button><button type="button" data-demo-screen="train">列车屏</button>
        </div>
        <button type="button" class="demo-close" data-close-demo aria-label="关闭演示">×</button>
      </div>
      <div class="demo-train-options demo-switches" role="group" aria-label="列车状态预览" hidden>
        <button type="button" data-demo-stop="ordinary">普通站</button><button type="button" data-demo-stop="transfer">换乘站</button>
        <span class="demo-divider"></span>
        <button type="button" data-demo-phase="moving">运行中</button><button type="button" data-demo-phase="approaching">到站前30秒</button><button type="button" data-demo-phase="dwelling">停站中</button>
        <button type="button" data-demo-direction="up">上行</button><button type="button" data-demo-direction="down">下行</button>
      </div>
      <div class="demo-screen-host"></div>
    </div>
  </dialog>
`;

const dialog = app.querySelector<HTMLDialogElement>(".demo-dialog")!;
const host = app.querySelector<HTMLElement>(".demo-screen-host")!;
const mode: DisplayMode = new URLSearchParams(location.search).get("mode") === "B" ? "B" : "A";
let line: LineNumber = "A";
let screen: Screen = new URLSearchParams(location.search).get("screen") === "train" ? "train" : "station";
let stopType: "ordinary" | "transfer" = "ordinary";
let phase: "moving" | "approaching" | "dwelling" = "moving";
let direction: "up" | "down" = "up";

function clockMarkup(schedule: string): string {
  return `<aside class="pis-clock"><time datetime="2030-01-02">2030-01-02</time><span class="pis-weekday">星期三 <small>Wednesday</small></span><strong>10:16</strong>${mode === "A" ? `<span class="pis-schedule">运行图 <b>${schedule}</b></span>` : ""}</aside>`;
}

function arrivalMarkup(item: DemoLine["down"][number], index: number): string {
  const minutes = Math.floor(item.seconds / 60);
  const seconds = item.seconds % 60;
  const eta = mode === "A"
    ? `<span class="pis-eta-precise"><b>${minutes}</b><small>分</small><b>${String(seconds).padStart(2, "0")}</b><small>秒</small></span>`
    : `<span class="pis-minutes"><b>${Math.round(item.seconds / 60)}</b><small>分钟<br>min</small></span>`;
  return `<div class="pis-arrival-row ${mode === "A" ? "has-trip" : ""}">${mode === "A" ? `<span class="pis-trip"><small>车次</small><b>${item.trip}</b></span>` : ""}<span class="pis-arrival-label">${index === 0 ? "开往" : "下一趟开往"}<small>${index === 0 ? "Bound for" : "Next train"}</small></span><span class="pis-destination"><b>${escape(item.destination)}</b><small>${escape(item.en)}</small></span>${eta}</div>`;
}

function stationBoard(data: DemoLine, direction: "down" | "up"): string {
  const bound = direction === "down" ? data.downTerminal : data.upTerminal;
  const arrivals = direction === "down" ? data.down : data.up;
  return `<section class="pis-station-board" aria-label="${direction === "down" ? "下行" : "上行"}方向屏" style="--pis-line:${data.color}">
    ${clockMarkup(data.schedule)}
    <div class="pis-station-main">
      <div class="pis-station-heading"><span class="pis-direction">${direction === "down" ? "◀" : "▶"} <span>开往${escape(bound)}方向</span></span><span class="pis-line-chip">${line} 线 <small>Line ${line}</small></span><span class="pis-station-name"><b>${escape(data.station.zh)}</b><small>${escape(data.station.en)}</small></span></div>
      <div class="pis-arrival-list">${arrivals.map(arrivalMarkup).join("")}</div>
      <div class="pis-station-notice">请在安全线内候车 <span>·</span> Please stand behind the safety line</div>
    </div>
  </section>`;
}

function renderStation(data: DemoLine): string {
  return `<article class="pis-station-system" aria-label="${line} 线${escape(data.station.zh)}车站信息显示系统">${stationBoard(data, "down")}${stationBoard(data, "up")}</article>`;
}

function renderTrain(data: DemoLine): string {
  const train = data.train;
  const targetIndex = stopType === "transfer" ? 2 : 1;
  const eta = phase === "moving" ? 90 : phase === "approaching" ? 30 : 0;
  const now = 10 * 3600;
  const stations: Station[] = train.stops.map((stop, index) => ({
    id: transferIds[stop.zh] ?? `demo-${line}-${index}`, nameZh: stop.zh, nameEn: stop.en,
    sequence: index, stationType: "operational", structureType: "underground", coordinates: [0, 0],
  }));
  const time = (seconds: number): string => `${String(Math.floor(seconds / 3600)).padStart(2, "0")}:${String(Math.floor(seconds / 60) % 60).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  const trip: DomainTimetable["trips"][number] = {
    tripId: train.trip, vehicleId: train.vehicle, circulationId: "demo", direction, classification: "revenue",
    events: stations.map((station, index) => {
      const arrival = now + eta + (index - targetIndex) * (direction === "up" ? 180 : -180);
      return { locationId: station.id, arrival: time(arrival), departure: time(arrival + 45) };
    }),
  };
  const route: LineData = { lineId: line === "A" ? "MV-LA" : "MV-LB", lineColor: data.color, stations: [...stations].reverse(), parts: [] };
  const state: TrainState = {
    lineId: route.lineId, lineColor: data.color, vehicleId: train.vehicle, circulationId: "demo", tripId: train.trip,
    status: phase === "dwelling" ? "dwelling" : "moving", direction, passengerService: true,
    destinationId: (direction === "up" ? stations.at(-1) : stations[0])!.id,
    ...(phase === "dwelling" ? { locationId: stations[targetIndex]!.id, departureInSeconds: 45 } : { nextStationId: stations[targetIndex]!.id, etaSeconds: eta }),
  };
  return renderPisTrain(state, route, { trips: [trip], circulations: [] }, stations, mode, now, new Set());
}

function render(): void {
  const data = lines[line];
  app!.querySelector<HTMLElement>(".demo-train-options")!.hidden = screen !== "train";
  for (const [key, value] of [["stop", stopType], ["phase", phase], ["direction", direction]]) {
    app!.querySelectorAll<HTMLButtonElement>(`[data-demo-${key}]`).forEach((button) => button.setAttribute("aria-pressed", String(button.getAttribute(`data-demo-${key}`) === value)));
  }
  host.innerHTML = screen === "station" ? renderStation(data) : renderTrain(data);
  app!.querySelector<HTMLElement>(".demo-mode-label")!.textContent = mode === "A" ? "实际地图内容预览" : "线网图内容预览";
  app!.querySelectorAll<HTMLButtonElement>("[data-demo-line]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.demoLine === line)));
  app!.querySelectorAll<HTMLButtonElement>("[data-demo-screen]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.demoScreen === screen)));
}

app.addEventListener("click", (event) => {
  const target = event.target instanceof Element ? event.target : null;
  if (!target) return;
  if (target.closest("[data-close-demo]") || target === dialog) { dialog.close(); return; }
  if (target.closest("[data-open-demo]")) { render(); dialog.showModal(); return; }
  const lineButton = target.closest<HTMLElement>("[data-demo-line]");
  const screenButton = target.closest<HTMLElement>("[data-demo-screen]");
  if (lineButton) line = lineButton.dataset.demoLine as LineNumber;
  if (screenButton) screen = screenButton.dataset.demoScreen as Screen;
  const stopButton = target.closest<HTMLElement>("[data-demo-stop]");
  const phaseButton = target.closest<HTMLElement>("[data-demo-phase]");
  const directionButton = target.closest<HTMLElement>("[data-demo-direction]");
  if (stopButton) stopType = stopButton.dataset.demoStop as typeof stopType;
  if (phaseButton) phase = phaseButton.dataset.demoPhase as typeof phase;
  if (directionButton) direction = directionButton.dataset.demoDirection as typeof direction;
  if (lineButton || screenButton || stopButton || phaseButton || directionButton) render();
});

render();
dialog.showModal();
