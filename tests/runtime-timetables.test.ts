import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "vitest";
import { LA_NEXT_TIMETABLE } from "../src/data/la-next-timetable.ts";
import { LB_WEEKDAY_BASE_TIMETABLE } from "../src/data/lb-weekday-base-timetable.ts";
import { LB_WEEKDAY_NEXT_TIMETABLE } from "../src/data/lb-weekday-next-timetable.ts";
import { LB_WEEKEND_BASE_TIMETABLE } from "../src/data/lb-weekend-base-timetable.ts";
import { LB_WEEKEND_NEXT_TIMETABLE } from "../src/data/lb-weekend-next-timetable.ts";
import { runtimeTimetable } from "../scripts/prepare-runtime-timetables.ts";

test("runtime timetable files are deterministic projections of synthetic sources", async () => {
  const datasets = [
    { source: LA_NEXT_TIMETABLE, path: "src/data/runtime/la-next.json" },
    { source: LB_WEEKDAY_BASE_TIMETABLE, path: "src/data/runtime/lb-weekday-base.json" },
    { source: LB_WEEKDAY_NEXT_TIMETABLE, path: "src/data/runtime/lb-weekday-next.json" },
    { source: LB_WEEKEND_BASE_TIMETABLE, path: "src/data/runtime/lb-weekend-base.json" },
    { source: LB_WEEKEND_NEXT_TIMETABLE, path: "src/data/runtime/lb-weekend-next.json" },
  ];
  for (const { source, path } of datasets) assert.deepEqual(JSON.parse(await readFile(path, "utf8")), runtimeTimetable(source));
});
