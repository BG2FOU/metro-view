import { createSampleTimetable } from "./sample-timetable.ts";

export const LB_WEEKDAY_BASE_TIMETABLE = createSampleTimetable({ scheduleId: "LB-WEEKDAY-BASE", stations: ["b-west", "b-garden", "b-central", "b-tech-park", "b-east"], intervalMinutes: 20 });
