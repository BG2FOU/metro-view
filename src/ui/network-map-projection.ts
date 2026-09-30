import { projectToRoute } from "../domain/geometry.ts";
import type { LineData, PathModel, Position, RouteModel, TrainState } from "../domain/model.ts";

export interface Point { readonly x: number; readonly y: number }

export interface SchematicPath {
  readonly points: readonly Point[];
  readonly length: number;
  readonly locationDistance: ReadonlyMap<string, number>;
}

export interface SchematicRoute {
  readonly main: SchematicPath;
  readonly branches: ReadonlyMap<string, SchematicPath>;
}

export interface ProjectedTrainPosition {
  readonly point: Point;
  readonly path: SchematicPath;
  readonly distance: number;
}

interface PolylineProjection {
  readonly distance: number;
  readonly along: number;
}

interface PhysicalCandidate {
  readonly path: PathModel;
  readonly schematic: SchematicPath;
  readonly projection: PolylineProjection;
  readonly locationId?: string;
}

function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function pathLength(points: readonly Point[]): number {
  return points.slice(1).reduce((total, point, index) => total + distance(points[index]!, point), 0);
}

function projectToPolyline(points: readonly Point[], target: Point): PolylineProjection {
  if (points.length === 0) return { distance: Number.POSITIVE_INFINITY, along: 0 };
  if (points.length === 1) return { distance: distance(points[0]!, target), along: 0 };
  let best: PolylineProjection = { distance: Number.POSITIVE_INFINITY, along: 0 };
  let travelled = 0;
  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1]!;
    const to = points[index]!;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const denominator = dx * dx + dy * dy;
    const ratio = denominator === 0
      ? 0
      : Math.max(0, Math.min(1, ((target.x - from.x) * dx + (target.y - from.y) * dy) / denominator));
    const point = { x: from.x + dx * ratio, y: from.y + dy * ratio };
    const candidate = { distance: distance(point, target), along: travelled + distance(from, to) * ratio };
    if (candidate.distance < best.distance) best = candidate;
    travelled += distance(from, to);
  }
  return best;
}

export function pointAtSchematicDistance(points: readonly Point[], target: number): Point | undefined {
  if (points.length === 0) return undefined;
  if (points.length === 1 || target <= 0) return points[0];
  let travelled = 0;
  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1]!;
    const to = points[index]!;
    const segment = distance(from, to);
    if (travelled + segment >= target) {
      const ratio = segment === 0 ? 0 : (target - travelled) / segment;
      return { x: from.x + (to.x - from.x) * ratio, y: from.y + (to.y - from.y) * ratio };
    }
    travelled += segment;
  }
  return points.at(-1);
}

function buildSchematicPath(points: readonly Point[], locationIds: readonly string[], stationPoints: ReadonlyMap<string, Point>): SchematicPath {
  const locationDistance = new Map<string, number>();
  for (const locationId of locationIds) {
    const point = stationPoints.get(locationId);
    if (point) locationDistance.set(locationId, projectToPolyline(points, point).along);
  }
  return { points, length: pathLength(points), locationDistance };
}

export function buildSchematicRoute(
  line: LineData,
  route: RouteModel,
  stationPoints: ReadonlyMap<string, Point>,
  mainPoints: readonly Point[],
  branchPoints: ReadonlyMap<string, readonly Point[]>,
): SchematicRoute {
  const mainLocationIds = line.stations.filter((station) => station.stationType !== "depot").map((station) => station.id);
  const main = buildSchematicPath(mainPoints, mainLocationIds, stationPoints);
  const branches = new Map<string, SchematicPath>();
  for (const [branchId, points] of branchPoints) {
    const branch = route.branchRoutes?.get(branchId);
    if (!branch) continue;
    const ids = [branch.fromId, branch.toId];
    branches.set(branchId, buildSchematicPath(points, ids, stationPoints));
  }
  return { main, branches };
}

function candidateFor(
  position: Position,
  physicalPath: PathModel,
  schematicPath: SchematicPath,
  locationId?: string,
): PhysicalCandidate {
  const projection = projectToRoute(physicalPath.points, position);
  return { path: physicalPath, schematic: schematicPath, projection: { distance: projection.distanceMeters, along: projection.chainageMeters }, ...(locationId ? { locationId } : {}) };
}

function nearestCandidate(position: Position, route: RouteModel, schematic: SchematicRoute, locationId?: string): PhysicalCandidate | undefined {
  const preferredBranch = locationId ? route.branchRoutes?.get(locationId) : undefined;
  const preferredSchematic = locationId ? schematic.branches.get(locationId) : undefined;
  if (preferredBranch && preferredSchematic) return candidateFor(position, preferredBranch, preferredSchematic, locationId);
  const candidates: PhysicalCandidate[] = [candidateFor(position, route, schematic.main)];
  for (const [branchId, branch] of route.branchRoutes ?? []) {
    const branchSchematic = schematic.branches.get(branchId);
    if (branchSchematic) candidates.push(candidateFor(position, branch, branchSchematic));
  }
  return candidates.sort((a, b) => a.projection.distance - b.projection.distance)[0];
}

function stationEntries(path: PathModel, schematic: SchematicPath): readonly [string, number, number][] {
  const entries: [string, number, number][] = [];
  for (const [locationId, physicalDistance] of path.stationChainage) {
    const schematicDistance = schematic.locationDistance.get(locationId);
    if (schematicDistance !== undefined) entries.push([locationId, physicalDistance, schematicDistance]);
  }
  return entries.sort((a, b) => a[1] - b[1]);
}

function projectedDistance(candidate: PhysicalCandidate): number | undefined {
  const entries = stationEntries(candidate.path, candidate.schematic);
  if (entries.length === 0) return undefined;
  const exact = candidate.locationId ? entries.find(([locationId]) => locationId === candidate.locationId) : undefined;
  if (exact) return exact[2];
  const before = entries.filter((entry) => entry[1] <= candidate.projection.along).at(-1);
  const after = entries.find((entry) => entry[1] >= candidate.projection.along);
  if (!before) return entries[0]![2];
  if (!after || after[0] === before[0]) return before[2];
  const physicalSpan = after[1] - before[1];
  const ratio = physicalSpan === 0 ? 0 : (candidate.projection.along - before[1]) / physicalSpan;
  return before[2] + (after[2] - before[2]) * Math.max(0, Math.min(1, ratio));
}

export function projectTrainPosition(state: TrainState, route: RouteModel, schematic: SchematicRoute): Point | undefined {
  return projectTrainPlacement(state, route, schematic)?.point;
}

export function projectTrainPlacement(state: TrainState, route: RouteModel, schematic: SchematicRoute): ProjectedTrainPosition | undefined {
  if (!state.position) return undefined;
  const candidate = nearestCandidate(state.position, route, schematic, state.locationId);
  const along = candidate ? projectedDistance(candidate) : undefined;
  const point = candidate && along !== undefined ? pointAtSchematicDistance(candidate.schematic.points, along) : undefined;
  return candidate && along !== undefined && point ? { point, path: candidate.schematic, distance: along } : undefined;
}
