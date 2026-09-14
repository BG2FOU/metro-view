import type { BaseLayerController, BaseMapMode } from "../map/base-layer-control.ts";
import type { LineId } from "../domain/model.ts";

export type TrainViewMode = "popup" | "sidebar";

export function mountMapControls(container: HTMLElement, layers: BaseLayerController, onTrainViewChange: (mode: TrainViewMode) => void, onLineVisibilityChange?: (lineId: LineId, visible: boolean) => void): () => void {
  container.innerHTML = `<fieldset class="line-visibility"><legend>线路显示</legend><label><input type="checkbox" data-line-visibility="MV-LA" checked>示例 A 线</label><label><input type="checkbox" data-line-visibility="MV-LB" checked>示例 B 线</label></fieldset><div class="base-map-buttons" role="group" aria-label="底图类型"><button type="button" data-map-mode="standard" aria-pressed="true">标准地图</button><button type="button" data-map-mode="satellite" aria-pressed="false">卫星地图</button></div><label class="road-net-toggle"><input type="checkbox" data-road-net checked disabled>叠加路网</label><button type="button" data-train-view aria-pressed="false">列车信息：弹窗</button>`;
  const roadNet = container.querySelector<HTMLInputElement>("[data-road-net]")!;
  const trainView = container.querySelector<HTMLButtonElement>("[data-train-view]")!;
  const lineVisibility = [...container.querySelectorAll<HTMLInputElement>("[data-line-visibility]")];

  const setMapMode = (mode: BaseMapMode): void => {
    layers.setMode(mode);
    container.querySelectorAll<HTMLButtonElement>("[data-map-mode]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.mapMode === mode)));
    roadNet.disabled = mode === "standard";
  };
  const onClick = (event: Event): void => {
    const target = event.target as HTMLElement;
    const mapMode = target.closest<HTMLButtonElement>("[data-map-mode]")?.dataset.mapMode as BaseMapMode | undefined;
    if (mapMode) setMapMode(mapMode);
    if (target.closest("[data-train-view]")) {
      const mode: TrainViewMode = trainView.getAttribute("aria-pressed") === "true" ? "popup" : "sidebar";
      trainView.setAttribute("aria-pressed", String(mode === "sidebar"));
      trainView.textContent = `列车信息：${mode === "sidebar" ? "侧栏" : "弹窗"}`;
      onTrainViewChange(mode);
    }
  };
  const onRoadNetChange = (): void => layers.setRoadNetVisible(roadNet.checked);
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
  roadNet.addEventListener("change", onRoadNetChange);
  lineVisibility.forEach((checkbox) => checkbox.addEventListener("change", onLineVisibilityChangeEvent));
  return () => { container.removeEventListener("click", onClick); roadNet.removeEventListener("change", onRoadNetChange); lineVisibility.forEach((checkbox) => checkbox.removeEventListener("change", onLineVisibilityChangeEvent)); };
}
