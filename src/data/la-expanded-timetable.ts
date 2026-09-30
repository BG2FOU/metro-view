import { createSampleTimetable } from "./sample-timetable.ts";

export const LA_EXPANDED_TIMETABLE = createSampleTimetable({ scheduleId: "LA-EXPANDED", stations: ["a-terminal", "a-museum-reserved", "a-central", "a-riverside", "a-harbor"], intervalMinutes: 12, offsetSeconds: 60 });
