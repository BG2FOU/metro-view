import type { LineData, Station, TrainState } from "../domain/model.ts";
import type { StationArrival, StationArrivalBoard } from "../domain/station-arrivals.ts";
import { eventTimes, serviceDaySeconds, serviceSeconds, type DomainTimetable } from "../domain/timetable.ts";
import { locationName, stationDisplayName } from "./location-label.ts";
import { isReservedDisplayStation } from "./station-display.ts";

export type PisMode = "A" | "B";
const escape = (value: string): string => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const transferColors: Record<string, string> = { A: "#E54B4B", B: "#3B82F6" };
const transfers: Record<string, readonly string[]> = { "a-central": ["B"], "b-central": ["A"] };
const statuses: Record<TrainState["status"], string> = {
  waiting: "等待上线", moving: "运行中", dwelling: "停站中", turning: "折返中",
  standby: "备用", "out-of-service": "已下线",
};
const lineNumber = (lineId: string | undefined): "A" | "B" => lineId === "MV-LB" ? "B" : "A";
const lineColor = (number: "A" | "B"): string => number === "B" ? "#3B82F6" : "#E54B4B";
const lineTerminal = (number: "A" | "B", direction: "up" | "down"): string =>
  number === "A" ? direction === "up" ? "晨曦站" : "远航站" : direction === "up" ? "新城西站" : "云谷东站";
const stationEnglish = (id: string, stations: readonly Station[]): string => stations.find((station) => station.id === id)?.nameEn ?? "";
const datePart = (parts: Intl.DateTimeFormatPart[], type: string): string => parts.find((part) => part.type === type)?.value ?? "";
const countdown = (total: number): string => `${Math.floor(Math.max(0, total) / 60)}分${String(Math.max(0, total) % 60).padStart(2, "0")}秒`;

function clock(now: Date, schedule: string, mode: PisMode): string {
  const date = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit", weekday: "long", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const weekdayZh = new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", weekday: "long" }).format(now);
  const iso = `${datePart(date, "year")}-${datePart(date, "month")}-${datePart(date, "day")}`;
  const time = `${datePart(date, "hour")}:${datePart(date, "minute")}`;
  return `<aside class="pis-clock"><time datetime="${iso}">${iso}</time><span class="pis-weekday">${escape(weekdayZh)} <small>${escape(datePart(date, "weekday"))}</small></span><strong>${time}</strong>${mode === "A" ? `<span class="pis-schedule">运行图 <b>${escape(schedule)}</b></span>` : ""}</aside>`;
}

function arrival(item: StationArrival | undefined, index: number, mode: PisMode, stations: readonly Station[]): string {
  const destination = item ? locationName(item.destinationId, stations) : "--";
  const english = item ? stationEnglish(item.destinationId, stations) : "";
  const imminentArrival = item?.kind === "arrival" && (item.departureInSeconds !== undefined || item.etaSeconds <= 20);
  const departureCountdown = mode === "A" && item?.departureInSeconds !== undefined;
  const seconds = departureCountdown ? (item?.departureInSeconds ?? 0) : (item?.etaSeconds ?? 0);
  const precise = `<span class="pis-eta-precise"><b>${Math.floor(seconds / 60)}</b><small>分</small><b>${String(seconds % 60).padStart(2, "0")}</b><small>秒</small></span>`;
  const count = item?.kind === "pass" ? `<span class="pis-arrival-message">列车跳停</span>`
    : departureCountdown ? `<span class="pis-departure-countdown"><small>即将发车</small>${precise}</span>`
    : imminentArrival ? `<span class="pis-arrival-message">即将进站</span>`
    : item ? mode === "A" ? precise : `<span class="pis-minutes"><b>${Math.round(item.etaSeconds / 60)}</b><small>分钟<br>min</small></span>`
    : `<span class="pis-arrival-message">--</span>`;
  return `<div class="pis-arrival-row${mode === "A" ? " has-trip" : ""}">${mode === "A" ? `<span class="pis-trip"><small>车次</small><b>${escape(item?.tripId ?? "--")}</b></span>` : ""}<span class="pis-arrival-label">${index === 0 ? "开往" : "下一趟开往"}<small>${index === 0 ? "Bound for" : "Next train"}</small></span><span class="pis-destination"><b>${escape(destination)}</b><small>${escape(english)}</small></span>${count}</div>`;
}

