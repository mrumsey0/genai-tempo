import type { CalendarEvent } from "./planner.ts";

export interface PersonalOccurrenceEdit {
  occurrenceDate: string;
  title: string;
  start: string;
  end: string;
  location?: string;
}

export interface PersonalEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  location?: string;
  repeat: "none" | "daily" | "weekdays" | "weekly" | "monthly";
  until?: string;
  excludedDates?: string[];
  occurrenceEdits?: PersonalOccurrenceEdit[];
}

const localDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const validLocal = (value: string) => typeof value === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(value) && Number.isFinite(+new Date(value));

export function validatePersonalEvent(event: PersonalEvent): void {
  if (!event || typeof event.id !== "string" || !event.id ||
    typeof event.title !== "string" || !event.title.trim() || event.title.length > 200) {
    throw new Error("Give your event a title of up to 200 characters.");
  }
  if (!validLocal(event.start) || !validLocal(event.end) || +new Date(event.end) <= +new Date(event.start)) {
    throw new Error("Choose valid dates with the end after the start.");
  }
  if (!["none", "daily", "weekdays", "weekly", "monthly"].includes(event.repeat)) throw new Error("Choose a supported repeat option.");
  if (event.until && (!/^\d{4}-\d\d-\d\d$/.test(event.until) ||
    !Number.isFinite(+new Date(`${event.until}T00:00`)) || event.until < event.start.slice(0, 10))) {
    throw new Error("The repeat end date must be on or after the event's start date.");
  }
  if (event.location !== undefined && (typeof event.location !== "string" || event.location.length > 300)) throw new Error("Keep the location under 300 characters.");
  if (event.excludedDates !== undefined && (!Array.isArray(event.excludedDates) || !event.excludedDates.every((d) => typeof d === "string" && /^\d{4}-\d\d-\d\d$/.test(d)))) {
    throw new Error("Saved event exceptions couldn't be read.");
  }
  if (event.occurrenceEdits !== undefined) {
    if (!Array.isArray(event.occurrenceEdits) || event.occurrenceEdits.some((edit) =>
      !edit || typeof edit.occurrenceDate !== "string" || !/^\d{4}-\d\d-\d\d$/.test(edit.occurrenceDate)) ||
      new Set(event.occurrenceEdits.map((edit) => edit.occurrenceDate)).size !== event.occurrenceEdits.length) {
      throw new Error("Saved occurrence changes couldn't be read.");
    }
    for (const edit of event.occurrenceEdits) validatePersonalEvent({
      id: event.id, repeat: "none", title: edit.title, start: edit.start, end: edit.end, location: edit.location,
    });
  }
}

/** Keep the original recurrence identity even when an occurrence moves to another week. */
export function editPersonalOccurrence(event: PersonalEvent, occurrenceDate: string, changes: PersonalEvent): PersonalEvent {
  if (event.repeat === "none") throw new Error("This event does not repeat.");
  const from = new Date(`${occurrenceDate}T00:00`);
  const through = new Date(from);
  through.setDate(through.getDate() + 1);
  const original = personalOccurrences([{ ...event, occurrenceEdits: undefined }], from, through);
  if (!original.some((item) => item.occurrenceDate === occurrenceDate)) throw new Error("This occurrence is no longer in the series.");
  const edit: PersonalOccurrenceEdit = {
    occurrenceDate, title: changes.title, start: changes.start, end: changes.end, location: changes.location,
  };
  const updated = { ...event, occurrenceEdits: [...(event.occurrenceEdits ?? []).filter((item) =>
    item.occurrenceDate !== occurrenceDate), edit] };
  validatePersonalEvent(updated);
  return updated;
}

/** Expand only the requested window; recurrence preserves local wall-clock times across DST. */
export function personalOccurrences(events: PersonalEvent[], from: Date, through: Date): CalendarEvent[] {
  const result: CalendarEvent[] = [];
  for (const event of events) {
    validatePersonalEvent(event);
    const original = new Date(event.start);
    const originalEnd = new Date(event.end);
    const dateNumber = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000;
    const durationDays = dateNumber(originalEnd) - dateNumber(original);
    const cursor = new Date(Math.max(+original, +from - (durationDays + 2) * 86400000));
    cursor.setHours(0, 0, 0, 0);
    let days = 0;
    while (+cursor < +through) {
      if (++days > 100_000) throw new Error("Choose a smaller calendar date range.");
      const key = localDate(cursor);
      if (event.until && key > event.until) break;
      const diff = dateNumber(cursor) - dateNumber(original);
      const matches = diff >= 0 && (event.repeat === "none" ? diff === 0 :
        event.repeat === "daily" ? true :
        event.repeat === "weekdays" ? cursor.getDay() !== 0 && cursor.getDay() !== 6 :
        event.repeat === "weekly" ? diff % 7 === 0 : cursor.getDate() === original.getDate());
      if (matches && !event.excludedDates?.includes(key) && !event.occurrenceEdits?.some((edit) => edit.occurrenceDate === key)) {
        const start = new Date(cursor);
        start.setHours(original.getHours(), original.getMinutes(), 0, 0);
        const end = new Date(cursor);
        end.setDate(end.getDate() + durationDays);
        end.setHours(originalEnd.getHours(), originalEnd.getMinutes(), 0, 0);
        if (+end > +from && +start < +through && +end > +start) result.push({
          id: `personal-${event.id}-${key}`, personalEventId: event.id, occurrenceDate: key,
          title: event.title, start: start.toISOString(), end: end.toISOString(),
          kind: "meeting", location: event.location,
        });
      }
      if (event.repeat === "none") break;
      cursor.setDate(cursor.getDate() + 1);
    }
    // Scan exceptions independently: their original dates may be outside this window
    // or beyond the series' end relative to their new dates.
    for (const edit of event.occurrenceEdits ?? []) {
      if (event.excludedDates?.includes(edit.occurrenceDate)) continue;
      if (+new Date(edit.end) > +from && +new Date(edit.start) < +through) result.push({
        id: `personal-${event.id}-${edit.occurrenceDate}`, personalEventId: event.id, occurrenceDate: edit.occurrenceDate,
        title: edit.title, start: new Date(edit.start).toISOString(), end: new Date(edit.end).toISOString(),
        kind: "meeting", location: edit.location,
      });
    }
  }
  return result;
}
