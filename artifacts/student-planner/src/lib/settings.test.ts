import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_SETTINGS, SETTINGS_KEY, loadSettings, saveSettings, validateSettings, clearTempoData } from "./settings.ts";
import { startOfWeek, scheduleAssignment, moveSession, type Assignment } from "./planner.ts";

function storage() {
  const entries = new Map<string, string>();
  const api = {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => { entries.set(key, value); },
    removeItem: (key: string) => { entries.delete(key); },
  };
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: api });
  return { entries, api };
}

test("Sunday is the default week start, Monday is optional, and input dates are unchanged", () => {
  for (let day = 1; day <= 7; day++) {
    const date = new Date(2026, 10, day, 15);
    const timestamp = +date;
    for (const first of [0, 1] as const) {
      const start = startOfWeek(date, first);
      assert.equal(start.getDay(), first);
      assert.ok(+start <= +date);
      assert.equal(start.getHours(), 0);
    }
    assert.equal(+date, timestamp);
  }
  assert.equal(startOfWeek(new Date(2026, 10, 1)).getDate(), 1);
  assert.equal(startOfWeek(new Date(2026, 10, 1), 1).getDate(), 26);
});
test("settings default to Sunday with existing work hours, persist, and reject corrupt data", () => {
  const { entries } = storage();
  assert.deepEqual(loadSettings().settings, { weekStartsOn: 0, workStart: 480, workEnd: 1260 });
  const custom = { weekStartsOn: 1 as const, workStart: 570, workEnd: 1110 };
  saveSettings(custom);
  assert.deepEqual(loadSettings(), { settings: custom });
  entries.set(SETTINGS_KEY, "corrupt");
  assert.ok(loadSettings().error);
  assert.equal(entries.get(SETTINGS_KEY), "corrupt");
  for (const workEnd of [0, 479, 481, 1470, NaN]) {
    assert.throws(() => validateSettings({ ...DEFAULT_SETTINGS, workEnd }));
  }
  assert.throws(() => validateSettings({ ...DEFAULT_SETTINGS, workStart: -30 }));
  assert.throws(() => validateSettings({ ...DEFAULT_SETTINGS, workStart: 1260 }));
});
test("new plans honor half-hour start and end boundaries", () => {
  const settings = { ...DEFAULT_SETTINGS, workStart: 570, workEnd: 690 };
  const now = new Date(2026, 9, 5, 8);
  const assignment = scheduleAssignment({
    id: "new", title: "Reading", description: "", estimatedMinutes: 240,
    due: new Date(2026, 9, 8, 18).toISOString(),
  }, [], now, [], settings);
  assert.equal(assignment.blocks.reduce((sum, b) => sum + (+new Date(b.end) - +new Date(b.start)) / 60000, 0), 240);
  assert.ok(assignment.blocks.every((b) => {
    const start = new Date(b.start), end = new Date(b.end);
    return start.getHours() * 60 + start.getMinutes() >= 570 && end.getHours() * 60 + end.getMinutes() <= 690;
  }));
});
test("manual moves enforce configured hours and support sessions ending at midnight", () => {
  const assignment: Assignment = { id: "a", title: "Read", description: "", estimatedMinutes: 60,
    due: new Date(2026, 9, 8, 18).toISOString(), blocks: [{
      id: "s", title: "Read", kind: "work", assignmentId: "a",
      start: new Date(2026, 9, 5, 9).toISOString(), end: new Date(2026, 9, 5, 10).toISOString(),
    }] };
  const settings = { ...DEFAULT_SETTINGS, workStart: 570, workEnd: 690 };
  const now = new Date(2026, 9, 5, 8);
  assert.throws(() => moveSession([assignment], "a", "s", "2026-10-05T09:00", now, [], settings), /must fit/);
  assert.throws(() => moveSession([assignment], "a", "s", "2026-10-05T11:00", now, [], settings), /must fit/);
  assert.equal(new Date(moveSession([assignment], "a", "s", "2026-10-05T09:30", now, [], settings)[0]!.blocks[0]!.start).getMinutes(), 30);
  const result = moveSession([assignment], "a", "s", "2026-10-05T23:00", now, [], { ...settings, workStart: 1380, workEnd: 1440 });
  assert.equal(new Date(result[0]!.blocks[0]!.end).getHours(), 0);
  assert.equal(new Date(assignment.blocks[0]!.start).getHours(), 9);
});
test("clear removes all Tempo data, resets defaults, and preserves unrelated storage", () => {
  const { entries, api } = storage();
  for (const key of ["tempo.assignments.v1", "tempo.calendars.v1", SETTINGS_KEY, "unrelated"]) api.setItem(key, "keep");
  clearTempoData();
  assert.deepEqual([...entries.keys()], ["unrelated"]);
  assert.deepEqual(loadSettings().settings, DEFAULT_SETTINGS);
});
test("failed settings writes report failure; partial clearing rolls back before reporting", () => {
  const { entries, api } = storage();
  api.setItem("tempo.assignments.v1", "assignments");
  api.setItem("tempo.calendars.v1", "calendars");
  const original = api.setItem;
  api.setItem = () => { throw new Error("blocked"); };
  assert.throws(() => saveSettings(DEFAULT_SETTINGS), /Nothing was changed/);
  api.setItem = original;
  api.removeItem = (key) => { if (key === "tempo.calendars.v1") throw new Error("blocked"); entries.delete(key); };
  assert.throws(() => clearTempoData(), /saved data was kept/);
  assert.equal(entries.get("tempo.assignments.v1"), "assignments");
  assert.equal(entries.get("tempo.calendars.v1"), "calendars");
});
