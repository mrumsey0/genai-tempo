import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Check, AlertTriangle, Trash2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { loadSettings, saveSettings, clearTempoData, DEFAULT_SETTINGS, type PlannerSettings } from "@/lib/settings";

function formatMinutes(m: number): string {
  if (m === 1440) return "Midnight (end of day)";
  const h = Math.floor(m / 60);
  const min = m % 60;
  const suffix = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${min.toString().padStart(2, "0")} ${suffix}`;
}

const START_OPTIONS = Array.from({ length: 48 }, (_, i) => i * 30);
const END_OPTIONS = Array.from({ length: 48 }, (_, i) => (i + 1) * 30);

export default function Settings() {
  const [, navigate] = useLocation();
  const initial = useMemo(() => loadSettings(), []);
  const [loadError, setLoadError] = useState<string | undefined>(initial.error);
  const [saved, setSaved] = useState<PlannerSettings>(initial.settings ?? DEFAULT_SETTINGS);
  const [draft, setDraft] = useState<PlannerSettings>(initial.settings ?? DEFAULT_SETTINGS);
  const [status, setStatus] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [clearError, setClearError] = useState<string | null>(null);

  useEffect(() => {
    const prev = document.title;
    document.title = "Tempo settings";
    return () => { document.title = prev; };
  }, []);

  const rangeInvalid = draft.workEnd <= draft.workStart;
  const dirty = draft.weekStartsOn !== saved.weekStartsOn || draft.workStart !== saved.workStart || draft.workEnd !== saved.workEnd;

  function update(patch: Partial<PlannerSettings>) {
    setDraft((d) => ({ ...d, ...patch }));
    setStatus(null);
    setSaveError(null);
  }

  function handleSave() {
    setStatus(null);
    setSaveError(null);
    if (loadError) return;
    if (rangeInvalid) { setSaveError("End time must be after start time."); return; }
    try {
      saveSettings(draft);
      setSaved(draft);
      setStatus("Settings saved. New study sessions will use these hours.");
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Couldn't save your settings.");
    }
  }

  function handleClear() {
    setClearError(null);
    try {
      clearTempoData();
      setLoadError(undefined);
      setDialogOpen(false);
      navigate("/");
    } catch (e) {
      setClearError(e instanceof Error ? e.message : "Couldn't clear your data. Nothing was removed.");
    }
  }

  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="border-b bg-card/70 backdrop-blur sticky top-0 z-30">
        <div className="mx-auto max-w-3xl px-4 sm:px-8 py-3 flex items-center gap-3">
          <Link href="/" data-testid="link-back-planner"
            className="inline-flex items-center gap-2 rounded-full border bg-card px-4 h-10 text-sm font-semibold hover:-translate-y-0.5 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <ArrowLeft className="size-4" aria-hidden /> Back to planner
          </Link>
          <span className="ml-auto font-serif text-xl font-semibold tracking-tight">Tempo</span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 sm:px-8 py-8 space-y-8">
        <div>
          <p className="text-sm text-muted-foreground">Make the week fit you</p>
          <h1 className="font-serif text-3xl sm:text-4xl font-semibold tracking-tight" data-testid="text-settings-title">Settings</h1>
        </div>

        {loadError && (
          <div role="alert" data-testid="status-load-error"
            className="flex gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm">
            <AlertTriangle className="size-5 shrink-0 text-destructive" aria-hidden />
            <div>
              <p className="font-semibold text-destructive">Your saved settings couldn't be read.</p>
              <p className="text-muted-foreground mt-1">{loadError} Saving is paused so nothing is overwritten. Clear all data below to start fresh.</p>
            </div>
          </div>
        )}

        <section aria-labelledby="planning-heading" className="rounded-2xl border bg-card p-5 sm:p-7 space-y-6">
          <div>
            <h2 id="planning-heading" className="font-serif text-2xl font-semibold">Planning</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Work hours apply to newly scheduled study sessions and to sessions you move by hand. Sessions already on your calendar stay where they are.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="week-start">Week starts on</Label>
              <Select value={String(draft.weekStartsOn)} onValueChange={(v) => update({ weekStartsOn: Number(v) as 0 | 1 })}>
                <SelectTrigger id="week-start" data-testid="select-week-start" className="bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Sunday</SelectItem>
                  <SelectItem value="1">Monday</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="work-start">Study from</Label>
              <Select value={String(draft.workStart)} onValueChange={(v) => update({ workStart: Number(v) })}>
                <SelectTrigger id="work-start" data-testid="select-work-start" className="bg-background"><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {START_OPTIONS.map((m) => <SelectItem key={m} value={String(m)}>{formatMinutes(m)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="work-end">Study until</Label>
              <Select value={String(draft.workEnd)} onValueChange={(v) => update({ workEnd: Number(v) })}>
                <SelectTrigger id="work-end" data-testid="select-work-end" className="bg-background" aria-invalid={rangeInvalid}><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {END_OPTIONS.map((m) => <SelectItem key={m} value={String(m)}>{formatMinutes(m)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {rangeInvalid && <p className="text-sm text-destructive" data-testid="text-range-error">End time must be after start time.</p>}

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button onClick={handleSave} disabled={!!loadError || rangeInvalid} data-testid="button-save-settings"
              className="inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-5 h-10 text-sm font-semibold shadow-sm transition-transform active:scale-95 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
              Save settings
            </button>
            {dirty && !status && !saveError && <span className="text-sm text-muted-foreground">Unsaved changes</span>}
            <div aria-live="polite">
              {status && (
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary" data-testid="status-settings-saved">
                  <Check className="size-4" aria-hidden /> {status}
                </span>
              )}
            </div>
            {saveError && <p role="alert" className="text-sm text-destructive" data-testid="status-save-error">{saveError}</p>}
          </div>
        </section>

        <section aria-labelledby="data-heading" className="rounded-2xl border border-destructive/30 bg-card p-5 sm:p-7 space-y-4">
          <div>
            <h2 id="data-heading" className="font-serif text-2xl font-semibold">Your data</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Your assignments, calendars, and settings are saved only in this browser, not synced to other devices. Public calendar links are downloaded through our server for one-time import. AI estimates send only the assignment title and description through our server to OpenAI; calendars are not sent to AI. You can enter hours manually instead.
            </p>
          </div>
          <button onClick={() => { setClearError(null); setDialogOpen(true); }} data-testid="button-clear-data"
            className="inline-flex items-center gap-2 rounded-full bg-destructive text-destructive-foreground px-5 h-10 text-sm font-semibold transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
            <Trash2 className="size-4" aria-hidden /> Clear all data
          </button>
        </section>
      </main>

      <AlertDialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setClearError(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif">Clear all Tempo data?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes all assignments and study sessions, your personal, imported, and sample calendars, and resets your settings to their defaults in this browser. It can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {clearError && <p role="alert" className="text-sm text-destructive" data-testid="status-clear-error">{clearError}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-clear-data">Cancel</AlertDialogCancel>
            <button type="button" onClick={handleClear} data-testid="button-confirm-clear-data"
              className="inline-flex items-center justify-center gap-2 rounded-md bg-destructive text-destructive-foreground px-4 h-9 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              Clear everything
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
