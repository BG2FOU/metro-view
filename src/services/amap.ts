import AMapLoader from "@amap/amap-jsapi-loader";
import type { RuntimeConfig } from "../config/runtime.ts";

export interface Overlay { setMap(map: MapInstance | null): void }
export interface MarkerInstance extends Overlay { setPosition(position: readonly [number, number]): void; setContent?(content: string | HTMLElement): void; on?(event: string, handler: () => void): void }
export interface MapInstance { add(overlays: readonly Overlay[] | Overlay): void; remove(overlays: readonly Overlay[] | Overlay): void; getLayers(): readonly Overlay[]; setLayers(layers: readonly Overlay[]): void; setFitView(overlays?: readonly Overlay[]): void; getZoom?(): number; setZoom?(zoom: number): void; on?(event: string, handler: () => void): void; off?(event: string, handler: () => void): void; destroy(): void }
type Constructor<T> = new (options: Record<string, unknown>) => T;
export interface InfoWindowInstance { open(map: MapInstance, position: readonly [number, number]): void; close(): void; setContent(content: string): void }
export interface AMapApi {
  Map: new (container: HTMLElement, options: Record<string, unknown>) => MapInstance;
  Polyline: Constructor<Overlay>;
  Marker: Constructor<MarkerInstance>;
  InfoWindow: Constructor<InfoWindowInstance>;
  TileLayer: { Satellite: Constructor<Overlay>; RoadNet: Constructor<Overlay> };
}

declare global { interface Window { _AMapSecurityConfig?: { serviceHost?: string; securityJsCode?: string } } }
let promise: Promise<AMapApi> | undefined;
export function loadAmap(config: RuntimeConfig): Promise<AMapApi> {
  if (!config.amapKey) return Promise.reject(new Error("未配置高德 Web Key"));
  if (config.authMode === "proxy") { if (!config.serviceHost) return Promise.reject(new Error("未配置高德安全代理")); window._AMapSecurityConfig = { serviceHost: config.serviceHost }; }
  else if (config.securityJsCode) window._AMapSecurityConfig = { securityJsCode: config.securityJsCode };
  else delete window._AMapSecurityConfig;
  promise ??= AMapLoader.load({ key: config.amapKey, version: "2.0", plugins: [] }).then((value) => value as unknown as AMapApi);
  return promise;
}
