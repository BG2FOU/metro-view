import type { ActiveSchedules, LineAScheduleId, LineBScheduleId, ScheduleSelection } from "../domain/schedule-selection.ts";

export interface ScheduleControls {
  update(selection: ScheduleSelection, schedules: ActiveSchedules): void;
  destroy(): void;
}

export function mountScheduleControls(
  container: HTMLElement,
  initialSelection: ScheduleSelection,
  onChange: (selection: ScheduleSelection) => void,
): ScheduleControls {
  container.innerHTML = `
    <section class="schedule-picker" aria-label="运行图选择">
      <label class="schedule-auto"><input type="checkbox" data-schedule-auto>自动切换</label>
      <label class="schedule-line"><span>A 线列车运行图</span><select data-line-a-schedule aria-label="A 线列车运行图"><option>LA-BASE</option><option>LA-NEXT</option><option>LA-EXPANDED</option><option>LA-SPECIAL</option></select></label>
      <label class="schedule-line"><span>B 线列车运行图</span><select data-line-b-schedule aria-label="B 线列车运行图"><option>LB-WEEKDAY-BASE</option><option>LB-WEEKDAY-NEXT</option><option>LB-WEEKEND-BASE</option><option>LB-WEEKEND-NEXT</option><option>LB-SPECIAL</option></select></label>
    </section>
    <section class="schedule-current" aria-live="polite">
      <span>当前生效</span>
      <strong data-schedule-current>正在加载…</strong>
      <small data-schedule-rule></small>
    </section>`;

  const automatic = container.querySelector<HTMLInputElement>("[data-schedule-auto]")!;
  const lineA = container.querySelector<HTMLSelectElement>("[data-line-a-schedule]")!;
  const lineB = container.querySelector<HTMLSelectElement>("[data-line-b-schedule]")!;
  const current = container.querySelector<HTMLElement>("[data-schedule-current]")!;
  const rule = container.querySelector<HTMLElement>("[data-schedule-rule]")!;
  let active: ActiveSchedules = { generation: "legacy", lineA: "LA-BASE", lineB: "LB-WEEKDAY-BASE", calendar: "weekday" };
  const handleAutomaticChange = (): void => onChange(automatic.checked ? "auto" : { mode: "manual", lineA: active.lineA, lineB: active.lineB });
  const handleScheduleChange = (): void => onChange({ mode: "manual", lineA: lineA.value as LineAScheduleId, lineB: lineB.value as LineBScheduleId });
  automatic.addEventListener("change", handleAutomaticChange);
  lineA.addEventListener("change", handleScheduleChange);
  lineB.addEventListener("change", handleScheduleChange);

  const update = (selection: ScheduleSelection, schedules: ActiveSchedules): void => {
    active = schedules;
    automatic.checked = selection === "auto";
    lineA.value = typeof selection === "object" ? selection.lineA : schedules.lineA;
    lineB.value = typeof selection === "object" ? selection.lineB : schedules.lineB;
    current.textContent = `A 线 ${schedules.lineA} · B 线 ${schedules.lineB}`;
    const dateRule = schedules.calendar === "weekend" ? "双休日" : "工作日";
    rule.textContent = `${automatic.checked ? "自动切换" : "手动选择"} · ${dateRule}`;
  };
  update(initialSelection, active);

  return {
    update,
    destroy: () => {
      automatic.removeEventListener("change", handleAutomaticChange);
      lineA.removeEventListener("change", handleScheduleChange);
      lineB.removeEventListener("change", handleScheduleChange);
    },
  };
}
