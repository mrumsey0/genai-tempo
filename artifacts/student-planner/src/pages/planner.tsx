import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Clock, MapPin, Minus, Plus, Trash2, TriangleAlert, Sparkles, Info } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  type Assignment, type CalendarEvent, WORK_START, WORK_END,
  addDays, demoEvents, durationLabel, estimateMinutes, loadAssignments,
  localInput, saveAssignments, scheduleAssignment, startOfWeek,
} from "@/lib/planner";

const HOUR = 56;
const HOURS = Array.from({ length: WORK_END - WORK_START }, (_, i) => WORK_START + i);
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const fmtDay = (iso: string) =>
  new Date(iso).toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
const fmtDue = (iso: string) => `${fmtDay(iso)}, ${fmtTime(iso)}`;
const hourLabel = (h: number) => `${h % 12 || 12} ${h < 12 ? "am" : "pm"}`;
const mins = (e: CalendarEvent) => (+new Date(e.end) - +new Date(e.start)) / 60000;

const KIND: Record<CalendarEvent["kind"], string> = {
  class: "bg-[hsl(188_45%_88%)] border-[hsl(188_62%_22%)] text-[hsl(188_62%_16%)]",
  meeting: "bg-[hsl(42_55%_88%)] border-[hsl(38_50%_45%)] text-[hsl(30_45%_22%)]",
  work: "bg-[hsl(14_85%_86%)] border-[hsl(14_70%_45%)] text-[hsl(14_70%_20%)]",
};
const KIND_LABEL = { class: "Class", meeting: "Commitment", work: "Study session" } as const;

type Modal = { type: "add" } | { type: "event"; event: CalendarEvent } | { type: "assignment"; id: string } | null;

