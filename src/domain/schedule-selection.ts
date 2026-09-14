import { serviceCalendarAt } from "./timetable.ts";

export type ScheduleSelectionMode = "auto" | "legacy" | "next";
export type ScheduleGeneration = Exclude<ScheduleSelectionMode, "auto">;
export type RuntimeScheduleId = "LA-BASE" | "LA-NEXT" | "LB-WEEKDAY-BASE" | "LB-WEEKDAY-NEXT" | "LB-WEEKEND-BASE" | "LB-WEEKEND-NEXT";

export interface ActiveSchedules {
  readonly generation: ScheduleGeneration;
  readonly lineA: "LA-BASE" | "LA-NEXT";
  readonly lineB: "LB-WEEKDAY-BASE" | "LB-WEEKDAY-NEXT" | "LB-WEEKEND-BASE" | "LB-WEEKEND-NEXT";
  readonly calendar: "weekday" | "weekend";
}

// Demonstration-only cutover date. Replace it together with your own sample/production datasets.
export const NEXT_SCHEDULE_EFFECTIVE_AT = Date.parse("2030-01-01T00:00:00+08:00");
export const SCHEDULE_MODE_STORAGE_KEY = "metro-view.schedule-selection.v1";

const NON_OPERATING_STATIONS: Readonly<Record<RuntimeScheduleId, readonly string[]>> = {
  "LA-BASE": [],
  "LA-NEXT": ["a-riverside"],
  "LB-WEEKDAY-BASE": [],
  "LB-WEEKDAY-NEXT": ["b-garden"],
  "LB-WEEKEND-BASE": [],
  "LB-WEEKEND-NEXT": ["b-garden"],
};

export function isScheduleSelectionMode(value: unknown): value is ScheduleSelectionMode { return value === "auto" || value === "legacy" || value === "next"; }
export function resolveScheduleGeneration(mode: ScheduleSelectionMode, now: Date): ScheduleGeneration { return mode !== "auto" ? mode : now.getTime() >= NEXT_SCHEDULE_EFFECTIVE_AT ? "next" : "legacy"; }
export function resolveActiveSchedules(mode: ScheduleSelectionMode, now: Date): ActiveSchedules {
  const generation = resolveScheduleGeneration(mode, now); const calendar = serviceCalendarAt(now);
  return {
    generation,
    lineA: generation === "next" ? "LA-NEXT" : "LA-BASE",
    lineB: generation === "next"
      ? (calendar === "weekend" ? "LB-WEEKEND-NEXT" : "LB-WEEKDAY-NEXT")
      : (calendar === "weekend" ? "LB-WEEKEND-BASE" : "LB-WEEKDAY-BASE"),
    calendar,
  };
}
export function nonOperatingStationIds(schedules: ActiveSchedules): ReadonlySet<string> { return new Set([...NON_OPERATING_STATIONS[schedules.lineA], ...NON_OPERATING_STATIONS[schedules.lineB]]); }