export function renderPisStation(station: Station, board: StationArrivalBoard, stations: readonly Station[], mode: PisMode, schedule: string, now: Date): string {
  const number = lineNumber(station.lineId);
  const notice = isReservedDisplayStation(station) ? "预留点 · 列车不停靠" : station.stationType === "depot" ? "车辆段 · 非运营" : "请在安全线内候车 · Please stand behind the safety line";
  const direction = (way: "down" | "up"): string => `<section class="pis-station-board" aria-label="${way === "down" ? "下行" : "上行"}方向屏" style="--pis-line:${lineColor(number)}">
    ${clock(now, schedule, mode)}
    <div class="pis-station-main">
      <div class="pis-station-heading"><span class="pis-direction">${way === "down" ? "◀" : "▶"} <span>开往${lineTerminal(number, way)}方向</span></span><span class="pis-line-chip">${number} 线 <small>Line ${number}</small></span><span class="pis-station-name"><b>${escape(stationDisplayName(station))}</b><small>${escape(station.nameEn)}</small></span></div>
      <div class="pis-arrival-list">${[board[way][0], board[way][1]].map((item, index) => arrival(item, index, mode, stations)).join("")}</div>
      <div class="pis-station-notice">${escape(notice)}</div>
    </div>
  </section>`;
  return `<article class="pis-station-system" aria-label="${number} 线${escape(stationDisplayName(station))}车站信息显示系统">${direction("down")}${direction("up")}</article>`;
}

function transferMark(numbers: readonly string[], past: boolean, color: string): string {
  const a = past ? "#AAB3BE" : transferColors[numbers[0]!] ?? color;
  const b = past ? "#AAB3BE" : transferColors[numbers[1]!] ?? a;
  const current = past ? "#AAB3BE" : color;
  return `<svg class="pis-transfer-ring" viewBox="2.25 2.25 43.5 43.5" aria-hidden="true"><circle cx="24" cy="24" r="20" fill="#fff" stroke="${a}" stroke-width="3.5"/><path d="M24 4 A20 20 0 0 1 24 44" fill="none" stroke="${b}" stroke-width="3.5"/><g class="pis-transfer-inner-arrows"><g fill="${current}" stroke="${current}"><path d="M12 21 A12.4 12.4 0 0 1 33 15" fill="none" stroke-width="3"/><path d="M28 15 36 19 35 10Z" stroke="none"/></g><g fill="${a}" stroke="${a}"><path d="M36 27 A12.4 12.4 0 0 1 15 33" fill="none" stroke-width="3"/><path d="M20 33 12 29 13 38Z" stroke="none"/></g></g></svg>`;
}

