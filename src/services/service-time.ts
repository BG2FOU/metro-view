const SERVICE_UTC_OFFSET = "+08:00";
const LOCAL_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?$/u;
const SERVICE_DATE_TIME_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

export function parseServiceDateTimeLocal(value: string): Date | undefined {
  const localDateTime = value.trim();
  if (!LOCAL_DATE_TIME.test(localDateTime)) return undefined;
  const parsed = new Date(`${localDateTime}${SERVICE_UTC_OFFSET}`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export function formatServiceDateTimeLocal(value: Date): string {
  const parts = SERVICE_DATE_TIME_FORMATTER.formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes): string => parts.find((candidate) => candidate.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}:${part("second")}`;
}
