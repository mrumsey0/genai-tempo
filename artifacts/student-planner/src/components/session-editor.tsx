import { useState } from "react";
import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { type Assignment, type CalendarEvent, durationLabel, localInput } from "@/lib/planner";

export function SessionEditor({ assignment, session, onMove, onDelete, onAssignment }: {
  assignment: Assignment;
  session: CalendarEvent;
  onMove: (start: string) => void;
  onDelete: () => void;
  onAssignment: () => void;
}) {
  const [start, setStart] = useState(localInput(new Date(session.start)));
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const button = "rounded-full border px-4 py-2 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-ring";
  function act(action: () => void) {
    try { action(); } catch (e) { setError(e instanceof Error ? e.message : "Couldn't save this change."); }
  }
  return (
    <div className="space-y-4">
      <DialogHeader>
        <DialogTitle className="font-serif text-2xl">Study session</DialogTitle>
        <DialogDescription>{assignment.title} · {durationLabel((+new Date(session.end) - +new Date(session.start)) / 60000)}</DialogDescription>
      </DialogHeader>
      <p className="text-sm">Due {new Date(assignment.due).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}. Moving keeps this session’s duration and the rest of your plan unchanged.</p>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); act(() => onMove(start)); }}>
        <label htmlFor="session-start" className="block text-sm font-semibold">New start date and time</label>
        <input id="session-start" data-testid="input-session-start" type="datetime-local" step={1800}
          value={start} onChange={(e) => { setStart(e.target.value); setError(null); }}
          className="w-full min-w-0 rounded-xl border bg-background p-3" required />
        <p className="text-xs text-muted-foreground">Choose an hour or half-hour between 8 am and 9 pm, before the deadline. Existing commitments cannot overlap.</p>
        <button type="submit" className={`${button} bg-primary text-primary-foreground`} data-testid="button-save-session">Move session</button>
      </form>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="border-t pt-4 space-y-3">
        {confirmDelete ? (
          <div className="space-y-2">
            <p className="text-sm">Delete only this session? The assignment stays, and this time will count as unscheduled.</p>
            <div className="flex flex-wrap gap-2">
              <button className={`${button} text-destructive`} data-testid="button-confirm-delete-session" onClick={() => act(onDelete)}>Delete this session</button>
              <button className={button} onClick={() => setConfirmDelete(false)}>Keep session</button>
            </div>
          </div>
        ) : <button className={`${button} text-destructive`} data-testid="button-delete-session" onClick={() => setConfirmDelete(true)}>Delete session</button>}
        <button className={`${button} block`} onClick={onAssignment}>View assignment</button>
      </div>
    </div>
  );
}
