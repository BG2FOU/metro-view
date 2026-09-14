import { createSampleTimetable } from "./sample-timetable.ts";

export const LB_WEEKDAY_NEXT_TIMETABLE = createSampleTimetable({ scheduleId: "LB-WEEKDAY-NEXT", stations: ["b-west", "b-garden", "b-central", "b-tech-park", "b-east"], intervalMinutes: 15, offsetSeconds: 90 });
