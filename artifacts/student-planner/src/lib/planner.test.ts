import { test } from "node:test";
import assert from "node:assert/strict";
import { estimateMinutes, scheduleAssignment, demoEvents, startOfWeek, addDays, loadAssignments, saveAssignments, STORAGE_KEY } from "./planner.ts";

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
test("impossible schedule is rejected without mutating existing assignments", () => {
  const existing: ReturnType<typeof scheduleAssignment>[] = [];
  assert.throws(() => scheduleAssignment(input(90, new Date(2026, 9, 5, 10)), existing, now), /Only 1h/);
  assert.deepEqual(existing, []);
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
