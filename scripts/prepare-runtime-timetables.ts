import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { LB_WEEKDAY_BASE_TIMETABLE } from "../src/data/lb-weekday-base-timetable.ts";
import { LB_WEEKDAY_NEXT_TIMETABLE } from "../src/data/lb-weekday-next-timetable.ts";
import { LB_WEEKEND_BASE_TIMETABLE } from "../src/data/lb-weekend-base-timetable.ts";
import { LB_WEEKEND_NEXT_TIMETABLE } from "../src/data/lb-weekend-next-timetable.ts";
import { LA_NEXT_TIMETABLE } from "../src/data/la-next-timetable.ts";

interface SourceEvent {
  readonly locationId: string;
  readonly arrival?: string;
  readonly departure?: string;
  readonly pass?: string;
  readonly boundaryTime?: string;
}

interface SourceTimetable {
  readonly scheduleId: string;
  readonly status: string;
  readonly conventions: { readonly serviceDayRollover?: string };
  readonly trips: readonly {
    readonly tripId: string;
    readonly direction: "up" | "down";
    readonly circulationId: string;
    readonly vehicleId: string;
    readonly classification: "revenue" | "non-revenue" | "mixed";
    readonly events: readonly SourceEvent[];
    readonly serviceSegments?: readonly { readonly classification: string; readonly departure: string; readonly arrival: string }[];
  }[];
  readonly circulations: readonly {
    readonly circulationId: string;
    readonly vehicleId: string;
    readonly tripIds: readonly string[];
    readonly connections: readonly {
      readonly fromTripId: string;
      readonly toTripId: string;
      readonly locationId: string;
      readonly fromTime: string;
      readonly toTime: string;
      readonly connectionType: string;
    }[];
  }[];
}

const datasets = [
  { data: LB_WEEKDAY_BASE_TIMETABLE as unknown as SourceTimetable, output: "src/data/runtime/lb-weekday-base.json" },
  { data: LB_WEEKEND_BASE_TIMETABLE as unknown as SourceTimetable, output: "src/data/runtime/lb-weekend-base.json" },
  { data: LA_NEXT_TIMETABLE as unknown as SourceTimetable, output: "src/data/runtime/la-next.json" },
  { data: LB_WEEKDAY_NEXT_TIMETABLE as unknown as SourceTimetable, output: "src/data/runtime/lb-weekday-next.json" },
  { data: LB_WEEKEND_NEXT_TIMETABLE as unknown as SourceTimetable, output: "src/data/runtime/lb-weekend-next.json" },
] as const;

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export function runtimeTimetable(data: SourceTimetable): object {
  invariant(data.status === "confirmed", `${data.scheduleId} is not confirmed`);
  return {
    conventions: { serviceDayRollover: data.conventions.serviceDayRollover },
    trips: data.trips.map((trip) => ({
      tripId: trip.tripId,
      direction: trip.direction,
      circulationId: trip.circulationId,
      vehicleId: trip.vehicleId,
      classification: trip.classification,
      events: trip.events.map((event) => ({
        locationId: event.locationId,
        ...(event.arrival !== undefined ? { arrival: event.arrival } : {}),
        ...(event.departure !== undefined ? { departure: event.departure } : {}),
        ...(event.pass !== undefined ? { pass: event.pass } : {}),
        ...(event.boundaryTime !== undefined ? { boundaryTime: event.boundaryTime } : {}),
      })),
      ...(trip.serviceSegments !== undefined ? {
        serviceSegments: trip.serviceSegments.map((segment) => ({
          classification: segment.classification,
          departure: segment.departure,
          arrival: segment.arrival,
        })),
      } : {}),
    })),
    circulations: data.circulations.map((circulation) => ({
      circulationId: circulation.circulationId,
      vehicleId: circulation.vehicleId,
      tripIds: circulation.tripIds,
      connections: circulation.connections.map((connection) => ({
        fromTripId: connection.fromTripId,
        toTripId: connection.toTripId,
        locationId: connection.locationId,
        fromTime: connection.fromTime,
        toTime: connection.toTime,
        connectionType: connection.connectionType,
      })),
    })),
  };
}

async function writeOrCheck(path: string, content: string, check: boolean): Promise<void> {
  const absolutePath = resolve(path);
  if (check) {
    const existing = await readFile(absolutePath, "utf8");
    invariant(existing === content, `Generated runtime timetable is stale: ${path}`);
    return;
  }
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, content, "utf8");
}

async function main(): Promise<void> {
  const flags = new Set(process.argv.slice(2));
  for (const flag of flags) invariant(flag === "--check", `Unknown option ${flag}`);
  const check = flags.has("--check");
  for (const { data, output } of datasets) {
    const content = `${JSON.stringify(runtimeTimetable(data))}\n`;
    await writeOrCheck(output, content, check);
    console.log(`${check ? "checked" : "generated"}: ${data.scheduleId} runtime timetable (${data.trips.length} trips, ${data.circulations.length} circulations)`);
  }
}

const isEntrypoint = process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isEntrypoint) await main();
