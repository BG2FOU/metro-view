export type ClockRate = 0 | 1 | 5 | 10 | 30 | 60;
export interface SimulationSnapshot { readonly mode: "realtime" | "simulation"; readonly now: Date; readonly rate: ClockRate }

export class SimulationClock {
  #mode: "realtime" | "simulation" = "realtime"; #rate: ClockRate = 1; #baseEpoch: number; #baseMonotonic: number;
  constructor(private readonly wallNow: () => number = Date.now, private readonly monotonicNow: () => number = () => performance.now()) { this.#baseEpoch = wallNow(); this.#baseMonotonic = monotonicNow(); }
  snapshot(): SimulationSnapshot { if (this.#mode === "realtime") return { mode: "realtime", now: new Date(this.wallNow()), rate: 1 }; return { mode: "simulation", now: new Date(this.#baseEpoch + (this.monotonicNow() - this.#baseMonotonic) * this.#rate), rate: this.#rate }; }
  setTime(now: Date): void { this.#mode = "simulation"; this.#baseEpoch = now.getTime(); this.#baseMonotonic = this.monotonicNow(); }
  setRate(rate: ClockRate): void { const current = this.snapshot().now.getTime(); this.#mode = "simulation"; this.#baseEpoch = current; this.#baseMonotonic = this.monotonicNow(); this.#rate = rate; }
  returnToRealtime(): void { this.#mode = "realtime"; this.#rate = 1; }
}
