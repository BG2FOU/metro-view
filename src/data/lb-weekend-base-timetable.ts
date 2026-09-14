import { createSampleTimetable } from "./sample-timetable.ts";

export const LB_WEEKEND_BASE_TIMETABLE = createSampleTimetable({ scheduleId: "LB-WEEKEND-BASE", stations: ["b-west", "b-garden", "b-central", "b-tech-park", "b-east"], intervalMinutes: 30 });
