import { useState } from "react";
import { CalendarDays, Link } from "lucide-react";
import { importCalendar } from "@workspace/api-client-react";
import { DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { importedCalendar, type AddedCalendar } from "@/lib/calendars";

export function AddCalendar({ hasSample, onAdd }: {
  hasSample: boolean;
  onAdd: (calendar: AddedCalendar) => void;
}) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const button = "rounded-full border px-4 py-2 text-sm font-semibold disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ring";
  return (
    <div className="space-y-5">
      <DialogHeader>
        <DialogTitle className="font-serif text-2xl">Add a calendar</DialogTitle>
        <DialogDescription>Bring in your commitments so Tempo can plan around them. Existing study sessions won’t move automatically.</DialogDescription>
      </DialogHeader>
      <form className="rounded-2xl border bg-background p-4 space-y-3" onSubmit={async (e) => {
        e.preventDefault(); setError(null); setBusy(true);
        try {
          const feed = await importCalendar({ url: url.trim() });
          onAdd(importedCalendar(feed.content));
        } catch (e) {
          setError(e instanceof Error ? e.message.replace(/^HTTP \d+[^:]*:\s*/, "") : "Couldn't import this calendar. Please try again.");
        } finally { setBusy(false); }
      }}>
        <h3 className="flex gap-2 items-center font-semibold text-sm"><Link className="size-4" aria-hidden />Import from a link</h3>
        <label htmlFor="calendar-url" className="block text-sm">Public iCalendar link</label>
        <input id="calendar-url" data-testid="input-calendar-url" type="text" inputMode="url" autoComplete="off"
          value={url} onChange={(e) => setUrl(e.target.value)} required disabled={busy}
          placeholder="https://example.com/calendar.ics"
          className="w-full min-w-0 rounded-xl border bg-card p-3 text-sm" />
        <p className="text-xs text-muted-foreground">Use a public .ics or webcal feed, not a calendar’s sharing webpage. No sign-in required. Up to 1 MB.</p>
        <p className="text-xs text-muted-foreground">One-time import, not a live subscription. The link is sent to our server to download the feed; imported events are saved only in this browser.</p>
        <button className={`${button} bg-primary text-primary-foreground`} disabled={busy || !url.trim()} data-testid="button-import-calendar">
          {busy ? "Importing calendar…" : "Import calendar"}
        </button>
      </form>
      <div className="rounded-2xl border bg-secondary/40 p-4 space-y-3">
        <h3 className="flex gap-2 items-center font-semibold text-sm"><CalendarDays className="size-4" aria-hidden />Try the sample calendar</h3>
        <p className="text-sm text-muted-foreground">A ready-made week of recurring classes, lunch breaks, and campus commitments.</p>
        <button className={button} data-testid="button-use-sample" disabled={busy || hasSample} onClick={() => {
          try { setError(null); onAdd({ id: "sample", type: "sample", name: "Sample student calendar" }); }
          catch (e) { setError(e instanceof Error ? e.message : "Couldn't save the sample calendar."); }
        }}>{hasSample ? "Sample calendar already added" : "Use sample calendar"}</button>
      </div>
      {error && <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
    </div>
  );
}
