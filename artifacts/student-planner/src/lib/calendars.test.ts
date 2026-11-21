import { test } from "node:test";
import assert from "node:assert/strict";
import { calendarEvents, importedCalendar, loadCalendars, saveCalendars, CALENDARS_KEY } from "./calendars.ts";
import { scheduleAssignment, moveSession } from "./planner.ts";

const feed = (events: string) => `BEGIN:VCALENDAR\nVERSION:2.0\nX-WR-CALNAME:My classes\n${events}\nEND:VCALENDAR`;
const event = (extra = "") => `BEGIN:VEVENT\nUID:class-1\nDTSTART:20261005T090000Z\nDTEND:20261005T100000Z\nSUMMARY:Imported class\n${extra}\nEND:VEVENT`;
const from = new Date("2026-10-05T00:00:00Z"), end = new Date("2026-10-12T00:00:00Z");
test("default calendar storage is blank, and sample calendar is explicit", () => {
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: () => null } });
  assert.deepEqual(loadCalendars(), { calendars: [] });
  assert.deepEqual(calendarEvents([], from, end), []);
  assert.ok(calendarEvents([{ id: "sample", name: "Sample", type: "sample" }], from, end).length > 0);
});
test("imports named calendars and expands recurring events with exclusions", () => {
  const c = importedCalendar(feed(event("RRULE:FREQ=DAILY;COUNT=3\nEXDATE:20261006T090000Z")));
  assert.equal(c.name, "My classes");
  const events = calendarEvents([c], from, end);
  assert.equal(events.length, 2);
  assert.deepEqual(events.map((e) => e.start), ["2026-10-05T09:00:00.000Z", "2026-10-07T09:00:00.000Z"]);
});
test("imports all-day and overnight events, including events starting before the visible range", () => {
  const c = importedCalendar(feed(`BEGIN:VEVENT\nUID:all-day\nDTSTART;VALUE=DATE:20261005\nDTEND;VALUE=DATE:20261007\nSUMMARY:Trip\nEND:VEVENT\nBEGIN:VEVENT\nUID:overnight\nDTSTART:20261004T230000Z\nDTEND:20261005T020000Z\nSUMMARY:Travel\nEND:VEVENT`));
  const events = calendarEvents([c], from, end);
  assert.equal(events.length, 2);
  assert.equal(events[0]!.allDay, true);
});
test("date-only events with no duration remain visible for their full local day", () => {
  const c = importedCalendar(feed("BEGIN:VEVENT\nUID:holiday\nDTSTART;VALUE=DATE:20261005\nDTEND;VALUE=DATE:20261005\nSUMMARY:Holiday\nEND:VEVENT"));
  const events = calendarEvents([c], new Date(2026, 9, 5), new Date(2026, 9, 6));
  assert.equal(events.length, 1);
  assert.equal(events[0]!.end, new Date(2026, 9, 6).toISOString());
});
test("cancelled and transparent entries do not block scheduling; busy imported events do", () => {
  const now = new Date(2026, 9, 5, 9);
  const imported = { id: "busy", title: "Class", kind: "meeting" as const, start: now.toISOString(), end: new Date(+now + 3600000).toISOString() };
  const input = { id: "work", title: "Read", description: "", estimatedMinutes: 60, due: new Date(+now + 7200000).toISOString() };
  const busy = scheduleAssignment(input, [], now, [imported]);
  assert.equal(busy.blocks[0]!.start, imported.end);
  assert.throws(() => moveSession([busy], busy.id, busy.blocks[0]!.id, now.toISOString(), now, [imported]), /overlaps/);
  const free = scheduleAssignment(input, [], now, [{ ...imported, transparent: true }]);
  assert.equal(free.blocks[0]!.start, imported.start);
  const cancelled = importedCalendar(feed(event("STATUS:CANCELLED")));
  assert.equal(calendarEvents([cancelled], from, end).length, 0);
});
test("recurrence overrides replace original instances", () => {
  const c = importedCalendar(feed(event("RRULE:FREQ=DAILY;COUNT=2") + "\n" +
    "BEGIN:VEVENT\nUID:class-1\nRECURRENCE-ID:20261006T090000Z\nDTSTART:20261006T120000Z\nDTEND:20261006T130000Z\nSUMMARY:Moved class\nEND:VEVENT"));
  const events = calendarEvents([c], from, end);
  assert.equal(events.length, 2);
  assert.equal(events[1]!.start, "2026-10-06T12:00:00.000Z");
});
test("moved occurrences are visible even outside their original recurrence window", () => {
  const c = importedCalendar(feed(event("RRULE:FREQ=DAILY;COUNT=20") + "\n" +
    "BEGIN:VEVENT\nUID:class-1\nRECURRENCE-ID:20261020T090000Z\nDTSTART:20261006T120000Z\nDTEND:20261006T130000Z\nSUMMARY:Moved class\nEND:VEVENT"));
  assert.ok(calendarEvents([c], from, end).some((e) => e.title === "Moved class"));
});
test("embedded time zones preserve local class times across daylight saving", () => {
  const zone = `BEGIN:VTIMEZONE\nTZID:America/New_York\nBEGIN:DAYLIGHT\nDTSTART:19700308T020000\nRRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU\nTZOFFSETFROM:-0500\nTZOFFSETTO:-0400\nEND:DAYLIGHT\nBEGIN:STANDARD\nDTSTART:19701101T020000\nRRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU\nTZOFFSETFROM:-0400\nTZOFFSETTO:-0500\nEND:STANDARD\nEND:VTIMEZONE`;
  const c = importedCalendar(feed(zone + "\nBEGIN:VEVENT\nUID:dst-class\nDTSTART;TZID=America/New_York:20261030T090000\nDTEND;TZID=America/New_York:20261030T100000\nRRULE:FREQ=DAILY;COUNT=4\nSUMMARY:Morning class\nEND:VEVENT"));
  const events = calendarEvents([c], new Date("2026-10-30T00:00Z"), new Date("2026-11-04T00:00Z"));
  assert.equal(events.length, 4);
  assert.equal(events[0]!.start, "2026-10-30T13:00:00.000Z");
  assert.equal(events[3]!.start, "2026-11-02T14:00:00.000Z");
});
test("bad feeds and excessive recurrence are rejected explicitly", () => {
  for (const content of ["<html>Calendar</html>", feed(""), feed(event("RRULE:FREQ=SECONDLY")), "x".repeat(1048577)]) {
    assert.throws(() => importedCalendar(content));
  }
});
test("calendar snapshots persist, corrupt saved data is protected, and failed writes throw", () => {
  const data = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => data.set(k, v),
  } });
  const c = importedCalendar(feed(event()));
  saveCalendars([c]);
  assert.deepEqual(loadCalendars().calendars, [c]);
  data.set(CALENDARS_KEY, "broken");
  assert.ok(loadCalendars().error);
  assert.equal(data.get(CALENDARS_KEY), "broken");
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { setItem: () => { throw new Error("blocked"); } } });
  assert.throws(() => saveCalendars([c]), /Nothing was changed/);
});
