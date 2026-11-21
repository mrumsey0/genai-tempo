import { test } from "node:test";
import assert from "node:assert/strict";
import { estimateMinutes, estimateExplanation, scheduleAssignment, demoEvents, startOfWeek, addDays, loadAssignments, saveAssignments, STORAGE_KEY, moveSession, removeSession, scheduledMinutes, shortfallWarning } from "./planner.ts";

const now = new Date(2026, 9, 5, 8, 0); // Monday, local time.
const input = (minutes = 300, due = new Date(2026, 9, 8, 18, 0)) => ({
  id: "test", title: "Essay", description: "Write an analysis", due: due.toISOString(), estimatedMinutes: minutes,
});
const minutes = (a: ReturnType<typeof scheduleAssignment>) =>
  a.blocks.reduce((sum, block) => sum + (+new Date(block.end) - +new Date(block.start)) / 60_000, 0);
test("keyword estimates match title and description, essay takes precedence", () => {
  assert.equal(estimateMinutes("ESSAY", ""), 300);
  assert.equal(estimateMinutes("Reading", "Write an essay"), 300);
  assert.equal(estimateMinutes("Homework essay", ""), 300);
  assert.equal(estimateMinutes("HOMEWORK", ""), 30);
  assert.equal(estimateMinutes("Math", "homework exercises"), 30);
  assert.equal(estimateMinutes("Presentation", ""), 60);
});
test("blocks total the full estimate, link to assignment, avoid demo events and deadlines", () => {
  const assignment = scheduleAssignment(input(330), [], now);
  assert.equal(minutes(assignment), 330);
  const events = demoEvents(now, new Date(assignment.due));
  for (const block of assignment.blocks) {
    assert.equal(block.assignmentId, assignment.id);
    assert.ok([30, 60].includes((+new Date(block.end) - +new Date(block.start)) / 60_000));
    assert.ok(+new Date(block.start) >= +now);
    assert.ok(+new Date(block.end) <= +new Date(assignment.due));
    assert.ok(new Date(block.start).getHours() >= 8);
    assert.ok(new Date(block.end).getHours() <= 21);
    assert.ok(!events.some((e) => new Date(block.start) < new Date(e.end) && new Date(block.end) > new Date(e.start)));
  }
});
test("new assignments avoid existing work sessions", () => {
  const first = scheduleAssignment(input(), [], now);
  const next = scheduleAssignment({ ...input(), id: "next" }, [first], now);
  assert.ok(next.blocks.every((b) => !first.blocks.some((a) => b.start < a.end && b.end > a.start)));
});
test("essay sessions are balanced across days and finish at least 24 hours early", () => {
  const a = scheduleAssignment(input(300, new Date(2026, 9, 9, 18)), [], now);
  const totals = new Map<string, number>();
  for (const b of a.blocks) {
    const date = new Date(b.start).toDateString();
    totals.set(date, (totals.get(date) ?? 0) + (+new Date(b.end) - +new Date(b.start)) / 60_000);
    assert.ok(+new Date(b.end) <= +new Date(a.due) - 24 * 60 * 60_000);
  }
  assert.equal(totals.size, 4);
  assert.ok(Math.max(...totals.values()) - Math.min(...totals.values()) <= 60);
  assert.equal(minutes(a), 300);
});
test("fewer sessions are spread across the planning window, not just the first days", () => {
  const a = scheduleAssignment(input(120, new Date(2026, 9, 12, 18)), [], now);
  assert.equal(new Date(a.blocks[0]!.start).getDate(), 5);
  assert.equal(new Date(a.blocks[1]!.start).getDate(), 11);
});
test("same-day sessions have an hour break when there is room", () => {
  const a = scheduleAssignment(input(180, new Date(2026, 9, 5, 21)), [], now);
  assert.equal(minutes(a), 180);
  for (let i = 1; i < a.blocks.length; i++) {
    assert.ok(+new Date(a.blocks[i]!.start) - +new Date(a.blocks[i - 1]!.end) >= 60 * 60_000);
  }
});
test("fallback uses deadline when 24-hour buffer has insufficient capacity", () => {
  const a = scheduleAssignment(input(300, new Date(2026, 9, 6, 9)), [], now);
  assert.equal(minutes(a), 300);
  assert.ok(a.blocks.some((b) => +new Date(b.end) > +new Date(a.due) - 24 * 60 * 60_000));
  assert.ok(a.blocks.every((b) => +new Date(b.end) <= +new Date(a.due)));
});
test("early finish is preserved even when breaks must be shortened", () => {
  const a = scheduleAssignment(input(120, new Date(2026, 9, 6, 20, 30)), [], new Date(2026, 9, 5, 18, 30));
  assert.equal(minutes(a), 120);
  assert.ok(a.blocks.every((b) => +new Date(b.end) <= +new Date(a.due) - 24 * 60 * 60_000));
});
test("urgent assignments still fit when back-to-back sessions are unavoidable", () => {
  const a = scheduleAssignment(input(120, new Date(2026, 9, 5, 21)), [], new Date(2026, 9, 5, 19));
  assert.equal(minutes(a), 120);
  assert.equal(a.blocks[0]!.end, a.blocks[1]!.start);
  assert.equal(a.blocks[1]!.end, a.due);
});
test("rounds current time forward to the next half-hour", () => {
  const current = new Date(2026, 9, 5, 8, 0, 1);
  const a = scheduleAssignment(input(30), [], current);
  assert.equal(new Date(a.blocks[0]!.start).getMinutes(), 30);
  assert.ok(+new Date(a.blocks[0]!.start) > +current);
});
test("rejects invalid title, duration, and past deadlines", () => {
  for (const bad of [
    { ...input(), title: "  " },
    input(0), input(45), input(NaN),
    input(30, now),
    { ...input(), due: "bad" },
  ]) assert.throws(() => scheduleAssignment(bad, [], now));
});
test("insufficient time saves all available work before deadline without mutating existing assignments", () => {
  const existing: ReturnType<typeof scheduleAssignment>[] = [];
  const a = scheduleAssignment(input(90, new Date(2026, 9, 5, 10)), existing, now);
  assert.equal(minutes(a), 60);
  assert.equal(a.estimatedMinutes, 90);
  assert.match(shortfallWarning(a)!, /30m remains unscheduled/);
  assert.ok(a.blocks.every((b) => +new Date(b.end) <= +new Date(a.due)));
  assert.deepEqual(existing, []);
});
test("even an estimate larger than elapsed time keeps all available slots", () => {
  const a = scheduleAssignment(input(300, new Date(2026, 9, 5, 8, 45)), [], now);
  assert.equal(minutes(a), 30);
  assert.equal(a.blocks[0]!.end, new Date(2026, 9, 5, 8, 30).toISOString());
});
test("zero available slots still saves the assignment with an explicit warning", () => {
  const a = scheduleAssignment(input(60, new Date(2026, 9, 5, 9, 30)), [], new Date(2026, 9, 5, 9));
  assert.equal(a.blocks.length, 0);
  assert.match(shortfallWarning(a)!, /1h remains unscheduled/);
});
test("estimate explanations match essay precedence, homework, and default rules", () => {
  assert.match(estimateExplanation("Homework ESSAY", ""), /5 hours/);
  assert.match(estimateExplanation("", "HOMEWORK"), /30-minute/);
  assert.match(estimateExplanation("Read chapter 2", ""), /general 1-hour/);
});
test("moving one session preserves duration, siblings, other assignments, and input", () => {
  const a = scheduleAssignment(input(180), [], now);
  const other = scheduleAssignment({ ...input(30), id: "other" }, [a], now);
  const original = JSON.stringify([a, other]);
  const list = moveSession([a, other], a.id, a.blocks[0]!.id, "2026-10-05T18:00", now);
  const moved = list[0]!.blocks.find((b) => b.id === a.blocks[0]!.id)!;
  assert.equal(moved.start, new Date(2026, 9, 5, 18).toISOString());
  assert.equal(+new Date(moved.end) - +new Date(moved.start), +new Date(a.blocks[0]!.end) - +new Date(a.blocks[0]!.start));
  assert.deepEqual(list[0]!.blocks.filter((b) => b.id !== moved.id), a.blocks.filter((b) => b.id !== moved.id));
  assert.deepEqual(list[1], other);
  assert.equal(JSON.stringify([a, other]), original);
});
test("moving rejects past, off-grid, outside hours, after deadline, and class conflicts", () => {
  const a = scheduleAssignment(input(120), [], now);
  for (const date of ["bad", "2026-10-04T18:00", "2026-10-05T18:15", "2026-10-05T07:30", "2026-10-05T20:30", "2026-10-08T18:00", "2026-10-05T09:00"]) {
    assert.throws(() => moveSession([a], a.id, a.blocks[0]!.id, date, now));
  }
  assert.throws(() => moveSession([a], a.id, "missing", "2026-10-05T18:00", now));
});
test("moving rejects other study sessions but permits an unchanged valid slot", () => {
  const a = scheduleAssignment(input(180), [], now);
  assert.throws(() => moveSession([a], a.id, a.blocks[0]!.id, a.blocks[1]!.start, now), /overlaps/);
  assert.deepEqual(moveSession([a], a.id, a.blocks[0]!.id, a.blocks[0]!.start, now), [a]);
});
test("deleting individual sessions keeps assignment, estimate, siblings, and finally an empty plan", () => {
  const a = scheduleAssignment(input(120), [], now);
  const list = removeSession([a], a.id, a.blocks[0]!.id);
  assert.equal(list[0]!.blocks.length, a.blocks.length - 1);
  assert.equal(list[0]!.estimatedMinutes, 120);
  assert.equal(a.blocks.length, 2);
  assert.equal(scheduledMinutes(list[0]!), 60);
  const empty = removeSession(list, a.id, list[0]!.blocks[0]!.id);
  assert.equal(empty.length, 1);
  assert.equal(empty[0]!.blocks.length, 0);
});
test("half-hour before exact deadline is allowed", () => {
  const a = scheduleAssignment(input(30, new Date(2026, 9, 5, 8, 30)), [], now);
  assert.equal(a.blocks[0]!.end, a.due);
});
test("cross-week and local daylight-saving schedules preserve weekday demo events", () => {
  const current = new Date(2026, 9, 31, 20, 30);
  const a = scheduleAssignment(input(300, new Date(2026, 10, 3, 18)), [], current);
  assert.equal(minutes(a), 300);
  assert.ok(a.blocks.some((b) => new Date(b.start).getDate() === 1));
  assert.equal(startOfWeek(new Date(2026, 10, 1)).getDay(), 1);
  assert.equal(addDays(new Date(2026, 9, 31, 8), 1).getHours(), 8);
});
test("demo events never overlap each other across a complete week", () => {
  const events = demoEvents(now, addDays(now, 6));
  for (let i = 0; i < events.length; i++) {
    for (let j = i + 1; j < events.length; j++) {
      assert.ok(!(events[i]!.start < events[j]!.end && events[i]!.end > events[j]!.start));
    }
  }
});
test("storage saves, reloads, and deletes complete assignments", () => {
  const data = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => data.set(k, v) },
  });
  const assignment = scheduleAssignment(input(), [], now);
  saveAssignments([assignment]);
  assert.deepEqual(loadAssignments().assignments, [assignment]);
  const partial = scheduleAssignment(input(300, new Date(2026, 9, 5, 10)), [], now);
  const empty = { ...assignment, id: "empty", blocks: [] };
  const moved = moveSession([assignment], assignment.id, assignment.blocks[0]!.id, "2026-10-05T18:00", now)[0]!;
  saveAssignments([partial, empty, moved]);
  assert.deepEqual(loadAssignments().assignments, [partial, empty, moved]);
  saveAssignments([{ ...assignment, blocks: [...assignment.blocks, ...assignment.blocks] }]);
  assert.ok(loadAssignments().error, "over-scheduled corrupt data must still be rejected");
  saveAssignments([]);
  assert.deepEqual(loadAssignments().assignments, []);
  data.set(STORAGE_KEY, "invalid");
  assert.ok(loadAssignments().error);
  assert.equal(data.get(STORAGE_KEY), "invalid");
});
test("blocked browser storage returns an error instead of a silent save", () => {
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } },
  });
  assert.ok(loadAssignments().error);
  assert.throws(() => saveAssignments([]), /Couldn't save/);
});
