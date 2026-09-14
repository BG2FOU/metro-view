import flatpickrModule from "flatpickr";
import { Mandarin } from "flatpickr/dist/l10n/zh.js";
import { serviceDaySecondsAt } from "../domain/timetable.ts";
import type { ScheduleGeneration } from "../domain/schedule-selection.ts";
import { SimulationClock, type ClockRate } from "../services/simulation-clock.ts";
import { formatServiceDateTimeLocal, parseServiceDateTimeLocal } from "../services/service-time.ts";
import { isServiceWeekend, servicePeriodsForDate, type SimulationPeriodKind } from "./simulation-periods.ts";

const DAY_SECONDS = 24 * 3600;
const flatpickr = (typeof flatpickrModule === "function" ? flatpickrModule : flatpickrModule.default) as typeof flatpickrModule.default;
type FlatpickrInstance = Exclude<ReturnType<typeof flatpickr>, unknown[]>;
const rates: ClockRate[] = [1, 5, 10, 30, 60];
const periodLegend: ReadonlyArray<{ kind: SimulationPeriodKind; label: string }> = [
  { kind: "peak", label: "高峰" },
  { kind: "flat", label: "平峰" },
  { kind: "off-peak", label: "低峰" },
  { kind: "transition", label: "过渡" },
  { kind: "non-service", label: "非运营" },
];

function clockText(totalSeconds: number, includeSeconds = true): string {
  const seconds = Math.max(0, Math.min(DAY_SECONDS - 1, Math.round(totalSeconds)));
  const pad = (value: number): string => String(value).padStart(2, "0");
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds / 60) % 60;
  const remainder = seconds % 60;
  return includeSeconds ? `${pad(hours)}:${pad(minutes)}:${pad(remainder)}` : `${pad(hours)}:${pad(minutes)}`;
}

function pickerText(value: Date): string {
  return formatServiceDateTimeLocal(value).replace("T", " ");
}

