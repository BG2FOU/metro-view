import type { AMapApi, MapInstance, Overlay } from "../services/amap.ts";

export type BaseMapMode = "standard" | "satellite";

export interface BaseLayerController {
  readonly mode: BaseMapMode;
  readonly roadNetVisible: boolean;
  setMode(mode: BaseMapMode): void;
  setRoadNetVisible(visible: boolean): void;
}

export function createBaseLayerController(api: AMapApi, map: MapInstance): BaseLayerController {
  const standard = [...map.getLayers()];
  const satellite = new api.TileLayer.Satellite({ zIndex: 0 });
  const roadNet = new api.TileLayer.RoadNet({ zIndex: 1 });
  let mode: BaseMapMode = "standard";
  let roadNetVisible = true;

  const apply = (): void => {
    map.setLayers(mode === "standard" ? standard : roadNetVisible ? [satellite, roadNet] : [satellite]);
  };

  return {
    get mode() { return mode; },
    get roadNetVisible() { return roadNetVisible; },
    setMode(nextMode) { mode = nextMode; apply(); },
    setRoadNetVisible(visible) { roadNetVisible = visible; apply(); },
  };
}
