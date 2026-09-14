import type { LineId, PathModel, Position, RouteModel, TrainState } from "./model.ts";
import { interpolateRoute } from "./geometry.ts";
import { eventTimes, passengerServiceAt, serviceDaySeconds, serviceSeconds, tripBounds, tripDestinationId, type DomainTimetable, type DomainTrip, type TimedEvent } from "./timetable.ts";

function pathFor(route: RouteModel, locationId: string): PathModel { const branch = route.branchRoutes?.get(locationId); if (branch) return branch; return route; }
function chainage(route: RouteModel, locationId: string): number { const path = pathFor(route, locationId); const value = path.stationChainage.get(locationId); if (value === undefined) throw new Error(`No route chainage for ${locationId}`); return value; }
function positionAt(route: RouteModel, locationId: string): Position { const path = pathFor(route, locationId); return interpolateRoute(path, chainage(route, locationId)); }
function positionBetween(route: RouteModel, fromId: string, toId: string, ratio: number): Position {
  const branch = route.branchRoutes ? [...route.branchRoutes.values()].find((candidate) => (candidate.fromId === fromId && candidate.toId === toId) || (candidate.fromId === toId && candidate.toId === fromId)) : undefined;
  if (!branch) { const start = chainage(route, fromId); const end = chainage(route, toId); return interpolateRoute(route, start + (end - start) * ratio); }
  const start = branch.stationChainage.get(fromId); const end = branch.stationChainage.get(toId); if (start === undefined || end === undefined) throw new Error(`No branch chainage for ${fromId} -> ${toId}`); return interpolateRoute(branch, start + (end - start) * ratio);
}
function timeline(trip: DomainTrip, timetable: DomainTimetable): readonly { event: TimedEvent; locationId: string; kind: string; seconds: number }[] { return trip.events.flatMap((event) => eventTimes(event, timetable).map((time) => ({ event, locationId: event.locationId, kind: time.kind, seconds: time.seconds }))).sort((a, b) => a.seconds - b.seconds); }
function withNotice(passengerService: boolean): Pick<TrainState, "passengerService" | "notice"> { return passengerService ? { passengerService } : { passengerService, notice: "本次列车不载客" }; }
export function displayVehicleId(vehicleId: string, lineId: LineId): string { const match = /trainset-(\d+)$/u.exec(vehicleId); return match ? `${lineId === "MV-LB" ? "LB" : "LA"}-${match[1]}` : vehicleId; }

function activeTripState(trip: DomainTrip, now: number, timetable: DomainTimetable, route: RouteModel): Omit<TrainState, "vehicleId" | "circulationId"> {
  const items = timeline(trip, timetable); const passenger = passengerServiceAt(trip, now, timetable); const notice = withNotice(passenger); const journey = { direction: trip.direction, destinationId: tripDestinationId(trip, timetable) } as const;
  const destinationLocationId = journey.destinationId;
  const nextStop = (after: number, locationId?: string) => items.find((item) => {
    if (item.seconds <= after || item.locationId === locationId) return false;
    if (item.event.departure !== undefined) return true;
    return item.locationId === destinationLocationId && (item.event.arrival !== undefined || item.event.boundaryTime !== undefined);
  });
  for (const event of trip.events) { if (event.arrival && event.departure && now >= serviceSeconds(event.arrival, timetable) && now < serviceSeconds(event.departure, timetable)) { const locationId = event.locationId; const departure = serviceSeconds(event.departure, timetable); const next = nextStop(departure, locationId); return { status: "dwelling", tripId: trip.tripId, locationId, position: positionAt(route, locationId), ...(next ? { nextStationId: next.event.locationId, etaSeconds: next.seconds - now } : {}), departureInSeconds: departure - now, ...journey, ...notice }; } }
  let fromIndex = -1;
  for (let index = 0; index < items.length; index += 1) if (items[index]!.seconds <= now) fromIndex = index;
  const from = items[fromIndex]; const to = items[fromIndex + 1];
  if (from && to) { const ratio = (now - from.seconds) / (to.seconds - from.seconds); const next = nextStop(now, from.locationId); return { status: from.locationId === to.locationId ? "dwelling" : "moving", tripId: trip.tripId, ...(from.locationId === to.locationId ? { locationId: from.locationId } : {}), position: positionBetween(route, from.locationId, to.locationId, ratio), ...(next ? { nextStationId: next.event.locationId, etaSeconds: next.seconds - now } : {}), ...journey, ...notice }; }
  const fallback = items.at(-1)!; return { status: "dwelling", tripId: trip.tripId, locationId: fallback.locationId, position: positionAt(route, fallback.locationId), ...journey, ...notice };
}

export function calculateTrainStates(now: number, timetable: DomainTimetable, route: RouteModel, lineId: LineId = "MV-LA", lineColor = lineId === "MV-LB" ? "#3B82F6" : "#E54B4B"): readonly TrainState[] {
  now = serviceDaySeconds(now, timetable);
  const byId = new Map(timetable.trips.map((trip) => [trip.tripId, trip]));
  return timetable.circulations.map((circulation) => {
    const vehicleId = displayVehicleId(circulation.vehicleId, lineId);
    const trips = circulation.tripIds.map((id) => { const trip = byId.get(id); if (!trip) throw new Error(`Unknown trip ${id}`); return trip; });
    const active = trips.find((trip) => { const [start, end] = tripBounds(trip, timetable); return now >= start && now <= end; });
    if (active) return { vehicleId, circulationId: circulation.circulationId, lineId, lineColor, ...activeTripState(active, now, timetable, route) };
    const connection = circulation.connections.find((item) => now > serviceSeconds(item.fromTime, timetable) && now < serviceSeconds(item.toTime, timetable));
    if (connection) { const locationId = connection.locationId; const status = connection.connectionType === "standby" ? "standby" : "turning"; const nextTrip = byId.get(connection.toTripId); return { vehicleId, circulationId: circulation.circulationId, lineId, lineColor, status, locationId, position: positionAt(route, locationId), ...(nextTrip ? { direction: nextTrip.direction, destinationId: tripDestinationId(nextTrip, timetable) } : {}), passengerService: false, notice: "本次列车不载客" }; }
    const first = tripBounds(trips[0]!, timetable)[0]; return { vehicleId, circulationId: circulation.circulationId, lineId, lineColor, status: now < first ? "waiting" : "out-of-service", passengerService: false };
  });
}
