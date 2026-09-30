import type { BaseLayerController, BaseMapMode } from "../map/base-layer-control.ts";
import type { LineId } from "../domain/model.ts";

export type StatusPanelMode = "hidden" | "visible";

export function mountMapControls(container: HTMLElement, layers: BaseLayerController | undefined, onStatusPanelChange: (mode: StatusPanelMode) => void, onLineVisibilityChange?: (lineId: LineId, visible: boolean) => void, onDisplayModeChange?: (mode: "map" | "network") => void): () => void {
  container.innerHTML = `<fieldset class="line-visibility"><legend>线路显示</legend><label><input type="checkbox" data-line-visibility="MV-LA" checked>A 线</label><label><input type="checkbox" data-line-visibility="MV-LB" checked>B 线</label></fieldset><div class="view-mode-buttons" role="group" aria-label="地图视图"><button type="button" data-view-mode="map" aria-pressed="true">实际地图</button><button type="button" data-view-mode="network" aria-pressed="false">线网图</button></div>${layers ? `<div class="base-map-buttons" role="group" aria-label="底图类型"><button type="button" data-map-mode="standard" aria-pressed="true">标准地图</button><button type="button" data-map-mode="satellite" aria-pressed="false">卫星地图</button></div><label class="road-net-toggle"><input type="checkbox" data-road-net checked disabled>叠加路网</label>` : `<p class="dialog-error">实际地图暂不可用；仍可切换查看线网图。</p>`}<button type="button" data-train-view aria-pressed="false">列车状态侧栏：隐藏</button>`;
  const roadNet = container.querySelector<HTMLInputElement>("[data-road-net]");
  const trainView = container.querySelector<HTMLButtonElement>("[data-train-view]")!;
  const lineVisibility = [...container.querySelectorAll<HTMLInputElement>("[data-line-visibility]")];
  const viewButtons = [...container.querySelectorAll<HTMLButtonElement>("[data-view-mode]")];

  const setMapMode = (mode: BaseMapMode): void => {
    layers?.setMode(mode);
    container.querySelectorAll<HTMLButtonElement>("[data-map-mode]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.mapMode === mode)));
    if (roadNet) roadNet.disabled = mode === "standard";
  };
  const setDisplayMode = (mode: "map" | "network"): void => {
    viewButtons.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.viewMode === mode)));
    onDisplayModeChange?.(mode);
  };
  const onClick = (event: Event): void => {
    const target = event.target as HTMLElement;
    const mapMode = target.closest<HTMLButtonElement>("[data-map-mode]")?.dataset.mapMode as BaseMapMode | undefined;
    if (mapMode) setMapMode(mapMode);
    const displayMode = target.closest<HTMLButtonElement>("[data-view-mode]")?.dataset.viewMode;
    if (displayMode === "map" || displayMode === "network") setDisplayMode(displayMode);
    if (target.closest("[data-train-view]")) {
      const mode: StatusPanelMode = trainView.getAttribute("aria-pressed") === "true" ? "hidden" : "visible";
      trainView.setAttribute("aria-pressed", String(mode === "visible"));
      trainView.textContent = `列车状态侧栏：${mode === "visible" ? "显示" : "隐藏"}`;
      onStatusPanelChange(mode);
    }
  };
  const onRoadNetChange = (): void => { if (roadNet) layers?.setRoadNetVisible(roadNet.checked); };
  const onLineVisibilityChangeEvent = (event: Event): void => {
    const checkbox = event.currentTarget as HTMLInputElement;
    if (!checkbox.checked && lineVisibility.every((item) => !item.checked)) {
      checkbox.checked = true;
      return;
    }
    const lineId = checkbox.dataset.lineVisibility as LineId | undefined;
    if (lineId) onLineVisibilityChange?.(lineId, checkbox.checked);
  };
  container.addEventListener("click", onClick);
  roadNet?.addEventListener("change", onRoadNetChange);
  lineVisibility.forEach((checkbox) => checkbox.addEventListener("change", onLineVisibilityChangeEvent));
  return () => { container.removeEventListener("click", onClick); roadNet?.removeEventListener("change", onRoadNetChange); lineVisibility.forEach((checkbox) => checkbox.removeEventListener("change", onLineVisibilityChangeEvent)); };
}