function routeStations(state: TrainState, line: LineData, timetable: DomainTimetable, mode: PisMode, nonOperating: ReadonlySet<string>): readonly Station[] {
  const trip = timetable.trips.find((item) => item.tripId === state.tripId);
  if (mode === "A" && trip && !state.passengerService) {
    const byId = new Map(line.stations.map((station) => [station.id, station]));
    const timed = trip.events.flatMap((event) => eventTimes(event, timetable).map((time) => ({ locationId: event.locationId, seconds: time.seconds }))).sort((a, b) => a.seconds - b.seconds);
    const originId = timed[0]?.locationId;
    const terminalId = timed.at(-1)?.locationId;
    const events = trip.events
      .filter((event) => event.arrival || event.departure || event.boundaryTime || event.locationId === originId || event.locationId === terminalId)
      .map((event) => byId.get(event.locationId))
      .filter((station): station is Station => !!station);
    const mainline = [...line.stations].filter((station) => station.stationType !== "depot").sort((a, b) => b.sequence - a.sequence);
    const order = new Map(mainline.map((station, index) => [station.id, index]));
    const position = (station: Station): number => station.stationType === "depot"
      ? (order.get(line.branchParts?.find((part) => part.toId === station.id)?.fromId ?? "") ?? 0) + 0.5
      : order.get(station.id) ?? 0;
    return events.sort((a, b) => position(a) - position(b));
  }
  const served = new Set(timetable.trips.filter((item) => item.classification !== "non-revenue").flatMap((item) => item.events.filter((event) => event.arrival || event.departure).map((event) => event.locationId)));
  const stations = line.stations.filter((station) => station.stationType === "operational" && !nonOperating.has(station.id) && served.has(station.id));
  return stations.reverse();
}

