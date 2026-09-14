import { parseServiceDateTimeLocal } from "../services/service-time.ts";
import type { ScheduleGeneration } from "../domain/schedule-selection.ts";

export type SimulationPeriodKind = "non-service" | "transition" | "peak" | "flat" | "off-peak";
export interface SimulationPeriod {
  readonly start: number;
  readonly end: number;
  readonly kind: SimulationPeriodKind;
  readonly label: string;
}

const seconds = (hour: number, minute = 0): number => hour * 3600 + minute * 60;
const WEEKDAY_FORMATTER = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Shanghai", weekday: "short" });

export function isServiceWeekend(dateKey: string): boolean {
  const noon = parseServiceDateTimeLocal(`${dateKey}T12:00:00`);
  if (!noon) return false;
  const weekday = WEEKDAY_FORMATTER.format(noon);
  return weekday === "Sat" || weekday === "Sun";
}

export function servicePeriodsForDate(dateKey: string, generation: ScheduleGeneration = "legacy"): readonly SimulationPeriod[] {
  if (isServiceWeekend(dateKey)) {
    const eveningLowPeakStart = generation === "next" ? seconds(21) : seconds(21, 30);
    return [
      { start: 0, end: seconds(6), kind: "non-service", label: "非运营" },
      { start: seconds(6), end: seconds(7, 30), kind: "off-peak", label: "低峰" },
      { start: seconds(7, 30), end: seconds(8), kind: "transition", label: "过渡" },
      { start: seconds(8), end: seconds(20, 30), kind: "flat", label: "平峰" },
      { start: seconds(20, 30), end: eveningLowPeakStart, kind: "transition", label: "过渡" },
      { start: eveningLowPeakStart, end: seconds(22, 30), kind: "off-peak", label: "低峰" },
      { start: seconds(22, 30), end: seconds(23), kind: "transition", label: "过渡" },
      { start: seconds(23), end: seconds(24), kind: "non-service", label: "非运营" },
    ];
  }
  return [
    { start: 0, end: seconds(6), kind: "non-service", label: "非运营" },
    { start: seconds(6), end: seconds(7), kind: "transition", label: "过渡" },
    { start: seconds(7), end: seconds(9), kind: "peak", label: "高峰" },
    { start: seconds(9), end: seconds(9, 30), kind: "transition", label: "过渡" },
    { start: seconds(9, 30), end: seconds(16, 30), kind: "off-peak", label: "低峰" },
    { start: seconds(16, 30), end: seconds(17), kind: "transition", label: "过渡" },
    { start: seconds(17), end: seconds(19), kind: "peak", label: "高峰" },
    { start: seconds(19), end: seconds(19, 30), kind: "transition", label: "过渡" },
    { start: seconds(19, 30), end: seconds(22, 30), kind: "off-peak", label: "低峰" },
    { start: seconds(22, 30), end: seconds(23), kind: "transition", label: "过渡" },
    { start: seconds(23), end: seconds(24), kind: "non-service", label: "非运营" },
  ];
}
