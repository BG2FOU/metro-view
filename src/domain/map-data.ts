import type { LineData, LineId, Position, SegmentPart, Station, StructureType } from "./model.ts";

function invariant(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
function record(value: unknown, label: string): Record<string, unknown> { invariant(typeof value === "object" && value !== null && !Array.isArray(value), `${label} must be an object`); return value as Record<string, unknown>; }
function text(value: unknown, label: string): string { invariant(typeof value === "string" && value.length > 0, `${label} must be text`); return value; }
function integer(value: unknown, label: string): number { invariant(typeof value === "number" && Number.isInteger(value), `${label} must be an integer`); return value; }
function position(value: unknown, label: string): Position { invariant(Array.isArray(value) && value.length === 2 && value.every((item) => typeof item === "number" && Number.isFinite(item)), `${label} must be a position`); return [value[0] as number, value[1] as number]; }
function structure(value: unknown): StructureType { invariant(value === "elevated" || value === "underground", "Unknown structure type"); return value; }

export function parseLineData(input: unknown, expectedLineId?: LineId): LineData {
  const root = record(input, "GeoJSON");
  invariant(root.type === "FeatureCollection" && root.coordinateSystem === "GCJ-02" && Array.isArray(root.features), "Invalid normalized GeoJSON root");
  const lineId = text(root.lineId, "lineId") as LineId;
  invariant(lineId === "MV-LA" || lineId === "MV-LB", `Unknown line ${lineId}`);
  invariant(expectedLineId === undefined || lineId === expectedLineId, `Expected ${expectedLineId}, got ${lineId}`);
  const lineColor = text(root.lineColor, "lineColor");
  const stations: Station[] = []; const parts: SegmentPart[] = []; const branchParts: SegmentPart[] = []; const ids = new Set<string>();
  for (const [index, rawFeature] of root.features.entries()) {
    const feature = record(rawFeature, `feature ${index}`); const properties = record(feature.properties, `properties ${index}`); const geometry = record(feature.geometry, `geometry ${index}`); const id = text(properties.id, "id");
    invariant(!ids.has(id), `Duplicate ID ${id}`); ids.add(id);
    if (geometry.type === "Point") {
      const stationType = properties.stationType; invariant(stationType === "operational" || stationType === "reserved" || stationType === "depot", `Unknown station type ${String(stationType)}`);
      stations.push({ id, nameZh: text(properties.nameZh, "nameZh"), nameEn: text(properties.nameEn, "nameEn"), sequence: integer(properties.sequence, "sequence"), stationType, structureType: structure(properties.structureType), coordinates: position(geometry.coordinates, id), lineId, lineColor });
    } else if (geometry.type === "LineString") {
      invariant(Array.isArray(geometry.coordinates), `${id} coordinates missing`);
      const part = { id, segmentId: text(properties.segmentId, "segmentId"), sequence: integer(properties.sequence, "sequence"), partNo: integer(properties.partNo, "partNo"), partCount: integer(properties.partCount, "partCount"), fromId: text(properties.fromId, "fromId"), toId: text(properties.toId, "toId"), structureType: structure(properties.structureType), coordinates: geometry.coordinates.map((item, coordinateIndex) => position(item, `${id}[${coordinateIndex}]`)), lineId, lineColor } satisfies SegmentPart;
      (properties.segmentType === "depot_line" ? branchParts : parts).push(part);
    } else throw new Error(`Unsupported geometry ${String(geometry.type)}`);
  }
  stations.sort((a, b) => a.sequence - b.sequence); parts.sort((a, b) => a.sequence - b.sequence || a.partNo - b.partNo); branchParts.sort((a, b) => a.sequence - b.sequence || a.partNo - b.partNo);
  const mainlineStations = stations.filter((station) => station.stationType !== "depot"); const depots = stations.filter((station) => station.stationType === "depot");
  invariant(mainlineStations.length >= 2, `${lineId} requires at least two mainline stations`);
  invariant(new Set(parts.map((part) => part.segmentId)).size === mainlineStations.length - 1, `${lineId} mainline segment count mismatch`);
  invariant((depots.length === 0 && branchParts.length === 0) || (depots.length > 0 && branchParts.length > 0), `${lineId} depot branch mismatch`);
  return { lineId, lineColor, stations, parts, ...(branchParts.length > 0 ? { branchParts } : {}) };
}
