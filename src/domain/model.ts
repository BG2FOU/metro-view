export type Position = readonly [number, number];
export type StructureType = "elevated" | "underground";
export type LineId = "MV-LA" | "MV-LB";

export interface Station {
  readonly id: string; readonly nameZh: string; readonly nameEn: string; readonly sequence: number;
  readonly stationType: "operational" | "reserved" | "depot"; readonly structureType: StructureType; readonly coordinates: Position;
  readonly lineId?: LineId; readonly lineColor?: string;
}
export interface SegmentPart {
  readonly id: string; readonly segmentId: string; readonly sequence: number; readonly partNo: number; readonly partCount: number;
  readonly fromId: string; readonly toId: string; readonly structureType: StructureType; readonly coordinates: readonly Position[];
  readonly lineId?: LineId; readonly lineColor?: string;
}
export interface LineData { readonly lineId: LineId; readonly lineColor: string; readonly stations: readonly Station[]; readonly parts: readonly SegmentPart[]; readonly branchParts?: readonly SegmentPart[] }
export interface RoutePoint { readonly coordinates: Position; readonly chainageMeters: number }
export interface PartRange { readonly partId: string; readonly structureType: StructureType; readonly startMeters: number; readonly endMeters: number }
export interface PathModel { readonly points: readonly RoutePoint[]; readonly lengthMeters: number; readonly stationChainage: ReadonlyMap<string, number> }
export interface BranchRouteModel extends PathModel { readonly fromId: string; readonly toId: string }
export interface RouteModel extends PathModel { readonly parts: readonly PartRange[]; readonly branchRoutes?: ReadonlyMap<string, BranchRouteModel> }
export type TrainStatus = "waiting" | "moving" | "dwelling" | "turning" | "standby" | "out-of-service";
export interface TrainState {
  readonly vehicleId: string; readonly circulationId: string; readonly status: TrainStatus; readonly tripId?: string;
  readonly position?: Position; readonly locationId?: string; readonly nextStationId?: string; readonly etaSeconds?: number;
  readonly direction?: "up" | "down"; readonly destinationId?: string; readonly departureInSeconds?: number;
  readonly passengerService: boolean; readonly notice?: string; readonly lineId?: LineId; readonly lineColor?: string;
}
