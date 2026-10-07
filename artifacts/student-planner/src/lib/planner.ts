export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  kind: "class" | "meeting" | "work";
  assignmentId?: string;
  location?: string;
}
export interface Assignment {
  id: string;
  title: string;
  description: string;
  due: string;
  estimatedMinutes: number;
  blocks: CalendarEvent[];
}
export const WORK_START = 8;
export const WORK_END = 21;
export const STORAGE_KEY = "tempo.assignments.v1";
const MINUTE = 60_000;

export function estimateMinutes(title: string, description: string): number {
  const text = `${title} ${description}`.toLowerCase();
  return text.includes("essay") ? 300 : text.includes("homework") ? 30 : 60;
}
export function startOfWeek(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  result.setDate(result.getDate() - (result.getDay() + 6) % 7);
  return result;
}
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}
export function localInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
export function durationLabel(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${hours ? `${hours}h` : ""}${hours && remainder ? " " : ""}${remainder ? `${remainder}m` : ""}` || "0m";
}

// Recurring, non-overlapping demo events; generated in local calendar time.
const recurring: [number[], number, number, number, string, "class" | "meeting", string][] = [
  [[1, 3, 5], 9, 0, 60, "Intro to Psychology", "class", "Hall B · Room 204"],
  [[1, 3], 11, 0, 90, "English Literature", "class", "Humanities · Room 112"],
  [[2, 4], 10, 0, 90, "Calculus II", "class", "Science · Room 308"],
  [[2, 4], 14, 0, 60, "Biology Seminar", "class", "Science · Room 106"],
  [[1, 2, 3, 4, 5], 12, 30, 60, "Lunch with friends", "meeting", "Student Union"],
  [[1], 16, 0, 60, "Student club meeting", "meeting", "Student Union"],
  [[3], 15, 0, 90, "Part-time shift", "meeting", "Campus library"],
  [[5], 14, 0, 60, "Study group", "meeting", "Campus library"],
  [[6], 10, 0, 90, "Volunteer meetup", "meeting", "Community center"],
  [[0], 17, 0, 60, "Weekly catch-up", "meeting", "Friends"],
];
export function demoEvents(from: Date, through: Date): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const day = new Date(from);
  day.setHours(0, 0, 0, 0);
  while (day <= through) {
    recurring.forEach(([days, hour, minute, length, title, kind, location], index) => {
      if (!days.includes(day.getDay())) return;
      const start = new Date(day);
      start.setHours(hour, minute, 0, 0);
      events.push({
        id: `demo-${localInput(day).slice(0, 10)}-${index}`,
        title, kind, location,
        start: start.toISOString(),
        end: new Date(+start + length * MINUTE).toISOString(),
      });
    });
    day.setDate(day.getDate() + 1);
  }
  return events;
}

export function scheduleAssignment(
  input: { id: string; title: string; description: string; due: string; estimatedMinutes: number },
  existing: Assignment[],
  now = new Date(),
): Assignment {
  const deadline = new Date(input.due);
  if (!input.title.trim()) throw new Error("Please give your assignment a title.");
  if (!Number.isFinite(+deadline) || +deadline <= +now) throw new Error("Choose a due date and time in the future.");
  if (!Number.isFinite(input.estimatedMinutes) || input.estimatedMinutes < 30 || input.estimatedMinutes % 30 !== 0) {
    throw new Error("Choose an estimate of at least 30 minutes, in 30-minute increments.");
  }
  // Reject plainly impossible totals before generating a potentially large date range.
  if (input.estimatedMinutes * MINUTE > +deadline - +now) throw new Error("There isn't enough time before this deadline. Reduce the estimate or choose a later deadline.");
  const busy = [
    ...demoEvents(now, deadline),
    ...existing.flatMap((assignment) => assignment.blocks),
  ].map((event) => ({ start: +new Date(event.start), end: +new Date(event.end) }));
  const blocks: CalendarEvent[] = [];
  let remaining = input.estimatedMinutes;
  const day = new Date(now);
  day.setHours(0, 0, 0, 0);
  while (day < deadline && remaining > 0) {
    const opening = new Date(day);
    opening.setHours(WORK_START, 0, 0, 0);
    const closing = new Date(day);
    closing.setHours(WORK_END, 0, 0, 0);
    let cursor = new Date(Math.max(+opening, +now));
    const round = cursor.getMinutes() % 30 || cursor.getSeconds() || cursor.getMilliseconds();
    if (round) {
      cursor.setMinutes(Math.floor(cursor.getMinutes() / 30) * 30 + 30, 0, 0);
    }
    const limit = Math.min(+closing, +deadline);
    while (+cursor + 30 * MINUTE <= limit && remaining > 0) {
      const start = +cursor;
      const free = (length: number) => start + length * MINUTE <= limit &&
        !busy.some((event) => start < event.end && start + length * MINUTE > event.start);
      const length = remaining >= 60 && free(60) ? 60 : free(30) ? 30 : 0;
      if (length) {
        blocks.push({
          id: `${input.id}-session-${blocks.length + 1}`, assignmentId: input.id,
          title: input.title.trim(), kind: "work",
          start: cursor.toISOString(), end: new Date(start + length * MINUTE).toISOString(),
        });
        remaining -= length;
      }
      cursor = new Date(start + (length || 30) * MINUTE);
    }
    day.setDate(day.getDate() + 1);
  }
  if (remaining > 0) {
    throw new Error(`Only ${durationLabel(input.estimatedMinutes - remaining)} is free before this deadline (8 am–9 pm). Reduce the estimate or choose a later deadline. Nothing has been scheduled.`);
  }
  return { ...input, title: input.title.trim(), due: deadline.toISOString(), blocks };
}

export function loadAssignments(): { assignments: Assignment[]; error?: string } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { assignments: [] };
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data) || !data.every((item) =>
      item && typeof item.id === "string" && typeof item.title === "string" &&
      typeof item.description === "string" && Number.isFinite(+new Date(item.due)) &&
      Number.isFinite(item.estimatedMinutes) && item.estimatedMinutes >= 30 &&
      item.estimatedMinutes % 30 === 0 && Array.isArray(item.blocks) &&
      item.blocks.every((block: CalendarEvent) => block.assignmentId === item.id &&
        typeof block.id === "string" && typeof block.title === "string" && block.kind === "work" &&
        Number.isFinite(+new Date(block.start)) && Number.isFinite(+new Date(block.end)) &&
        [30, 60].includes((+new Date(block.end) - +new Date(block.start)) / MINUTE) &&
        +new Date(block.end) <= +new Date(item.due)) &&
      item.blocks.reduce((total: number, block: CalendarEvent) =>
        total + (+new Date(block.end) - +new Date(block.start)) / MINUTE, 0) === item.estimatedMinutes
    )) throw new Error("Saved assignments couldn't be read. Your saved data has not been overwritten.");
    return { assignments: data as Assignment[] };
  } catch (error) {
    return { assignments: [], error: error instanceof Error ? error.message : "Browser storage isn't available." };
  }
}
export function saveAssignments(assignments: Assignment[]): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(assignments)); }
  catch { throw new Error("Couldn't save in this browser. No changes were made. Allow browser storage and try again."); }
}
