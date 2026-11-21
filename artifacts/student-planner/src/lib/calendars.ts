import ICAL from "ical.js";
import { demoEvents, type CalendarEvent } from "./planner.ts";

export type AddedCalendar = { id: string; name: string; type: "sample" } |
  { id: string; name: string; type: "import"; content: string };
export const CALENDARS_KEY = "tempo.calendars.v1";
const MAX_CONTENT = 1024 * 1024;

function parseCalendar(content: string) {
  if (content.length > MAX_CONTENT) throw new Error("This calendar exceeds the 1 MB import limit.");
  let root: ICAL.Component;
  try { root = new ICAL.Component(ICAL.parse(content)); }
  catch { throw new Error("This file is not a valid iCalendar feed."); }
  if (root.name !== "vcalendar") throw new Error("Use an iCalendar (.ics) feed, not a calendar webpage.");
  ICAL.TimezoneService.reset();
  for (const timezone of root.getAllSubcomponents("vtimezone")) ICAL.TimezoneService.register(timezone);
  const components = root.getAllSubcomponents("vevent");
  if (!components.length) throw new Error("This calendar has no events to import.");
  if (components.length > 2000) throw new Error("This calendar has too many events. Import a smaller calendar (up to 2,000 entries).");
  const events = components.map((component) => {
    if (!component.getFirstProperty("dtstart")) throw new Error("An event is missing its start date.");
    for (const key of ["dtstart", "dtend", "recurrence-id"]) {
      const tzid = component.getFirstProperty(key)?.getParameter("tzid");
      if (typeof tzid === "string" && !ICAL.TimezoneService.has(tzid)) {
        throw new Error(`The feed is missing its ${tzid} time-zone definition. Export a full iCalendar feed with time zones included.`);
      }
    }
    const event = new ICAL.Event(component);
    if (!event.uid) throw new Error("An event is missing its iCalendar identifier.");
    const types = event.getRecurrenceTypes();
    if (types.SECONDLY || types.MINUTELY || types.HOURLY) throw new Error("Calendars repeating more often than daily are not supported.");
    if (!Number.isFinite(+event.startDate.toJSDate()) || !Number.isFinite(+event.endDate.toJSDate()) ||
      +event.endDate.toJSDate() < +event.startDate.toJSDate()) throw new Error("An event contains an invalid date range.");
    return event;
  });
  return { root, events };
}

export function importedCalendar(content: string): AddedCalendar {
  const { root } = parseCalendar(content);
  const name = String(root.getFirstPropertyValue("x-wr-calname") || "Imported calendar").slice(0, 120);
  return { id: `calendar-${crypto.randomUUID()}`, name, type: "import", content };
}

export function calendarEvents(calendars: AddedCalendar[], from: Date, through: Date): CalendarEvent[] {
  const result: CalendarEvent[] = [];
  let iterations = 0;
  for (const calendar of calendars) {
    if (calendar.type === "sample") {
      result.push(...demoEvents(from, through).map((e) => ({ ...e, id: `${calendar.id}-${e.id}` })));
      continue;
    }
    const { events } = parseCalendar(calendar.content);
    const masters = new Map(events.filter((e) => !e.isRecurrenceException()).map((e) => [e.uid, e]));
    for (const event of events.filter((e) => e.isRecurrenceException())) masters.get(event.uid)?.relateException(event);
    function append(event: ICAL.Event, startTime: ICAL.Time, endTime: ICAL.Time, occurrence: string) {
      if (event.component.getFirstPropertyValue("status") === "CANCELLED") return;
      const start = startTime.toJSDate();
      const end = endTime.toJSDate();
      // Some public feeds omit DTEND or repeat DTSTART for a one-day holiday.
      // Treat these date-only entries as a full local calendar day.
      if (startTime.isDate && +end <= +start) end.setDate(end.getDate() + 1);
      if (+start >= +through || +end <= +from) return;
      // Zero-duration reminders still display, but do not block study time.
      result.push({
        id: `${calendar.id}-${event.uid}-${occurrence}`,
        title: event.summary || "Untitled event", kind: "meeting",
        start: start.toISOString(), end: end.toISOString(), location: event.location || undefined,
        allDay: startTime.isDate,
        transparent: event.component.getFirstPropertyValue("transp") === "TRANSPARENT",
      });
    }
    for (const event of events.filter((e) => !e.isRecurrenceException())) {
      if (!event.isRecurring()) { append(event, event.startDate, event.endDate, "once"); continue; }
      const iterator = event.iterator();
      let next: ICAL.Time | null;
      while ((next = iterator.next())) {
        if (++iterations > 100_000) throw new Error("This calendar has too many repeating events to display safely. Import a smaller date range.");
        if (+next.toJSDate() >= +through) break;
        const detail = event.getOccurrenceDetails(next);
        append(detail.item, detail.startDate, detail.endDate, next.toString());
      }
    }
    // Include moved instances even when their original recurrence date lies
    // outside the requested window, and stand-alone recurrence exceptions.
    for (const event of events.filter((e) => e.isRecurrenceException())) {
      append(event, event.startDate, event.endDate, event.recurrenceId.toString());
    }
  }
  return [...new Map(result.map((e) => [e.id, e])).values()];
}

export function loadCalendars(): { calendars: AddedCalendar[]; error?: string } {
  try {
    const raw = localStorage.getItem(CALENDARS_KEY);
    if (!raw) return { calendars: [] };
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data) || data.length > 10 || !data.every((c) => c && typeof c.id === "string" &&
      typeof c.name === "string" && (c.type === "sample" || c.type === "import" && typeof c.content === "string"))) {
      throw new Error("Saved calendars couldn't be read. Your saved data has not been overwritten.");
    }
    for (const c of data) if (c.type === "import") parseCalendar(c.content);
    return { calendars: data };
  } catch (e) {
    return { calendars: [], error: e instanceof Error ? e.message : "Saved calendars couldn't be read." };
  }
}

export function saveCalendars(calendars: AddedCalendar[]): void {
  try { localStorage.setItem(CALENDARS_KEY, JSON.stringify(calendars)); }
  catch { throw new Error("Couldn't save calendars in this browser. Nothing was changed. Check browser storage or try a smaller feed."); }
}