export function renderPisTrain(state: TrainState, line: LineData, timetable: DomainTimetable, stations: readonly Station[], mode: PisMode, nowDaySeconds: number, nonOperating: ReadonlySet<string>): string {
  const number = lineNumber(line.lineId);
  const route = routeStations(state, line, timetable, mode, nonOperating);
  const trip = timetable.trips.find((item) => item.tripId === state.tripId);
  const events = new Map(trip?.events.map((event) => [event.locationId, event]) ?? []);
  const now = serviceDaySeconds(nowDaySeconds, timetable);
  const nextIndex = route.findIndex((station) => station.id === state.nextStationId);
  const stopIndex = route.findIndex((station) => station.id === state.locationId);
  const parked = state.status === "dwelling" && stopIndex >= 0;
  const approaching = state.status === "moving" && nextIndex >= 0 && state.etaSeconds !== undefined && state.etaSeconds >= 0 && state.etaSeconds <= 30;
  const highlightedIndex = parked ? stopIndex : state.status === "moving" ? nextIndex : -1;
  const depotMovement = mode === "A" && !!trip && !state.passengerService;
  const up = state.direction !== "down";
  const timedPositions = route.flatMap((station, index) => {
    const event = events.get(station.id);
    const time = event?.arrival ?? event?.departure ?? event?.boundaryTime ?? event?.pass;
    return time ? [{ index, seconds: serviceSeconds(time, timetable) }] : [];
  }).sort((a, b) => a.seconds - b.seconds);
  const before = timedPositions.filter((item) => item.seconds <= now).at(-1);
  const after = timedPositions.find((item) => item.seconds > now);
  const timedPosition = before && after ? before.index + (after.index - before.index) * (now - before.seconds) / (after.seconds - before.seconds) : before?.index ?? after?.index;
  const positionIndex = parked ? stopIndex : approaching ? nextIndex : depotMovement && timedPosition !== undefined ? timedPosition : nextIndex >= 0 ? nextIndex + (up ? -0.5 : 0.5) : Math.max(0, stopIndex);
  const currentId = parked || !state.nextStationId ? state.locationId : state.nextStationId;
  const currentLabel = parked || !state.nextStationId ? "当前站 · Current station" : approaching ? "即将到站 · Arriving" : "下一站 · Next station";
  const currentName = currentId ? locationName(currentId, stations) : statuses[state.status];
  const destination = state.destinationId ? locationName(state.destinationId, stations) : "--";
  const destinationEn = state.destinationId ? stationEnglish(state.destinationId, stations) : "";
  const estimate = state.status === "dwelling" && state.departureInSeconds !== undefined
    ? ["预计发车", state.departureInSeconds] as const
    : state.etaSeconds !== undefined ? ["预计到达", state.etaSeconds] as const : undefined;
  const marks = route.map((station, index) => {
    const current = (parked || approaching) && index === highlightedIndex;
    const transfer = transfers[station.id];
    const event = events.get(station.id);
    const eventTime = event?.arrival ?? event?.departure ?? event?.boundaryTime ?? event?.pass;
    const referenceIndex = parked ? stopIndex : nextIndex >= 0 ? nextIndex : stopIndex;
    const past = !current && (depotMovement && eventTime ? serviceSeconds(eventTime, timetable) < now : up ? index < referenceIndex : index > referenceIndex);
    const remaining = eventTime ? serviceSeconds(eventTime, timetable) - now : undefined;
    const minutes = !past && !current && remaining !== undefined && remaining >= 0 ? Math.round(remaining / 60) : undefined;
    return `<div class="pis-stop${past ? " is-past" : ""}${current ? " is-current" : ""}${index === highlightedIndex ? " is-highlighted" : ""}" data-station-id="${escape(station.id)}"><div class="pis-stop-name"><b>${escape(stationDisplayName(station))}</b><small>${escape(station.nameEn)}</small></div><div class="pis-stop-point${minutes !== undefined ? " has-eta" : ""}">${transfer ? transferMark(transfer, past, line.lineColor) : '<span class="pis-stop-dot"></span>'}${minutes !== undefined ? `<span class="pis-stop-eta" aria-label="预计${minutes}分钟到达">${minutes}</span>` : ""}</div><div class="pis-stop-meta"${transfer ? ` style="--transfer:${past ? "#AAB3BE" : transferColors[transfer[0]!] ?? line.lineColor}"` : ""}>${transfer ? transfer.map((transferLine) => `<span class="pis-transfer-badge" style="--transfer:${past ? "#AAB3BE" : transferColors[transferLine]}"><b>${transferLine} 线</b><small>Line ${transferLine}</small></span>`).join("") : ""}</div></div>`;
  }).join("");
  const count = Math.max(1, route.length);
  const movingSegment = state.status === "moving" && !approaching && nextIndex >= 0 ? (up ? nextIndex - 1 : nextIndex) : -1;
  const segments = Array.from({ length: count - 1 }, (_, index) => {
    const active = index === movingSegment;
    const segmentProgress = Math.max(0, Math.min(100, (positionIndex - index) * 100));
    return `<span class="pis-route-segment${active ? " is-running" : ""}${up ? "" : " is-down"}" style="--segment-progress:${segmentProgress}%">${active ? '<i></i><i></i><i></i>' : `<span>${up ? "▸▸" : "◂◂"}</span>`}</span>`;
  }).join("");
  return `<article class="pis-train-system" style="--pis-line:${line.lineColor}" aria-label="${number} 线列车信息显示系统">
    <div class="pis-train-header"><div class="pis-train-brand"><b class="pis-train-brand-name">METRO VIEW</b><span class="pis-train-line-badge"><b>${number} 线</b><small>Line ${number}</small></span></div><div class="pis-train-current"><small>${currentLabel}</small><b>${escape(currentName)}</b></div>${mode === "A" && estimate ? `<div class="pis-train-estimate"><small>${estimate[0]}</small><b>${countdown(estimate[1])}</b></div>` : ""}<div class="pis-train-terminal"><small>终点站 · Destination</small><b>${escape(destination)}</b><em>${escape(destinationEn)}</em></div></div>
    <div class="pis-route-fit" aria-label="列车沿线站点"><div class="pis-route-axis${count > 10 ? " is-dense" : ""}" style="--stop-count:${count}"><div class="pis-route-segments" aria-hidden="true">${segments}</div><div class="pis-route-stops">${marks}</div><span class="pis-route-legend">圈内数字为预计到达分钟</span></div></div>
    ${mode === "A" ? `<footer class="pis-train-footer"><span>车辆号 <b>${escape(state.vehicleId)}</b></span><span>车次号 <b>${escape(state.tripId ?? "待命")}</b></span><span>状态 <b>${statuses[state.status]}</b></span>${state.notice ? `<small>${escape(state.notice)}</small>` : ""}</footer>` : ""}
  </article>`;
}
