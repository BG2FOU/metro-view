import { createSampleTimetable } from "./sample-timetable.ts";

export const LB_WEEKEND_NEXT_TIMETABLE = createSampleTimetable({ scheduleId: "LB-WEEKEND-NEXT", stations: ["b-west", "b-garden", "b-central", "b-tech-park", "b-east"], intervalMinutes: 24, offsetSeconds: 90 });