export function mountSimulationControls(
  container: HTMLElement,
  clock: SimulationClock,
  onChange: () => void,
  scheduleGenerationAt: (now: Date) => ScheduleGeneration = () => "legacy",
): () => void {
  container.innerHTML = `
    <section class="simulation-picker" aria-labelledby="simulation-picker-label">
      <label id="simulation-picker-label" for="simulation-datetime">精确选择日期和时间</label>
      <input id="simulation-datetime" type="text" inputmode="numeric" autocomplete="off" data-time-input>
    </section>
    <section class="simulation-console" aria-label="运行控制台">
      <div class="simulation-readout">
        <div class="simulation-clock-copy">
          <span class="simulation-mode" data-clock-label>实时推演</span>
          <time data-clock-time>--:--:--</time>
          <small data-clock-date>----</small>
          <small data-service-label></small>
        </div>
        <button type="button" class="pause-button" data-pause>暂停</button>
      </div>
      <div class="simulation-actions">
        <div class="rates" aria-label="推演速度">${rates.map((rate) => `<button type="button" data-rate="${rate}" aria-pressed="false">${rate}×</button>`).join("")}</div>
        <button type="button" class="realtime-button" data-realtime>回到实时</button>
      </div>
    </section>
    <section class="simulation-timeline" aria-labelledby="simulation-timeline-label">
      <div class="timeline-heading">
        <label id="simulation-timeline-label" for="simulation-time-slider">全天时间轴</label>
        <output for="simulation-time-slider" data-slider-time>--:--:--</output>
      </div>
      <div class="timeline-shell" data-timeline>
        <output class="timeline-bubble" for="simulation-time-slider" data-timeline-bubble>--:--:--</output>
        <div class="timeline-periods" data-timeline-periods aria-hidden="true"></div>
        <input id="simulation-time-slider" type="range" min="0" max="86399" step="1" value="0" data-time-slider aria-label="选择模拟时间">
        <div class="timeline-ticks" aria-hidden="true"><span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>24:00</span></div>
      </div>
      <div class="timeline-legend" data-timeline-legend></div>
    </section>`;

  const modeLabel = container.querySelector<HTMLElement>("[data-clock-label]")!;
  const clockTime = container.querySelector<HTMLTimeElement>("[data-clock-time]")!;
  const clockDate = container.querySelector<HTMLElement>("[data-clock-date]")!;
  const serviceLabel = container.querySelector<HTMLElement>("[data-service-label]")!;
  const pauseButton = container.querySelector<HTMLButtonElement>("[data-pause]")!;
  const timeInput = container.querySelector<HTMLInputElement>("[data-time-input]")!;
  const slider = container.querySelector<HTMLInputElement>("[data-time-slider]")!;
  const sliderTime = container.querySelector<HTMLOutputElement>("[data-slider-time]")!;
  const timeline = container.querySelector<HTMLElement>("[data-timeline]")!;
  const timelineBubble = container.querySelector<HTMLOutputElement>("[data-timeline-bubble]")!;
  const timelinePeriods = container.querySelector<HTMLElement>("[data-timeline-periods]")!;
  const timelineLegend = container.querySelector<HTMLElement>("[data-timeline-legend]")!;
  let picker: FlatpickrInstance | undefined;
  let renderedPeriodKey = "";
  let draggingTimeline = false;
  let lastRunningRate: ClockRate = 1;

  const renderPeriods = (dateKey: string, generation: ScheduleGeneration): void => {
    const periodKey = `${dateKey}/${generation}`;
    if (renderedPeriodKey === periodKey) return;
    renderedPeriodKey = periodKey;
    const periods = servicePeriodsForDate(dateKey, generation);
    timelinePeriods.innerHTML = periods.map((period) => {
      const left = period.start / DAY_SECONDS * 100;
      const width = (period.end - period.start) / DAY_SECONDS * 100;
      const title = `${clockText(period.start, false)}–${period.end === DAY_SECONDS ? "24:00" : clockText(period.end, false)} ${period.label}`;
      return `<span class="period-${period.kind}" style="left:${left.toFixed(4)}%;width:${width.toFixed(4)}%" title="${title}"></span>`;
    }).join("");
    const activeKinds = new Set(periods.map((period) => period.kind));
    timelineLegend.innerHTML = periodLegend.filter(({ kind }) => activeKinds.has(kind)).map(({ kind, label }) => `<span><i class="period-${kind}"></i>${label}</span>`).join("");
  };

  const refresh = ({ syncSlider = true, syncPicker = true }: { syncSlider?: boolean; syncPicker?: boolean } = {}): void => {
    const snapshot = clock.snapshot();
    const localDateTime = formatServiceDateTimeLocal(snapshot.now);
    const dateKey = localDateTime.slice(0, 10);
    const timeText = localDateTime.slice(11);
    const seconds = serviceDaySecondsAt(snapshot.now);
    const generation = scheduleGenerationAt(snapshot.now);
    const periods = servicePeriodsForDate(dateKey, generation);
    const currentPeriod = periods.find((period) => seconds >= period.start && seconds < period.end);
    const weekend = isServiceWeekend(dateKey);
    if (snapshot.mode === "realtime") modeLabel.textContent = "实时推演";
    else if (snapshot.rate === 0) modeLabel.textContent = "模拟时间 · 已暂停";
    else modeLabel.textContent = `模拟时间 · ${snapshot.rate}×`;
    clockTime.textContent = timeText;
    clockDate.textContent = dateKey;
    serviceLabel.textContent = `${weekend ? "双休日" : "工作日"}${currentPeriod ? ` · ${currentPeriod.label}` : ""}`;
    pauseButton.textContent = snapshot.mode === "simulation" && snapshot.rate === 0 ? "继续" : "暂停";
    pauseButton.setAttribute("aria-pressed", String(snapshot.mode === "simulation" && snapshot.rate === 0));
    container.querySelectorAll<HTMLButtonElement>("[data-rate]").forEach((button) => button.setAttribute("aria-pressed", String(snapshot.mode === "simulation" && snapshot.rate === Number(button.dataset.rate))));
    renderPeriods(dateKey, generation);
    if (syncSlider && !draggingTimeline) slider.value = String(seconds);
    const shownSeconds = syncSlider && !draggingTimeline ? seconds : Number(slider.value);
    const shownTime = clockText(shownSeconds);
    sliderTime.textContent = shownTime;
    timelineBubble.textContent = shownTime;
    timeline.style.setProperty("--timeline-position", `${shownSeconds / (DAY_SECONDS - 1) * 100}%`);
    if (syncPicker && picker && !picker.isOpen && document.activeElement !== timeInput) picker.setDate(pickerText(snapshot.now), false, "Y-m-d H:i:S");
  };

  const applyPickerValue = (value: string): void => {
    const selectedTime = parseServiceDateTimeLocal(value.trim().replace(" ", "T"));
    if (!selectedTime) return;
    clock.setTime(selectedTime);
    refresh({ syncPicker: false });
    onChange();
  };

  picker = flatpickr(timeInput, {
    allowInput: true,
    defaultDate: pickerText(clock.snapshot().now),
    disableMobile: true,
    enableSeconds: true,
    enableTime: true,
    locale: Mandarin,
    minuteIncrement: 1,
    static: true,
    time_24hr: true,
    dateFormat: "Y-m-d H:i:S",
    onChange: (_selectedDates, value) => applyPickerValue(value),
  });

  const handleClick = (event: Event): void => {
    const target = event.target as HTMLElement;
    const rateValue = target.closest<HTMLElement>("[data-rate]")?.dataset.rate;
    if (rateValue !== undefined) {
      const rate = Number(rateValue) as ClockRate;
      lastRunningRate = rate;
      clock.setRate(rate);
    } else if (target.closest("[data-pause]")) {
      const snapshot = clock.snapshot();
      if (snapshot.mode === "simulation" && snapshot.rate === 0) clock.setRate(lastRunningRate);
      else {
        if (snapshot.rate > 0) lastRunningRate = snapshot.rate;
        clock.setRate(0);
      }
    } else if (target.closest("[data-realtime]")) clock.returnToRealtime();
    else return;
    refresh();
    onChange();
  };

  const applySliderValue = (): void => {
    const currentDate = formatServiceDateTimeLocal(clock.snapshot().now).slice(0, 10);
    const selectedTime = parseServiceDateTimeLocal(`${currentDate}T${clockText(Number(slider.value))}`);
    if (!selectedTime) return;
    clock.setTime(selectedTime);
    refresh({ syncSlider: false });
    onChange();
  };
  const handleSliderInput = (): void => { draggingTimeline = true; applySliderValue(); };
  const startSliderInput = (): void => { draggingTimeline = true; };
  const finishSliderInput = (): void => { draggingTimeline = false; refresh(); };
  const handleManualInput = (): void => applyPickerValue(timeInput.value);

  container.addEventListener("click", handleClick);
  timeInput.addEventListener("change", handleManualInput);
  slider.addEventListener("pointerdown", startSliderInput);
  slider.addEventListener("input", handleSliderInput);
  slider.addEventListener("change", finishSliderInput);
  slider.addEventListener("pointerup", finishSliderInput);
  refresh();
  const timer = window.setInterval(refresh, 1000);
  return () => {
    window.clearInterval(timer);
    container.removeEventListener("click", handleClick);
    timeInput.removeEventListener("change", handleManualInput);
    slider.removeEventListener("pointerdown", startSliderInput);
    slider.removeEventListener("input", handleSliderInput);
    slider.removeEventListener("change", finishSliderInput);
    slider.removeEventListener("pointerup", finishSliderInput);
    picker?.destroy();
  };
}
