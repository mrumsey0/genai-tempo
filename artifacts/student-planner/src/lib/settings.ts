export interface PlannerSettings {
  weekStartsOn: 0 | 1;
  workStart: number;
  workEnd: number;
}

export const SETTINGS_KEY = "tempo.settings.v1";
export const DEFAULT_SETTINGS: PlannerSettings = { weekStartsOn: 0, workStart: 480, workEnd: 1260 };

export function validateSettings(settings: PlannerSettings): void {
  if (!settings || ![0, 1].includes(settings.weekStartsOn) ||
    !Number.isInteger(settings.workStart) || !Number.isInteger(settings.workEnd) ||
    settings.workStart < 0 || settings.workEnd > 1440 ||
    settings.workStart % 30 !== 0 || settings.workEnd % 30 !== 0 ||
    settings.workEnd <= settings.workStart) {
    throw new Error("Choose Sunday or Monday and a working period of at least 30 minutes, with the end after the start.");
  }
}

export function loadSettings(): { settings: PlannerSettings; error?: string } {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { settings: { ...DEFAULT_SETTINGS } };
    const settings: PlannerSettings = JSON.parse(raw);
    validateSettings(settings);
    return { settings };
  } catch {
    return { settings: { ...DEFAULT_SETTINGS }, error: "Saved settings couldn't be read. Your data has not been overwritten. Open Settings to clear saved data if needed." };
  }
}

export function saveSettings(settings: PlannerSettings): void {
  validateSettings(settings);
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); }
  catch { throw new Error("Couldn't save settings in this browser. Nothing was changed."); }
}

export function workingHoursLabel(settings: PlannerSettings): string {
  const format = (minutes: number) => minutes === 1440 ? "midnight" :
    new Date(2000, 0, 1, 0, minutes).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return `${format(settings.workStart)} and ${format(settings.workEnd)}`;
}

/** Never clear unrelated origin data. Restore removed entries if a later removal fails. */
export function clearTempoData(): void {
  const keys = ["tempo.assignments.v1", "tempo.calendars.v1", SETTINGS_KEY];
  const removed: { key: string; value: string | null }[] = [];
  try {
    const backups = keys.map((key) => ({ key, value: localStorage.getItem(key) }));
    for (const entry of backups) {
      localStorage.removeItem(entry.key);
      removed.push(entry);
    }
  } catch {
    let restored = true;
    for (const { key, value } of removed) {
      try { if (value !== null) localStorage.setItem(key, value); }
      catch { restored = false; }
    }
    throw new Error(restored ? "Couldn't clear data in this browser. Your saved data was kept." :
      "Couldn't finish clearing data or restore every saved item. Reload to check what remains before trying again.");
  }
}
