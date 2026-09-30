import { createSampleTimetable } from "./sample-timetable.ts";

export const LB_SPECIAL_TIMETABLE = createSampleTimetable({ scheduleId: "LB-SPECIAL", stations: ["b-west", "b-garden", "b-central", "b-tech-park", "b-east"], intervalMinutes: 12, offsetSeconds: 90 });
