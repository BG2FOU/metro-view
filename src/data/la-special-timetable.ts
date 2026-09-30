import { createSampleTimetable } from "./sample-timetable.ts";

export const LA_SPECIAL_TIMETABLE = createSampleTimetable({ scheduleId: "LA-SPECIAL", stations: ["a-terminal", "a-museum-reserved", "a-central", "a-riverside", "a-harbor"], intervalMinutes: 10, offsetSeconds: 180 });
