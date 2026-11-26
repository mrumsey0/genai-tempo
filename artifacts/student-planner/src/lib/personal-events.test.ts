import { test } from "node:test";
import assert from "node:assert/strict";
import { editPersonalOccurrence, personalOccurrences, validatePersonalEvent, type PersonalEvent } from "./personal-events.ts";
import { calendarEvents, loadCalendars, saveCalendars, type AddedCalendar } from "./calendars.ts";
import { scheduleAssignment } from "./planner.ts";

const base: PersonalEvent = { id: "one", title: "Class", start: "2026-10-05T09:00", end: "2026-10-05T10:00", repeat: "none" };
const from = new Date("2026-10-05T00:00"), through = new Date("2026-10-12T00:00");
test("one-time events only appear in their overlapping window", () => {
  assert.equal(personalOccurrences([base], from, through).length, 1);
  assert.equal(personalOccurrences([base], through, new Date("2026-10-19T00:00")).length, 0);
  assert.equal(personalOccurrences([{ ...base, start: "2026-10-04T23:00", end: "2026-10-05T02:00" }], from, through).length, 1);
});
test("daily, weekdays, weekly and inclusive recurrence end dates", () => {
  assert.equal(personalOccurrences([{ ...base, repeat: "daily" }], from, through).length, 7);
  assert.equal(personalOccurrences([{ ...base, repeat: "weekdays" }], from, through).length, 5);
  assert.equal(personalOccurrences([{ ...base, repeat: "weekly" }], from, through).length, 1);
  assert.equal(personalOccurrences([{ ...base, repeat: "daily", until: "2026-10-07" }], from, through).length, 3);
});
test("monthly recurrence skips months without the selected date", () => {
  const events = personalOccurrences([{ ...base, start: "2026-01-31T09:00", end: "2026-01-31T10:00", repeat: "monthly" }],
    new Date("2026-01-01T00:00"), new Date("2026-04-01T00:00"));
  assert.deepEqual(events.map((e) => e.occurrenceDate), ["2026-01-31", "2026-03-31"]);
});
test("weekly repeats expand only selected days with stable identities across weeks", () => {
  const series: PersonalEvent = { ...base, repeat: "weekly", weekdays: [3, 1] };
  const events = personalOccurrences([series], from, new Date("2026-10-19T00:00"));
  assert.deepEqual(events.map((e) => e.occurrenceDate), ["2026-10-05", "2026-10-07", "2026-10-12", "2026-10-14"]);
  assert.ok(events.every((e) => e.personalEventId === base.id &&
    e.id === `personal-${base.id}-${e.occurrenceDate}` &&
    new Date(e.start).getHours() === 9 && new Date(e.end).getHours() === 10));
  assert.deepEqual(personalOccurrences([series], through, new Date("2026-10-19T00:00")), events.slice(2));
  assert.deepEqual(series.weekdays, [3, 1]);
});
test("selected days respect the start boundary, weekends, and inclusive end dates", () => {
  const series: PersonalEvent = { ...base, start: "2026-10-06T09:00", end: "2026-10-06T10:00",
    repeat: "weekly", weekdays: [0, 1, 3, 6], until: "2026-10-11" };
  assert.deepEqual(personalOccurrences([series], from, new Date("2026-10-19T00:00")).map((e) => e.occurrenceDate),
    ["2026-10-07", "2026-10-10", "2026-10-11"]);
  assert.equal(personalOccurrences([{ ...series, until: "2026-10-06" }], from, through).length, 0);
  assert.deepEqual(personalOccurrences([{ ...series, until: "2026-10-07" }], from, through).map((e) => e.occurrenceDate),
    ["2026-10-07"]);
  assert.throws(() => validatePersonalEvent({ ...series, until: "2026-10-05" }), /repeat end date/);
  assert.throws(() => validatePersonalEvent({ ...series, until: "2027-02-30" }), /repeat end date/);
});
test("malformed weekday selections are rejected without treating missing legacy selections as invalid", () => {
  for (const weekdays of [[], null, "Monday", [1, 1], [-1], [7], [1.5], ["1"], [NaN]]) {
    assert.throws(() => validatePersonalEvent({ ...base, repeat: "weekly", weekdays } as PersonalEvent), /weekday/);
  }
  validatePersonalEvent({ ...base, repeat: "weekly" });
  assert.deepEqual(personalOccurrences([{ ...base, repeat: "weekly" }], from, new Date("2026-10-19T00:00"))
    .map((e) => e.occurrenceDate), ["2026-10-05", "2026-10-12"]);
});
test("selected-day overnight repeats overlap windows and keep local hours across daylight saving", () => {
  const series: PersonalEvent = { ...base, start: "2026-10-30T23:00", end: "2026-10-31T02:00",
    repeat: "weekly", weekdays: [5, 1], until: "2026-11-02" };
  const events = personalOccurrences([series], new Date("2026-10-31T00:00"), new Date("2026-11-04T00:00"));
  assert.deepEqual(events.map((e) => e.occurrenceDate), ["2026-10-30", "2026-11-02"]);
  assert.ok(events.every((e) => new Date(e.start).getHours() === 23 && new Date(e.end).getHours() === 2));
});
test("selected-day series preserve individual moves and deletions when the selected days change", () => {
  const series: PersonalEvent = { ...base, repeat: "weekly", weekdays: [1, 3], until: "2026-10-14" };
  const moved = editPersonalOccurrence(series, "2026-10-07", {
    ...base, title: "Moved class", start: "2026-10-08T11:00", end: "2026-10-08T12:00",
  });
  const events = personalOccurrences([{ ...moved, excludedDates: ["2026-10-12"] }], from, new Date("2026-10-19T00:00"));
  assert.deepEqual(events.map((e) => e.occurrenceDate).sort(), ["2026-10-05", "2026-10-07", "2026-10-14"]);
  assert.equal(events.find((e) => e.occurrenceDate === "2026-10-07")?.title, "Moved class");
  const changedDays = personalOccurrences([{ ...moved, weekdays: [5] }], from, through);
  assert.deepEqual(changedDays.map((e) => e.occurrenceDate).sort(), ["2026-10-07", "2026-10-09"]);
  assert.throws(() => editPersonalOccurrence(series, "2026-10-06", base), /no longer/);
});
test("old and selected-day events survive browser storage together and block only the correct times", () => {
  let raw: string | null = null;
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem: () => raw, setItem: (_: string, value: string) => { raw = value; },
  } });
  const series: PersonalEvent = { ...base, repeat: "weekly", weekdays: [1, 3], until: "2026-10-07" };
  const calendars: AddedCalendar[] = [{ id: "mine", name: "My events", type: "personal", events: [
    series, { ...base, id: "legacy", start: "2026-10-09T09:00", end: "2026-10-09T10:00", repeat: "weekly" },
  ] }];
  saveCalendars(calendars);
  const restored = loadCalendars();
  assert.equal(restored.error, undefined);
  assert.deepEqual(restored.calendars, calendars);
  const conflicts = calendarEvents(restored.calendars, from, new Date("2026-10-19T00:00"));
  for (const [day, hour] of [["2026-10-05", 10], ["2026-10-06", 9], ["2026-10-07", 10],
    ["2026-10-09", 10], ["2026-10-12", 9]] as const) {
    const assignment = scheduleAssignment({
      id: day, title: "Read", description: "", estimatedMinutes: 60, due: new Date(`${day}T11:00`).toISOString(),
    }, [], new Date(`${day}T09:00`), conflicts);
    assert.equal(new Date(assignment.blocks[0].start).getHours(), hour, day);
  }
});
test("occurrence deletion preserves other dates and stable occurrence ids", () => {
  const event = { ...base, repeat: "daily" as const };
  const all = personalOccurrences([event], from, through);
  const filtered = personalOccurrences([{ ...event, excludedDates: ["2026-10-06"] }], from, through);
  assert.equal(filtered.length, 6);
  assert.deepEqual(filtered.map((e) => e.id), all.filter((e) => e.occurrenceDate !== "2026-10-06").map((e) => e.id));
});
test("recurrence preserves local hours across daylight saving boundaries", () => {
  const events = personalOccurrences([{ ...base, start: "2026-10-31T09:00", end: "2026-10-31T10:00", repeat: "daily" }],
    new Date("2026-10-31T00:00"), new Date("2026-11-03T00:00"));
  assert.equal(events.length, 3);
  assert.ok(events.every((e) => new Date(e.start).getHours() === 9 && new Date(e.end).getHours() === 10));
});
test("moving one occurrence into another week preserves its identity and every other occurrence", () => {
  const series: PersonalEvent = { ...base, repeat: "daily", until: "2026-10-11", location: "Library" };
  const before = personalOccurrences([series], from, through);
  const moved = editPersonalOccurrence(series, "2026-10-06", {
    ...base, title: "Moved class", start: "2026-10-14T11:00", end: "2026-10-14T12:30",
  });
  assert.deepEqual(personalOccurrences([moved], from, through), before.filter((e) => e.occurrenceDate !== "2026-10-06"));
  const destination = personalOccurrences([moved], through, new Date("2026-10-19T00:00"));
  assert.equal(destination.length, 1);
  assert.equal(destination[0].id, before[1].id);
  assert.equal(destination[0].occurrenceDate, "2026-10-06");
  assert.equal(destination[0].title, "Moved class");
  assert.equal(destination[0].location, undefined);
  assert.equal(new Date(destination[0].start).getHours(), 11);
  assert.equal(new Date(destination[0].end).getMinutes(), 30);
  assert.equal(series.occurrenceEdits, undefined);
  assert.equal(series.start, base.start);
});
test("moved occurrences appear before the series starts and across overlapping windows", () => {
  const moved = editPersonalOccurrence({ ...base, repeat: "weekly" }, "2026-10-12", {
    ...base, start: "2026-10-03T23:00", end: "2026-10-05T02:00",
  });
  assert.equal(personalOccurrences([moved], new Date("2026-10-03T00:00"), from).length, 1);
  assert.equal(personalOccurrences([moved], from, through).length, 2);
  assert.equal(personalOccurrences([moved], through, new Date("2026-10-19T00:00")).length, 0);
});
test("re-editing, deleting and updating a series preserve occurrence exception semantics", () => {
  const series: PersonalEvent = { ...base, repeat: "weekly" };
  const first = editPersonalOccurrence(series, "2026-10-05", { ...base, start: "2026-10-06T12:00", end: "2026-10-06T13:00" });
  const second = editPersonalOccurrence(first, "2026-10-05", { ...base, title: "Changed again", location: "Gym" });
  assert.equal(second.occurrenceEdits?.length, 1);
  assert.equal(personalOccurrences([second], from, through)[0].title, "Changed again");
  assert.equal(personalOccurrences([{ ...second, excludedDates: ["2026-10-05"] }], from, through).length, 0);
  const changedSeries = { ...second, title: "New series name" };
  assert.equal(personalOccurrences([changedSeries], from, through)[0].title, "Changed again");
  assert.equal(personalOccurrences([changedSeries], through, new Date("2026-10-19T00:00"))[0].title, "New series name");
  assert.throws(() => editPersonalOccurrence(base, "2026-10-05", base), /does not repeat/);
  assert.throws(() => editPersonalOccurrence(series, "2026-10-06", base), /no longer/);
  assert.throws(() => editPersonalOccurrence(series, "2026-10-05", { ...base, end: base.start }), /end after/);
});
test("occurrence changes survive calendar reloads and block only their moved time", () => {
  let raw: string | null = null;
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem: () => raw, setItem: (_: string, value: string) => { raw = value; },
  } });
  const moved = editPersonalOccurrence({ ...base, repeat: "weekly" }, "2026-10-05", {
    ...base, start: "2026-10-14T09:00", end: "2026-10-14T10:00",
  });
  saveCalendars([{ id: "mine", name: "My events", type: "personal", events: [moved] }]);
  const restored = loadCalendars();
  assert.equal(restored.error, undefined);
  const conflicts = calendarEvents(restored.calendars, from, new Date("2026-10-19T00:00"));
  const schedule = (day: string) => scheduleAssignment({
    id: "read", title: "Read", description: "", estimatedMinutes: 60, due: new Date(`${day}T11:00`).toISOString(),
  }, [], new Date(`${day}T09:00`), conflicts);
  assert.equal(new Date(schedule("2026-10-05").blocks[0].start).getHours(), 9);
  assert.equal(new Date(schedule("2026-10-14").blocks[0].start).getHours(), 10);
  assert.equal(new Date(schedule("2026-10-12").blocks[0].start).getHours(), 10);
});
test("malformed saved occurrence changes are rejected", () => {
  const valid = { occurrenceDate: "2026-10-05", title: "Moved", start: base.start, end: base.end };
  for (const occurrenceEdits of [null, [null], [{ ...valid, occurrenceDate: "bad" }],
    [{ ...valid, end: base.start }], [valid, valid]]) {
    assert.throws(() => validatePersonalEvent({ ...base, occurrenceEdits } as PersonalEvent));
  }
});
test("invalid input is rejected", () => {
  for (const value of [{ ...base, title: "" }, { ...base, end: base.start }, { ...base, start: "no" }, { ...base, until: "2026-10-04" }]) {
    assert.throws(() => validatePersonalEvent(value));
  }
});
test("personal calendars persist with old calendar formats and block scheduling", () => {
  let raw: string | null = null;
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem: () => raw, setItem: (_: string, value: string) => { raw = value; },
  } });
  const calendars: AddedCalendar[] = [{ id: "mine", name: "My events", type: "personal", events: [base] }, { id: "sample", name: "Sample", type: "sample" }];
  saveCalendars(calendars);
  assert.deepEqual(loadCalendars().calendars, calendars);
  const conflicts = calendarEvents(calendars.slice(0, 1), from, through);
  const assignment = scheduleAssignment({ id: "a", title: "Read", description: "", estimatedMinutes: 60, due: new Date("2026-10-05T11:00").toISOString() },
    [], new Date("2026-10-05T09:00"), conflicts);
  assert.equal(new Date(assignment.blocks[0]!.start).getHours(), 10);
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { setItem: () => { throw new Error("full"); } } });
  assert.throws(() => saveCalendars([]), /Nothing was changed/);
});