export default function Planner() {
  const [initial] = useState(() => loadAssignments());
  const [assignments, setAssignments] = useState<Assignment[]>(initial.assignments);
  const storageError = initial.error;
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [modal, setModal] = useState<Modal>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Assignment | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const events = useMemo(() => {
    const end = addDays(weekStart, 7);
    const all = [...demoEvents(weekStart, addDays(weekStart, 6)), ...assignments.flatMap((a) => a.blocks)];
    return all.filter((e) => +new Date(e.start) >= +weekStart && +new Date(e.start) < +end);
  }, [weekStart, assignments]);
  const today = new Date();
  const sorted = useMemo(() => [...assignments].sort((a, b) => +new Date(a.due) - +new Date(b.due)), [assignments]);
  const rangeLabel = `${days[0].toLocaleDateString([], { month: "short", day: "numeric" })} – ${days[6].toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}`;

  function doDelete(a: Assignment) {
    try {
      saveAssignments(assignments.filter((x) => x.id !== a.id));
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Couldn't save.");
      return;
    }
    setAssignments((cur) => cur.filter((x) => x.id !== a.id));
    setConfirmDelete(null);
    setModal(null);
    setNotice(`Removed "${a.title}" and its ${a.blocks.length} sessions.`);
  }

  const detailAssignment = modal?.type === "assignment" ? assignments.find((a) => a.id === modal.id) : undefined;

  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="border-b bg-card/70 backdrop-blur sticky top-0 z-30">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-8 py-3 flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="flex items-center gap-2.5 mr-auto">
            <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
              <circle cx="15" cy="15" r="15" fill="hsl(188 62% 22%)" />
              <rect x="7" y="16" width="4" height="7" rx="2" fill="hsl(40 45% 95%)" />
              <rect x="13" y="9" width="4" height="14" rx="2" fill="hsl(14 85% 70%)" />
              <rect x="19" y="13" width="4" height="10" rx="2" fill="hsl(40 45% 95%)" />
            </svg>
            <span className="font-serif text-2xl font-semibold tracking-tight" data-testid="text-brand">Tempo</span>
          </div>
          <button
            onClick={() => setModal({ type: "add" })}
            disabled={!!storageError}
            data-testid="button-add-assignment"
            className="group inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground pl-4 pr-5 h-10 text-sm font-semibold shadow-sm transition-transform active:scale-95 hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <Plus className="size-4 transition-transform group-hover:rotate-90" aria-hidden /> Add assignment
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-4 sm:px-8 py-6 grid gap-6 lg:grid-cols-[1fr_300px]">
        <section aria-labelledby="week-heading" className="min-w-0">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">Your week, paced gently</p>
              <h1 id="week-heading" className="font-serif text-3xl sm:text-4xl font-semibold tracking-tight" data-testid="text-week-range">{rangeLabel}</h1>
            </div>
            <div className="flex items-center gap-1.5" role="group" aria-label="Change week">
              <NavBtn label="Previous week" onClick={() => setWeekStart(addDays(weekStart, -7))} testId="button-prev-week"><ChevronLeft className="size-4" /></NavBtn>
              <button
                onClick={() => setWeekStart(startOfWeek(new Date()))}
                data-testid="button-today"
                className="h-9 px-4 rounded-full border bg-card text-sm font-semibold transition hover:bg-secondary active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >Today</button>
              <NavBtn label="Next week" onClick={() => setWeekStart(addDays(weekStart, 7))} testId="button-next-week"><ChevronRight className="size-4" /></NavBtn>
            </div>
          </div>

          {storageError && (
            <div role="alert" data-testid="alert-storage" className="mb-4 flex gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
              <TriangleAlert className="size-5 shrink-0 text-destructive" aria-hidden />
              <div>
                <p className="font-semibold">{storageError}</p>
                <p className="text-muted-foreground">Adding and deleting are paused so nothing stored gets overwritten.</p>
              </div>
            </div>
          )}
          {notice && (
            <div role="status" data-testid="status-notice" className="mb-4 flex items-center justify-between gap-3 rounded-2xl border bg-[hsl(150_30%_90%)] px-4 py-3 text-sm animate-in fade-in slide-in-from-top-2">
              <span>{notice}</span>
              <button onClick={() => setNotice(null)} className="font-semibold underline underline-offset-2 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid="button-dismiss-notice">Dismiss</button>
            </div>
          )}

          <div className="rounded-3xl border bg-card shadow-[0_8px_30px_-18px_hsl(188_62%_22%/0.35)] overflow-x-auto" data-testid="calendar-week" tabIndex={0} aria-label="Weekly calendar, scrolls horizontally on small screens">
            <div className="min-w-[820px]">
              <div className="grid grid-cols-[56px_repeat(7,1fr)] border-b sticky top-0 bg-card">
                <div />
                {days.map((d) => {
                  const isToday = d.toDateString() === today.toDateString();
                  return (
                    <div key={+d} className="py-3 text-center border-l" data-testid={`header-day-${d.getDay()}`}>
                      <div className="text-xs uppercase tracking-wider text-muted-foreground">{d.toLocaleDateString([], { weekday: "short" })}</div>
                      <div className={`mx-auto mt-1 grid size-8 place-items-center rounded-full text-sm font-semibold ${isToday ? "bg-accent-foreground text-card" : ""}`}>{d.getDate()}</div>
                    </div>
                  );
                })}
              </div>
              <div className="grid grid-cols-[56px_repeat(7,1fr)] relative">
                <div>
                  {HOURS.map((h) => (
                    <div key={h} style={{ height: HOUR }} className="pr-2 text-right text-[11px] text-muted-foreground -translate-y-2">{hourLabel(h)}</div>
                  ))}
                </div>
                {days.map((d) => {
                  const isToday = d.toDateString() === today.toDateString();
                  const dayEvents = events.filter((e) => new Date(e.start).toDateString() === d.toDateString());
                  return (
                    <div key={+d} className={`relative border-l ${isToday ? "bg-accent/30" : ""}`} style={{ height: HOUR * HOURS.length }}>
                      {HOURS.map((h, i) => (
                        <div key={h} className="absolute inset-x-0 border-t border-border/70" style={{ top: i * HOUR }} />
                      ))}
                      {dayEvents.map((e) => {
                        const s = new Date(e.start);
                        const top = ((s.getHours() - WORK_START) * 60 + s.getMinutes()) / 60 * HOUR;
                        const height = Math.max(mins(e) / 60 * HOUR - 3, 20);
                        return (
                          <button
                            key={e.id}
                            data-testid={`event-${e.id}`}
                            onClick={() => setModal(e.kind === "work" ? { type: "assignment", id: e.assignmentId! } : { type: "event", event: e })}
                            style={{ top: top + 1, height }}
                            className={`absolute inset-x-1 overflow-hidden rounded-xl border-l-4 px-2 py-1 text-left text-xs leading-tight transition hover:-translate-y-px hover:shadow-md active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${KIND[e.kind]}`}
                            aria-label={`${e.title}, ${KIND_LABEL[e.kind]}, ${fmtTime(e.start)} to ${fmtTime(e.end)}`}
                          >
                            <span className="block font-semibold truncate">{e.title}</span>
                            {height > 34 && <span className="block opacity-75">{fmtTime(e.start)}</span>}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground" aria-label="Legend">
            {(["class", "meeting", "work"] as const).map((k) => (
              <li key={k} className="flex items-center gap-2"><span className={`size-3 rounded border-l-4 ${KIND[k]}`} />{KIND_LABEL[k]}</li>
            ))}
          </ul>
        </section>

        <aside className="space-y-5 lg:pt-[88px]">
          <section aria-labelledby="assign-heading" className="rounded-3xl border bg-card p-5">
            <h2 id="assign-heading" className="font-serif text-xl font-semibold">Assignments</h2>
            {sorted.length === 0 ? (
              <div className="mt-3 text-sm text-muted-foreground" data-testid="empty-assignments">
                <svg viewBox="0 0 120 40" className="w-28 mb-3" aria-hidden="true">
                  {[0, 1, 2, 3, 4].map((i) => <rect key={i} x={4 + i * 24} y={30 - (i % 3) * 8} width="14" height="8" rx="4" fill="hsl(14 85% 86%)" />)}
                </svg>
                Nothing planned yet. Add a deadline and Tempo will find quiet gaps between your classes.
              </div>
            ) : (
              <ul className="mt-3 space-y-2">
                {sorted.map((a) => (
                  <li key={a.id}>
                    <button
                      onClick={() => { setModal({ type: "assignment", id: a.id }); }}
                      data-testid={`button-assignment-${a.id}`}
                      className="w-full text-left rounded-2xl border bg-background px-3 py-2.5 transition hover:border-primary hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="block font-semibold text-sm truncate">{a.title}</span>
                      <span className="block text-xs text-muted-foreground">Due {fmtDue(a.due)}</span>
                      <span className="block text-xs mt-0.5">{durationLabel(a.estimatedMinutes)} across {a.blocks.length} sessions</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="rounded-3xl bg-primary text-primary-foreground p-5 text-sm space-y-2" data-testid="panel-prototype">
            <h2 className="font-serif text-lg font-semibold flex items-center gap-2"><Info className="size-4" aria-hidden /> A local prototype</h2>
            <p className="opacity-90">Everything stays in this browser. There is no account and no server, and the estimate is a simple demo rule, not real AI.</p>
            <p className="opacity-90">Sessions are spread across available days between 8 am and 9 pm, with breaks whenever possible. We aim to finish at least 24 hours before your deadline, using later time only if needed.</p>
          </section>
        </aside>
      </main>

      <Dialog open={modal?.type === "add"} onOpenChange={(o) => !o && setModal(null)}>
        <DialogContent className="max-w-lg rounded-3xl max-h-[92dvh] overflow-y-auto" data-testid="dialog-add">
          {modal?.type === "add" && (
            <AddFlow
              assignments={assignments}
              onClose={() => setModal(null)}
              onDone={(a, list) => {
                setAssignments(list);
                setWeekStart(startOfWeek(new Date(a.blocks[0].start)));
                setNotice(`Planned "${a.title}" in ${a.blocks.length} sessions.`);
                setModal(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={modal?.type === "event"} onOpenChange={(o) => !o && setModal(null)}>
        <DialogContent className="max-w-sm rounded-3xl" data-testid="dialog-event">
          {modal?.type === "event" && (
            <>
              <DialogHeader>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">{KIND_LABEL[modal.event.kind]}</p>
                <DialogTitle className="font-serif text-2xl">{modal.event.title}</DialogTitle>
                <DialogDescription className="sr-only">Event details</DialogDescription>
              </DialogHeader>
              <ul className="space-y-2 text-sm">
                <li className="flex gap-2"><CalendarDays className="size-4 mt-0.5" aria-hidden />{fmtDay(modal.event.start)}</li>
                <li className="flex gap-2"><Clock className="size-4 mt-0.5" aria-hidden />{fmtTime(modal.event.start)} – {fmtTime(modal.event.end)} ({durationLabel(mins(modal.event))})</li>
                {modal.event.location && <li className="flex gap-2"><MapPin className="size-4 mt-0.5" aria-hidden />{modal.event.location}</li>}
              </ul>
              <p className="text-xs text-muted-foreground">Demo schedule. Tempo works around it when planning.</p>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={modal?.type === "assignment"} onOpenChange={(o) => !o && setModal(null)}>
        <DialogContent className="max-w-md rounded-3xl max-h-[92dvh] overflow-y-auto" data-testid="dialog-assignment">
          {detailAssignment && (
            <>
              <DialogHeader>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Assignment</p>
                <DialogTitle className="font-serif text-2xl">{detailAssignment.title}</DialogTitle>
                <DialogDescription>Due {fmtDue(detailAssignment.due)} · {durationLabel(detailAssignment.estimatedMinutes)} planned</DialogDescription>
              </DialogHeader>
              {detailAssignment.description && <p className="text-sm whitespace-pre-wrap">{detailAssignment.description}</p>}
              <h3 className="text-sm font-semibold">Sessions ({detailAssignment.blocks.length})</h3>
              <ol className="space-y-1.5" data-testid="list-sessions">
                {detailAssignment.blocks.map((b) => (
                  <li key={b.id}>
                    <button
                      onClick={() => { setWeekStart(startOfWeek(new Date(b.start))); setModal(null); }}
                      data-testid={`session-${b.id}`}
                      className="w-full flex justify-between gap-3 rounded-xl bg-accent/60 px-3 py-2 text-sm text-left transition hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span>{fmtDay(b.start)}</span>
                      <span className="text-muted-foreground">{fmtTime(b.start)} – {fmtTime(b.end)}</span>
                    </button>
                  </li>
                ))}
              </ol>
              <button
                onClick={() => { setDeleteError(null); setConfirmDelete(detailAssignment); }}
                disabled={!!storageError}
                data-testid="button-delete-assignment"
                className="inline-flex items-center justify-center gap-2 h-10 rounded-full border border-destructive/50 text-destructive text-sm font-semibold transition hover:bg-destructive/10 active:scale-95 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              ><Trash2 className="size-4" aria-hidden /> Delete assignment</button>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent className="rounded-3xl" data-testid="dialog-confirm-delete">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif">Delete "{confirmDelete?.title}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the assignment and all {confirmDelete?.blocks.length} of its study sessions from your calendar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && <p role="alert" className="text-sm text-destructive" data-testid="text-delete-error">{deleteError}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Keep it</AlertDialogCancel>
            <AlertDialogAction
              data-testid="button-confirm-delete"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => { e.preventDefault(); if (confirmDelete) doDelete(confirmDelete); }}
            >Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function NavBtn({ label, onClick, testId, children }: { label: string; onClick: () => void; testId: string; children: React.ReactNode }) {
  return (
    <button
      aria-label={label}
      onClick={onClick}
      data-testid={testId}
      className="grid size-9 place-items-center rounded-full border bg-card transition hover:bg-secondary active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >{children}</button>
  );
}

const fieldCls = "h-11 w-full rounded-xl border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function AddFlow({ assignments, onClose, onDone }: {
  assignments: Assignment[];
  onClose: () => void;
  onDone: (a: Assignment, list: Assignment[]) => void;
}) {
  const [step, setStep] = useState<"form" | "estimating" | "review">("form");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(() => localInput(addDays(new Date(), 3)).slice(0, 10));
  const [time, setTime] = useState("17:00");
  const [hours, setHours] = useState("1");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const idRef = useRef(`a-${Date.now().toString(36)}`);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const due = `${date}T${time}`;

  useEffect(() => {
    if (step !== "form") headingRef.current?.focus();
  }, [step]);

  useEffect(() => {
    if (step !== "estimating") return;
    const t = window.setTimeout(() => {
      setHours(String(estimateMinutes(title, description) / 60));
      setStep("review");
    }, 2500);
    return () => window.clearTimeout(t);
  }, [step, title, description]);

  function submitForm(ev: React.FormEvent) {
    ev.preventDefault();
    if (!title.trim()) return setError("Please give your assignment a title.");
    if (!date || !time || !Number.isFinite(+new Date(due)) || +new Date(due) <= Date.now()) {
      return setError("Choose a due date and time in the future.");
    }
    setError(null);
    setStep("estimating");
  }

  const minutes = Math.round(Number(hours) * 60);
  const hoursValid = hours.trim() !== "" && Number.isFinite(Number(hours)) && Number(hours) >= 0.5 && (Number(hours) * 2) % 1 === 0;
  function bump(delta: number) {
    const cur = Number.isFinite(Number(hours)) ? Number(hours) : 1;
    setHours(String(Math.max(0.5, Math.round((cur + delta) * 2) / 2)));
  }

  function schedule(ev: React.FormEvent) {
    ev.preventDefault();
    if (!hoursValid) return setError("Choose at least 0.5 hours, in half-hour steps.");
    setSaving(true);
    try {
      const planned = scheduleAssignment(
        { id: idRef.current, title, description: description.trim(), due: new Date(due).toISOString(), estimatedMinutes: minutes },
        assignments,
      );
      const list = [...assignments, planned];
      saveAssignments(list);
      onDone(planned, list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Nothing was scheduled.");
      setSaving(false);
    }
  }

  const errorBox = error && (
    <p role="alert" data-testid="text-form-error" className="rounded-xl bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">{error}</p>
  );

  if (step === "estimating") {
    return (
      <div className="py-6 text-center" role="status" data-testid="status-estimating">
        <DialogHeader className="items-center">
          <DialogTitle ref={headingRef} tabIndex={-1} className="font-serif text-2xl outline-none">Sizing up the work</DialogTitle>
          <DialogDescription>Reading "{title.trim()}" and guessing how long it takes. Demo estimate, not real AI.</DialogDescription>
        </DialogHeader>
        <div className="my-8 flex items-end justify-center gap-2 h-16" aria-hidden>
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} className="w-3 rounded-full bg-accent-foreground/70 animate-bounce" style={{ height: 24 + (i % 3) * 14, animationDelay: `${i * 120}ms` }} />
          ))}
        </div>
        <button onClick={() => setStep("form")} data-testid="button-cancel-estimate" className="h-10 px-5 rounded-full border text-sm font-semibold hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Back to edit</button>
      </div>
    );
  }

  if (step === "review") {
    return (
      <form onSubmit={schedule} className="space-y-4" noValidate>
        <DialogHeader>
          <DialogTitle ref={headingRef} tabIndex={-1} className="font-serif text-2xl outline-none flex items-center gap-2"><Sparkles className="size-5 text-accent-foreground" aria-hidden />Here's the plan size</DialogTitle>
          <DialogDescription>"{title.trim()}", due {fmtDue(new Date(due).toISOString())}. Adjust the hours if our guess is off.</DialogDescription>
        </DialogHeader>
        <div>
          <label htmlFor="est-hours" className="text-sm font-semibold">Estimated hours</label>
          <div className="mt-1.5 flex items-center gap-2">
            <button type="button" aria-label="Decrease by half an hour" onClick={() => bump(-0.5)} data-testid="button-hours-down" className="grid size-11 place-items-center rounded-xl border hover:bg-secondary active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Minus className="size-4" /></button>
            <input id="est-hours" type="number" inputMode="decimal" min={0.5} step={0.5} value={hours} onChange={(e) => { setHours(e.target.value); setError(null); }} aria-describedby="est-hint" aria-invalid={!hoursValid} data-testid="input-hours" className={`${fieldCls} text-center text-lg font-semibold`} />
            <button type="button" aria-label="Increase by half an hour" onClick={() => bump(0.5)} data-testid="button-hours-up" className="grid size-11 place-items-center rounded-xl border hover:bg-secondary active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Plus className="size-4" /></button>
          </div>
          <p id="est-hint" className="mt-1.5 text-xs text-muted-foreground" data-testid="text-hours-hint">
            {hoursValid ? `That's ${durationLabel(minutes)} of focused time, split into 30 or 60 minute sessions.` : "Minimum 0.5 hours, in steps of 0.5."}
          </p>
        </div>
        {errorBox}
        <div className="flex flex-wrap gap-2 justify-end">
          <button type="button" onClick={() => { setError(null); setStep("form"); }} data-testid="button-back-edit" className="h-10 px-5 rounded-full border text-sm font-semibold hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Back to edit</button>
          <button type="submit" disabled={saving || !hoursValid} data-testid="button-schedule" className="h-10 px-5 rounded-full bg-primary text-primary-foreground text-sm font-semibold active:scale-95 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">Schedule sessions</button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={submitForm} className="space-y-4" noValidate>
      <DialogHeader>
        <DialogTitle className="font-serif text-2xl">Add an assignment</DialogTitle>
        <DialogDescription>Tell us what's due. We'll find the time. Sessions fit between 8 am and 9 pm.</DialogDescription>
      </DialogHeader>
      <div>
        <label htmlFor="a-title" className="text-sm font-semibold">Title</label>
        <input id="a-title" autoFocus value={title} onChange={(e) => { setTitle(e.target.value); setError(null); }} data-testid="input-title" className={`${fieldCls} mt-1.5`} placeholder="Essay on memory and sleep" autoComplete="off" />
      </div>
      <div>
        <label htmlFor="a-desc" className="text-sm font-semibold">Description <span className="font-normal text-muted-foreground">(optional)</span></label>
        <textarea id="a-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} data-testid="input-description" className={`${fieldCls} mt-1.5 h-auto py-2.5 resize-none`} placeholder="Length, sources, anything that affects effort" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="a-date" className="text-sm font-semibold">Due date</label>
          <input id="a-date" type="date" value={date} onChange={(e) => { setDate(e.target.value); setError(null); }} data-testid="input-due-date" className={`${fieldCls} mt-1.5`} />
        </div>
        <div>
          <label htmlFor="a-time" className="text-sm font-semibold">Due time</label>
          <input id="a-time" type="time" value={time} onChange={(e) => { setTime(e.target.value); setError(null); }} data-testid="input-due-time" className={`${fieldCls} mt-1.5`} />
        </div>
      </div>
      {errorBox}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} data-testid="button-cancel-add" className="h-10 px-5 rounded-full border text-sm font-semibold hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Cancel</button>
        <button type="submit" data-testid="button-estimate" className="h-10 px-5 rounded-full bg-primary text-primary-foreground text-sm font-semibold active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">Estimate effort</button>
      </div>
    </form>
  );
}
