import { passengerServiceAt, serviceDaySeconds, serviceSeconds, tripDestinationId, type DomainTimetable } from "./timetable.ts";

export interface StationArrival { readonly tripId: string; readonly vehicleId: string; readonly direction: "up" | "down"; readonly destinationId: string; readonly etaSeconds: number; readonly imminent: boolean; readonly kind: "arrival" | "departure" | "pass" }
export interface StationArrivalBoard { readonly up: readonly StationArrival[]; readonly down: readonly StationArrival[] }

export function calculateStationArrivals(now: number, stationId: string, timetable: DomainTimetable): StationArrivalBoard {
  now = serviceDaySeconds(now, timetable);
  const arrivals = timetable.trips.flatMap((trip): readonly StationArrival[] => {
    const event = trip.events.find((candidate) => candidate.locationId === stationId);
    if (!event) return [];
    const isOrigin = event.departure !== undefined && event.arrival === undefined && event.pass === undefined;
    if (isOrigin) {
      const departure = serviceSeconds(event.departure!, timetable);
      if (departure < now || !passengerServiceAt(trip, departure, timetable)) return [];
      const etaSeconds = departure - now;
      return [{ tripId: trip.tripId, vehicleId: trip.vehicleId, direction: trip.direction, destinationId: tripDestinationId(trip, timetable), etaSeconds, imminent: etaSeconds <= 20, kind: "departure" }];
    }
    const arrivalValue = event.arrival ?? event.pass;
    if (!arrivalValue) return [];
    const arrival = serviceSeconds(arrivalValue, timetable); const departure = event.departure ? serviceSeconds(event.departure, timetable) : arrival;
    const dwelling = event.arrival !== undefined && event.departure !== undefined && now >= arrival && now < departure;
    if ((!dwelling && arrival < now) || !passengerServiceAt(trip, arrival, timetable)) return [];
    const etaSeconds = Math.max(0, arrival - now);
    return [{ tripId: trip.tripId, vehicleId: trip.vehicleId, direction: trip.direction, destinationId: tripDestinationId(trip, timetable), etaSeconds, imminent: event.pass !== undefined ? false : dwelling || etaSeconds <= 20, kind: event.pass !== undefined ? "pass" : "arrival" }];
  }).sort((a, b) => a.etaSeconds - b.etaSeconds || a.tripId.localeCompare(b.tripId));
  return { up: arrivals.filter((arrival) => arrival.direction === "up").slice(0, 2), down: arrivals.filter((arrival) => arrival.direction === "down").slice(0, 2) };
}
