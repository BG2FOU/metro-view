import type { BranchRouteModel, LineData, PathModel, Position, RouteModel, RoutePoint, SegmentPart, Station } from "./model.ts";

const EARTH = 6_371_008.8;
function radians(value: number): number { return value * Math.PI / 180; }
export function distanceMeters(a: Position, b: Position): number { const mean = radians((a[1] + b[1]) / 2); return Math.hypot(radians(b[0] - a[0]) * Math.cos(mean), radians(b[1] - a[1])) * EARTH; }

function buildPath(parts: readonly SegmentPart[]): { path: PathModel; ranges: readonly { partId: string; structureType: "elevated" | "underground"; startMeters: number; endMeters: number }[] } {
  const points: RoutePoint[] = []; const ranges: { partId: string; structureType: "elevated" | "underground"; startMeters: number; endMeters: number }[] = []; let chainage = 0;
  for (const part of parts) { const start = chainage; for (const coordinate of part.coordinates) { const previous = points.at(-1); if (previous !== undefined) { const length = distanceMeters(previous.coordinates, coordinate); if (length === 0) continue; chainage += length; } points.push({ coordinates: coordinate, chainageMeters: chainage }); } ranges.push({ partId: part.id, structureType: part.structureType, startMeters: start, endMeters: chainage }); }
  return { path: { points, lengthMeters: chainage, stationChainage: new Map() }, ranges };
}

function stationChainage(path: PathModel, stations: readonly Station[]): ReadonlyMap<string, number> {
  const result = new Map<string, number>(); let previous = -1;
  for (const station of stations) { const projection = projectToRoute(path.points, station.coordinates); if (projection.distanceMeters > 2) throw new Error(`${station.id} is ${projection.distanceMeters.toFixed(3)} m from route`); if (projection.chainageMeters <= previous) throw new Error(`Station chainage is not increasing at ${station.id}`); result.set(station.id, projection.chainageMeters); previous = projection.chainageMeters; }
  return result;
}

function branchRoute(parts: readonly SegmentPart[], stations: readonly Station[]): BranchRouteModel {
  const { path } = buildPath(parts); const first = parts[0]; const last = parts.at(-1); if (!first || !last) throw new Error("Depot branch has no geometry");
  const fromId = first.fromId; const toId = last.toId; const endpoints = stations.filter((station) => station.id === fromId || station.id === toId); if (endpoints.length !== 2) throw new Error(`Depot branch endpoints are not mapped: ${fromId} -> ${toId}`);
  const chainage = stationChainage(path, [endpoints.find((station) => station.id === fromId)!, endpoints.find((station) => station.id === toId)!]);
  return { ...path, fromId, toId, stationChainage: chainage };
}

export function buildRoute(data: LineData): RouteModel {
  const main = buildPath(data.parts); const mainStations = data.stations.filter((station) => station.stationType !== "depot"); const mainStationChainage = stationChainage(main.path, mainStations); const branchRoutes = new Map<string, BranchRouteModel>();
  const branches = new Map<string, SegmentPart[]>(); for (const part of data.branchParts ?? []) { const key = part.toId; const group = branches.get(key) ?? []; group.push(part); branches.set(key, group); }
  for (const parts of branches.values()) { parts.sort((a, b) => a.partNo - b.partNo); const branch = branchRoute(parts, data.stations); branchRoutes.set(branch.toId, branch); }
  return { ...main.path, parts: main.ranges, stationChainage: mainStationChainage, ...(branchRoutes.size > 0 ? { branchRoutes } : {}) };
}

export function projectToRoute(points: readonly RoutePoint[], target: Position): { chainageMeters: number; distanceMeters: number } {
  let best = { chainageMeters: 0, distanceMeters: Number.POSITIVE_INFINITY };
  const latitudeScale = Math.cos(radians(target[1]));
  for (let index = 1; index < points.length; index += 1) { const a = points[index - 1]!; const b = points[index]!; const ax = (a.coordinates[0] - target[0]) * latitudeScale; const ay = a.coordinates[1] - target[1]; const bx = (b.coordinates[0] - target[0]) * latitudeScale; const by = b.coordinates[1] - target[1]; const dx = bx - ax; const dy = by - ay; const denominator = dx * dx + dy * dy; if (denominator === 0) continue; const ratio = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / denominator)); const projected: Position = [a.coordinates[0] + (b.coordinates[0] - a.coordinates[0]) * ratio, a.coordinates[1] + (b.coordinates[1] - a.coordinates[1]) * ratio]; const distance = distanceMeters(projected, target); if (distance < best.distanceMeters) best = { chainageMeters: a.chainageMeters + (b.chainageMeters - a.chainageMeters) * ratio, distanceMeters: distance }; }
  return best;
}

export function interpolateRoute(route: Pick<PathModel, "points" | "lengthMeters">, chainage: number): Position {
  const target = Math.max(0, Math.min(route.lengthMeters, chainage));
  for (let index = 1; index < route.points.length; index += 1) { const a = route.points[index - 1]!; const b = route.points[index]!; if (target <= b.chainageMeters) { const span = b.chainageMeters - a.chainageMeters; const ratio = span === 0 ? 0 : (target - a.chainageMeters) / span; return [a.coordinates[0] + (b.coordinates[0] - a.coordinates[0]) * ratio, a.coordinates[1] + (b.coordinates[1] - a.coordinates[1]) * ratio]; } }
  return route.points.at(-1)?.coordinates ?? [0, 0];
}
