import type { ActiveSchedules, ScheduleSelectionMode } from "../domain/schedule-selection.ts";

export interface ScheduleControls { update(mode: ScheduleSelectionMode, schedules: ActiveSchedules): void; destroy(): void }
const MODE_LABELS: Readonly<Record<ScheduleSelectionMode, string>> = { auto: "自动切换", legacy: "基础示例", next: "下一版示例" };

export function mountScheduleControls(container: HTMLElement, initialMode: ScheduleSelectionMode, onChange: (mode: ScheduleSelectionMode) => void): ScheduleControls {
  container.innerHTML = `
    <section class="schedule-picker" aria-label="运行图选择">
      <label class="schedule-auto" title="示例切换时间：2030/1/1；此日期和全部数据均为虚构演示"><input type="checkbox" data-schedule-auto>自动切换</label>
      <label class="schedule-generation"><span>运行图类型</span><select data-schedule-generation aria-label="运行图类型"><option value="legacy">基础示例</option><option value="next">下一版示例</option></select></label>
    </section>
    <section class="schedule-current" aria-live="polite"><span>当前生效</span><strong data-schedule-current>正在加载…</strong><small data-schedule-rule></small></section>
    <p class="schedule-note">自动模式按当前系统时间／模拟时间判断；工作日与双休日示例图按服务时区自动选择。手动选择会保存在本浏览器，可随时改回自动。</p>`;
  const automatic = container.querySelector<HTMLInputElement>("[data-schedule-auto]")!; const generation = container.querySelector<HTMLSelectElement>("[data-schedule-generation]")!; const current = container.querySelector<HTMLElement>("[data-schedule-current]")!; const rule = container.querySelector<HTMLElement>("[data-schedule-rule]")!;
  const handleAutomaticChange = (): void => onChange(automatic.checked ? "auto" : generation.value as ScheduleSelectionMode); const handleGenerationChange = (): void => onChange(generation.value as ScheduleSelectionMode);
  automatic.addEventListener("change", handleAutomaticChange); generation.addEventListener("change", handleGenerationChange);
  const update = (mode: ScheduleSelectionMode, schedules: ActiveSchedules): void => { automatic.checked = mode === "auto"; generation.value = mode === "auto" ? schedules.generation : mode; current.textContent = `示例 A 线 ${schedules.lineA} · 示例 B 线 ${schedules.lineB}`; rule.textContent = `${MODE_LABELS[mode]} · ${schedules.calendar === "weekend" ? "双休日" : "工作日"}`; };
  update(initialMode, { generation: "legacy", lineA: "LA-BASE", lineB: "LB-WEEKDAY-BASE", calendar: "weekday" });
  return { update, destroy: () => { automatic.removeEventListener("change", handleAutomaticChange); generation.removeEventListener("change", handleGenerationChange); } };
}
