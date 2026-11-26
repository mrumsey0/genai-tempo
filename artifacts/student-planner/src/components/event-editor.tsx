import { useState } from "react";
import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { validatePersonalEvent, type PersonalEvent } from "@/lib/personal-events";
import { localInput } from "@/lib/planner";

const REPEATS: { value: PersonalEvent["repeat"]; label: string }[] = [
  { value: "none", label: "Does not repeat" },
  { value: "daily", label: "Every day" },
  { value: "weekdays", label: "Every weekday (Mon to Fri)" },
  { value: "weekly", label: "Every week" },
  { value: "monthly", label: "Every month" },
];

const WEEKDAYS = [
  { value: 1, label: "Mon", name: "Monday" },
  { value: 2, label: "Tue", name: "Tuesday" },
  { value: 3, label: "Wed", name: "Wednesday" },
  { value: 4, label: "Thu", name: "Thursday" },
  { value: 5, label: "Fri", name: "Friday" },
  { value: 6, label: "Sat", name: "Saturday" },
  { value: 0, label: "Sun", name: "Sunday" },
];

function at(date: Date, hour: number) {
  const d = new Date(date);
  d.setHours(hour, 0, 0, 0);
  return localInput(d);
}

export function EventEditor({ event, occurrenceDate, initialDate, onSave, onCancel }: {
  event?: PersonalEvent;
  occurrenceDate?: string;
  initialDate: Date;
  onSave: (event: PersonalEvent) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(event?.title ?? "");
  const [start, setStart] = useState(event?.start ?? at(initialDate, 9));
  const [end, setEnd] = useState(event?.end ?? at(initialDate, 10));
  const [location, setLocation] = useState(event?.location ?? "");
  const [repeat, setRepeat] = useState<PersonalEvent["repeat"]>(event?.repeat ?? "none");
  const [weekdays, setWeekdays] = useState<number[] | undefined>(event?.weekdays);
  const selectedWeekdays = weekdays ?? [new Date(start).getDay()];
  const [until, setUntil] = useState(event?.until ?? "");
  const [error, setError] = useState<string | null>(null);
  const button = "rounded-full border px-4 py-2 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-ring";
  const field = "w-full min-w-0 rounded-xl border bg-background p-3";
  const clear = () => setError(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const updated: PersonalEvent = {
        ...event,
        id: event?.id ?? crypto.randomUUID(),
        title: title.trim(),
        start,
        end,
        location: location.trim() || undefined,
        repeat,
        weekdays: repeat === "weekly" ? [...selectedWeekdays].sort((a, b) => a - b) : undefined,
        until: repeat !== "none" && until ? until : undefined,
        excludedDates: repeat !== "none" ? event?.excludedDates : undefined,
        occurrenceEdits: repeat !== "none" ? event?.occurrenceEdits : undefined,
      };
      validatePersonalEvent(updated);
      onSave(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save this event.");
    }
  }

  return (
    <div className="space-y-4">
      <DialogHeader>
        <DialogTitle className="font-serif text-2xl">{occurrenceDate ? "Edit this occurrence" : event?.repeat !== "none" && event ? "Edit series" : event ? "Edit commitment" : "New commitment"}</DialogTitle>
        <DialogDescription>
          {occurrenceDate ? "Only this occurrence will change. Other dates and the repeat schedule will stay the same." : event && event.repeat !== "none"
            ? "Changes apply to the whole series, including past and future repeats. Previously changed occurrences keep their individual details unless repeats are turned off."
            : "Block time for work, classes, practice, or anything else. Study sessions plan around it."}
        </DialogDescription>
      </DialogHeader>
      <form className="space-y-3" onSubmit={submit}>
        <div className="space-y-1">
          <label htmlFor="event-title" className="block text-sm font-semibold">Title</label>
          <input id="event-title" data-testid="input-event-title" value={title} required
            onChange={(e) => { setTitle(e.target.value); clear(); }} className={field} placeholder="Shift at the library" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="event-start" className="block text-sm font-semibold">Starts</label>
            <input id="event-start" data-testid="input-event-start" type="datetime-local" value={start} required
              onChange={(e) => { setStart(e.target.value); clear(); }} className={field} />
          </div>
          <div className="space-y-1">
            <label htmlFor="event-end" className="block text-sm font-semibold">Ends</label>
            <input id="event-end" data-testid="input-event-end" type="datetime-local" value={end} required
              onChange={(e) => { setEnd(e.target.value); clear(); }} className={field} />
          </div>
        </div>
        <div className="space-y-1">
          <label htmlFor="event-location" className="block text-sm font-semibold">Location <span className="font-normal text-muted-foreground">(optional)</span></label>
          <input id="event-location" data-testid="input-event-location" value={location}
            onChange={(e) => { setLocation(e.target.value); clear(); }} className={field} />
        </div>
        {!occurrenceDate && <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="event-repeat" className="block text-sm font-semibold">Repeats</label>
            <select id="event-repeat" data-testid="select-event-repeat" value={repeat}
              onChange={(e) => { setRepeat(e.target.value as PersonalEvent["repeat"]); clear(); }} className={field}>
              {REPEATS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          {repeat !== "none" && (
            <div className="space-y-1">
              <label htmlFor="event-until" className="block text-sm font-semibold">Repeat until <span className="font-normal text-muted-foreground">(optional)</span></label>
              <input id="event-until" data-testid="input-event-until" type="date" value={until}
                min={start.slice(0, 10)}
                onChange={(e) => { setUntil(e.target.value); clear(); }} className={field} />
            </div>
          )}
        </div>}
        {!occurrenceDate && repeat === "weekly" && (
          <fieldset className="space-y-2" aria-describedby="event-weekdays-help">
            <legend className="text-sm font-semibold">Repeat on</legend>
            <div className="flex flex-wrap gap-2">
              {WEEKDAYS.map((day) => (
                <label key={day.value} className="flex items-center gap-1.5 rounded-xl border px-2 py-2 text-sm">
                  <input type="checkbox" aria-label={day.name} data-testid={`checkbox-event-weekday-${day.value}`}
                    className="h-4 w-4 accent-primary" checked={selectedWeekdays.includes(day.value)}
                    onChange={(e) => {
                      setWeekdays(e.target.checked ? [...selectedWeekdays, day.value] :
                        selectedWeekdays.filter((value) => value !== day.value));
                      clear();
                    }} />
                  {day.label}
                </label>
              ))}
            </div>
            <p id="event-weekdays-help" className="text-xs text-muted-foreground">
              Choose one or more days. Repeats begin on the first selected day on or after the start date, at the same time.
            </p>
          </fieldset>
        )}
        {!occurrenceDate && repeat !== "none" && (
          <p className="text-xs text-muted-foreground">Repeats follow this device's local time zone. The end date is included; leave it blank to repeat indefinitely.{repeat === "monthly" ? " Months without this day are skipped." : ""}</p>
        )}
        {error && <p role="alert" data-testid="text-event-error" className="text-sm text-destructive">{error}</p>}
        <div className="flex flex-wrap gap-2 pt-1">
          <button type="submit" data-testid="button-save-event" className={`${button} bg-primary text-primary-foreground`}>
            {event ? "Save changes" : "Save event"}
          </button>
          <button type="button" data-testid="button-cancel-event" className={button} onClick={onCancel}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
