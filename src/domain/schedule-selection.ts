import { serviceCalendarAt } from "./timetable.ts";

export type ScheduleSelectionMode = "auto" | "legacy" | "next";
export type ScheduleGeneration = Exclude<ScheduleSelectionMode, "auto">;
export type LineAScheduleId = "LA-BASE" | "LA-NEXT" | "LA-EXPANDED" | "LA-SPECIAL";
export type LineBScheduleId = "LB-WEEKDAY-BASE" | "LB-WEEKDAY-NEXT" | "LB-WEEKEND-BASE" | "LB-WEEKEND-NEXT" | "LB-SPECIAL";
export type RuntimeScheduleId = LineAScheduleId | LineBScheduleId;
export interface ManualScheduleSelection {
  readonly mode: "manual";
  readonly lineA: LineAScheduleId;
  readonly lineB: LineBScheduleId;
}
export type ScheduleSelection = ScheduleSelectionMode | ManualScheduleSelection;

export interface ActiveSchedules {
  readonly generation: ScheduleGeneration;
  readonly lineA: LineAScheduleId;
  readonly lineB: LineBScheduleId;
  readonly calendar: "weekday" | "weekend";
}

export const NEXT_SCHEDULE_EFFECTIVE_AT = Date.parse("2030-01-01T00:00:00+08:00");
export const SCHEDULE_MODE_STORAGE_KEY = "metro-view.schedule-selection.v1";
// Demonstration dates only; no real operating calendar is included.
const LINE_A_EXPANDED_EFFECTIVE_AT = Date.parse("2030-02-01T00:00:00+08:00");
const LINE_A_SPECIAL_EFFECTIVE_AT = Date.parse("2030-03-01T00:00:00+08:00");
const LINE_B_SPECIAL_EFFECTIVE_AT = Date.parse("2030-03-01T00:00:00+08:00");
const SPECIAL_ROLLOVER_AT = Date.parse("2030-03-08T00:00:00+08:00");

const NON_OPERATING_STATIONS: Readonly<Record<RuntimeScheduleId, readonly string[]>> = {
  "LA-BASE": [], "LA-NEXT": ["a-riverside"], "LA-EXPANDED": [], "LA-SPECIAL": [],
  "LB-WEEKDAY-BASE": [], "LB-WEEKDAY-NEXT": ["b-garden"],
  "LB-WEEKEND-BASE": [], "LB-WEEKEND-NEXT": ["b-garden"], "LB-SPECIAL": [],
};

export function isScheduleSelectionMode(value: unknown): value is ScheduleSelectionMode {
  return value === "auto" || value === "legacy" || value === "next";
}

export function isLineAScheduleId(value: unknown): value is LineAScheduleId {
  return value === "LA-BASE" || value === "LA-NEXT" || value === "LA-EXPANDED" || value === "LA-SPECIAL";
}

export function isLineBScheduleId(value: unknown): value is LineBScheduleId {
  return value === "LB-WEEKDAY-BASE" || value === "LB-WEEKDAY-NEXT" || value === "LB-WEEKEND-BASE" || value === "LB-WEEKEND-NEXT" || value === "LB-SPECIAL";
}

export function isScheduleSelection(value: unknown): value is ScheduleSelection {
  if (isScheduleSelectionMode(value)) return true;
  if (!value || typeof value !== "object") return false;
  const selection = value as Partial<ManualScheduleSelection>;
  return selection.mode === "manual" && isLineAScheduleId(selection.lineA) && isLineBScheduleId(selection.lineB);
}

export function resolveScheduleGeneration(mode: ScheduleSelectionMode, now: Date): ScheduleGeneration {
  if (mode !== "auto") return mode;
  return now.getTime() >= NEXT_SCHEDULE_EFFECTIVE_AT ? "next" : "legacy";
}

export function resolveActiveSchedules(selection: ScheduleSelection, now: Date): ActiveSchedules {
  const timestamp = now.getTime();
  const calendar = serviceCalendarAt(now);
  if (typeof selection === "object") {
    return {
      generation: selection.lineA === "LA-BASE" ? "legacy" : "next",
      lineA: selection.lineA,
      lineB: selection.lineB,
      calendar,
    };
  }
  if (selection !== "auto") {
    return {
      generation: selection,
      lineA: selection === "legacy" ? "LA-BASE" : "LA-NEXT",
      lineB: selection === "legacy"
        ? (calendar === "weekend" ? "LB-WEEKEND-BASE" : "LB-WEEKDAY-BASE")
        : (calendar === "weekend" ? "LB-WEEKEND-NEXT" : "LB-WEEKDAY-NEXT"),
      calendar,
    };
  }

  const lineA: LineAScheduleId = timestamp < NEXT_SCHEDULE_EFFECTIVE_AT
    ? "LA-BASE"
    : timestamp < LINE_A_EXPANDED_EFFECTIVE_AT
      ? "LA-NEXT"
      : timestamp < LINE_A_SPECIAL_EFFECTIVE_AT
        ? "LA-EXPANDED"
        : timestamp < SPECIAL_ROLLOVER_AT
          ? "LA-SPECIAL"
          : "LA-EXPANDED";
  const lineB: LineBScheduleId = timestamp >= LINE_B_SPECIAL_EFFECTIVE_AT && timestamp < SPECIAL_ROLLOVER_AT
    ? "LB-SPECIAL"
    : timestamp >= NEXT_SCHEDULE_EFFECTIVE_AT
      ? (calendar === "weekend" ? "LB-WEEKEND-NEXT" : "LB-WEEKDAY-NEXT")
      : (calendar === "weekend" ? "LB-WEEKEND-BASE" : "LB-WEEKDAY-BASE");
  return { generation: resolveScheduleGeneration("auto", now), lineA, lineB, calendar };
}

export function nonOperatingStationIds(schedules: ActiveSchedules): ReadonlySet<string> {
  return new Set([...NON_OPERATING_STATIONS[schedules.lineA], ...NON_OPERATING_STATIONS[schedules.lineB]]);
}
