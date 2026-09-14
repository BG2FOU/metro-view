import type { LineData } from "../domain/model.ts";
import type { AMapApi, MapInstance, Overlay } from "../services/amap.ts";
const CASING: Record<string, string> = { "#E54B4B": "#7A2830", "#3B82F6": "#1E3A5F" };
export type RouteLayerController = (() => void) & { setVisible(visible: boolean): void };

export function createRouteLayer(api: AMapApi, map: MapInstance, data: LineData): RouteLayerController {
  const overlays: Overlay[] = [...data.parts, ...(data.branchParts ?? [])].flatMap((part) => {
    const common = { path: part.coordinates, lineJoin: "round", lineCap: "round" };
    if (part.structureType === "elevated") return [
      new api.Polyline({ ...common, strokeColor: data.lineColor, strokeWeight: 10, strokeOpacity: 0.95, zIndex: 49, extData: { partId: part.id, lineId: data.lineId, structureType: part.structureType, role: "rails" } }),
      new api.Polyline({ ...common, strokeColor: "#FFF6F6", strokeWeight: 3, strokeOpacity: 0.96, zIndex: 50, extData: { partId: part.id, structureType: part.structureType, role: "track-gap" } }),
    ];
    return [
      new api.Polyline({ ...common, strokeColor: CASING[data.lineColor] ?? "#3D2542", strokeWeight: 10, strokeOpacity: 0.72, zIndex: 47, extData: { partId: part.id, lineId: data.lineId, structureType: part.structureType, role: "tunnel-casing" } }),
      new api.Polyline({ ...common, strokeColor: data.lineColor, strokeWeight: 6, strokeOpacity: 0.94, zIndex: 48, extData: { partId: part.id, lineId: data.lineId, structureType: part.structureType, role: "tunnel-core" } }),
    ];
  });
  map.add(overlays);
  const destroy = (() => map.remove(overlays)) as RouteLayerController;
  destroy.setVisible = (visible) => overlays.forEach((overlay) => overlay.setMap(visible ? map : null));
  return destroy;
}
