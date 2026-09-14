import type { DomainCirculation, DomainTimetable, DomainTrip, TimedEvent } from "../domain/timetable.ts";

export interface SampleTimetable extends DomainTimetable {
  readonly scheduleId: string;
  readonly status: "confirmed";
  readonly sampleData: true;
  readonly conventions: { readonly serviceDayRollover: string };
}

export interface SampleTimetableOptions {
  readonly scheduleId: string;
  readonly stations: readonly string[];
  readonly intervalMinutes?: number;
  readonly offsetSeconds?: number;
}

function clock(totalSeconds: number): string {
  const seconds = ((totalSeconds % 86_400) + 86_400) % 86_400;
  const hour = Math.floor(seconds / 3600);
  const minute = Math.floor((seconds % 3600) / 60);
  const second = seconds % 60;
  return [hour, minute, second].map((value) => String(value).padStart(2, "0")).join(":");
}

function tripEvents(stations: readonly string[], start: number): readonly TimedEvent[] {
  return stations.map((locationId, index) => {
    const arrival = start + index * 180;
    if (index === 0) return { locationId, departure: clock(start) };
    if (index === stations.length - 1) return { locationId, arrival: clock(arrival) };
    return { locationId, arrival: clock(arrival), departure: clock(arrival + 30) };
  });
}

export function createSampleTimetable(options: SampleTimetableOptions): SampleTimetable {
  const interval = (options.intervalMinutes ?? 20) * 60;
  const offset = options.offsetSeconds ?? 0;
  const trips: DomainTrip[] = [];
  const tripIdsByVehicle = new Map<string, string[]>();
  let serial = 1;

  for (let slot = 6 * 3600 + offset; slot <= 22 * 3600; slot += interval) {
    for (const [direction, directionOffset] of [["down", 0], ["up", Math.floor(interval / 2)]] as const) {
      const stations = direction === "down" ? options.stations : [...options.stations].reverse();
      const vehicleNumber = direction === "down" ? serial % 4 + 1 : serial % 4 + 5;
      const vehicleId = `sample-trainset-${String(vehicleNumber).padStart(3, "0")}`;
      const tripId = `${options.scheduleId}-${direction === "down" ? "D" : "U"}-${String(serial).padStart(3, "0")}`;
      const circulationId = `${options.scheduleId}-C${String(vehicleNumber).padStart(2, "0")}`;
      trips.push({ tripId, direction, circulationId, vehicleId, classification: "revenue", events: tripEvents(stations, slot + directionOffset) });
      const assigned = tripIdsByVehicle.get(vehicleId) ?? [];
      assigned.push(tripId);
      tripIdsByVehicle.set(vehicleId, assigned);
      serial += 1;
    }
  }

  const circulations: DomainCirculation[] = [...tripIdsByVehicle.entries()].map(([vehicleId, tripIds]) => ({
    circulationId: trips.find((trip) => trip.vehicleId === vehicleId)!.circulationId,
    vehicleId,
    tripIds,
    connections: [],
  }));

  return {
    scheduleId: options.scheduleId,
    status: "confirmed",
    sampleData: true,
    conventions: { serviceDayRollover: "03:00:00" },
    trips,
    circulations,
  };
}
