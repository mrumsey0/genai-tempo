import { EstimateAssignmentBody, EstimateAssignmentResponse } from "@workspace/api-zod";

export const ESTIMATE_MODEL = "gpt-5-nano" as const;
export const ESTIMATE_TIMEOUT_MS = 25_000;
export type EstimateInput = { title: string; description: string };
export type EstimateGenerator = (input: EstimateInput, signal: AbortSignal) => Promise<string>;

export class EstimateFailure extends Error {
  constructor(public status: number, message: string, public retryAfter?: number) { super(message); }
}

export function parseEstimate(content: string) {
  try {
    const value = JSON.parse(content);
    // Scheduling works in half hours. Round up, never silently shorten effort.
    if (typeof value.estimatedMinutes !== "number" || !Number.isFinite(value.estimatedMinutes) ||
      value.estimatedMinutes < 30 || value.estimatedMinutes > 2400) throw new Error("Invalid duration");
    return EstimateAssignmentResponse.parse({
      estimatedMinutes: Math.ceil(value.estimatedMinutes / 30) * 30,
      explanation: typeof value.explanation === "string" ? value.explanation.trim() : value.explanation,
      assumptions: Array.isArray(value.assumptions) ? value.assumptions.map((a: unknown) => typeof a === "string" ? a.trim() : a) : value.assumptions,
      model: ESTIMATE_MODEL,
    });
  } catch {
    throw new EstimateFailure(502, "AI returned an unusable estimate. Try again or enter the hours yourself.");
  }
}

/** Shared per-server limits, not authentication or a durable billing cap. No prompts are retained. */
export function createEstimator(generate: EstimateGenerator, options: { now?: () => number; timeoutMs?: number } = {}) {
  const now = options.now ?? Date.now;
  let active = 0, minute = -1, minuteRequests = 0, day = -1, dayRequests = 0;
  return async (body: unknown, signal: AbortSignal) => {
    const parsed = EstimateAssignmentBody.strict().safeParse(body);
    if (!parsed.success || !parsed.data.title.trim()) {
      throw new EstimateFailure(400, "Enter a title of 1–200 characters and a description of up to 6,000 characters.");
    }
    const time = now(), currentMinute = Math.floor(time / 60_000), currentDay = Math.floor(time / 86_400_000);
    if (minute !== currentMinute) { minute = currentMinute; minuteRequests = 0; }
    if (day !== currentDay) { day = currentDay; dayRequests = 0; }
    if (dayRequests >= 100) throw new EstimateFailure(429, "The shared daily AI allowance has been reached. Enter hours manually or try tomorrow.", Math.ceil(((day + 1) * 86_400_000 - time) / 1000));
    if (minuteRequests >= 10) throw new EstimateFailure(429, "Too many AI estimates. Wait a minute or enter hours manually.", Math.ceil(((minute + 1) * 60_000 - time) / 1000));
    if (active >= 2) throw new EstimateFailure(429, "AI is busy with other estimates. Wait a moment or enter hours manually.", 5);
    if (signal.aborted) throw new EstimateFailure(503, "The estimate was cancelled.");
    active++; minuteRequests++; dayRequests++;
    const deadline = AbortSignal.timeout(options.timeoutMs ?? ESTIMATE_TIMEOUT_MS);
    const combined = AbortSignal.any([signal, deadline]);
    let onAbort: () => void = () => {};
    try {
      const interrupted = new Promise<never>((_resolve, reject) => {
        onAbort = () => reject(new EstimateFailure(deadline.aborted ? 504 : 503,
          deadline.aborted ? "AI took too long. Try again or enter the hours yourself." : "The estimate was cancelled."));
        combined.addEventListener("abort", onAbort, { once: true });
        if (combined.aborted) onAbort();
      });
      const content = await Promise.race([
        generate({ title: parsed.data.title.trim(), description: parsed.data.description.trim() }, combined),
        interrupted,
      ]);
      return parseEstimate(content);
    } catch (error) {
      if (error instanceof EstimateFailure) throw error;
      if (deadline.aborted) throw new EstimateFailure(504, "AI took too long. Try again or enter the hours yourself.");
      throw new EstimateFailure(503, "AI estimates are temporarily unavailable. Try again or enter the hours yourself.");
    } finally {
      combined.removeEventListener("abort", onAbort);
      active--;
    }
  };
}
