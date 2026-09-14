import { createSampleTimetable } from "./sample-timetable.ts";

export const LA_BASE_TIMETABLE = createSampleTimetable({ scheduleId: "LA-BASE", stations: ["a-terminal", "a-museum-reserved", "a-central", "a-riverside", "a-harbor"], intervalMinutes: 20 });
