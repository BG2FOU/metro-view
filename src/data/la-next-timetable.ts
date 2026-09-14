import { createSampleTimetable } from "./sample-timetable.ts";

export const LA_NEXT_TIMETABLE = createSampleTimetable({ scheduleId: "LA-NEXT", stations: ["a-terminal", "a-museum-reserved", "a-central", "a-riverside", "a-harbor"], intervalMinutes: 15, offsetSeconds: 120 });
