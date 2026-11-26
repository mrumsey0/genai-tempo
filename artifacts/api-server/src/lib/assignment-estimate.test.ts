import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { createEstimator, parseEstimate, EstimateFailure } from "./assignment-estimate";
import { createEstimateRouter } from "../routes/openai/estimate";

const input = { title: "  Biology essay  ", description: "  Write 1,000 words using three sources.  " };
const valid = JSON.stringify({
  estimatedMinutes: 135,
  explanation: "Read sources, outline, write a draft, and revise.",
  assumptions: ["Sources are provided.", "No lab work is required."],
});
const controller = () => new AbortController();
const expectStatus = (status: number) => (error: unknown) => error instanceof EstimateFailure && error.status === status;

test("estimation sends only trimmed title and description and rounds effort up", async () => {
  const estimate = createEstimator(async (data, signal) => {
    assert.deepEqual(data, { title: input.title.trim(), description: input.description.trim() });
    assert.equal(signal.aborted, false);
    return valid;
  });
  const result = await estimate(input, controller().signal);
  assert.equal(result.estimatedMinutes, 150);
  assert.equal(result.model, "gpt-5-nano");
  assert.equal(result.assumptions.length, 2);
});
test("invalid input and unexpected fields never call the AI", async () => {
  let calls = 0;
  const estimate = createEstimator(async () => { calls++; return valid; });
  for (const body of [null, {}, { ...input, title: " " }, { ...input, title: "a".repeat(201) },
    { ...input, description: "a".repeat(6001) }, { ...input, description: 3 },
    { ...input, model: "expensive-model" }, { ...input, calendars: [] }]) {
    await assert.rejects(estimate(body, controller().signal), expectStatus(400));
  }
  assert.equal(calls, 0);
  await estimate({ title: "Read", description: "" }, controller().signal);
  assert.equal(calls, 1);
});
test("malformed, out-of-bounds, and incomplete AI output fail without a fake estimate", () => {
  const value = JSON.parse(valid);
  for (const content of ["no json", "null", "[]", JSON.stringify({ ...value, estimatedMinutes: "120" }),
    JSON.stringify({ ...value, estimatedMinutes: 0 }), JSON.stringify({ ...value, estimatedMinutes: 2401 }),
    JSON.stringify({ ...value, explanation: " " }), JSON.stringify({ ...value, explanation: "a".repeat(901) }),
    JSON.stringify({ ...value, assumptions: ["a".repeat(181)] }), JSON.stringify({ estimatedMinutes: 60 })]) {
    assert.throws(() => parseEstimate(content), expectStatus(502));
  }
});
test("concurrency limit blocks a third request and releases capacity", async () => {
  let release!: (value: string) => void;
  let calls = 0;
  const waiting = new Promise<string>((resolve) => { release = resolve; });
  const estimate = createEstimator(async () => { calls++; return waiting; });
  const a = estimate(input, controller().signal), b = estimate(input, controller().signal);
  await assert.rejects(estimate(input, controller().signal), expectStatus(429));
  assert.equal(calls, 2);
  release(valid);
  await Promise.all([a, b]);
  await estimate(input, controller().signal);
  assert.equal(calls, 3);
});
test("minute allowance has Retry-After and recovers in the next minute", async () => {
  let time = 0, calls = 0;
  const estimate = createEstimator(async () => { calls++; return valid; }, { now: () => time });
  for (let i = 0; i < 5; i++) await estimate(input, controller().signal);
  await assert.rejects(estimate(input, controller().signal), (e: unknown) => e instanceof EstimateFailure && e.status === 429 && e.retryAfter === 60);
  assert.equal(calls, 5);
  time = 60_000;
  await estimate(input, controller().signal);
  assert.equal(calls, 6);
});
test("daily allowance caps provider calls even across minute windows", async () => {
  let time = 0, calls = 0;
  const estimate = createEstimator(async () => { calls++; return valid; }, { now: () => time });
  for (let i = 0; i < 25; i++) { time = i * 60_000; await estimate(input, controller().signal); }
  await assert.rejects(estimate(input, controller().signal), expectStatus(429));
  assert.equal(calls, 25);
  time = 86_400_000;
  await estimate(input, controller().signal);
  assert.equal(calls, 26);
});
test("provider failures do not leak diagnostics and release capacity without retrying", async () => {
  let calls = 0;
  const estimate = createEstimator(async () => { calls++; throw new Error("PRIVATE PROVIDER DIAGNOSTICS"); });
  for (let i = 0; i < 3; i++) {
    await assert.rejects(estimate(input, controller().signal), (e: unknown) =>
      e instanceof EstimateFailure && e.status === 503 && !e.message.includes("PRIVATE"));
  }
  assert.equal(calls, 3);
});
test("timeouts abort the provider and return a manual-entry option", async () => {
  let signal: AbortSignal | undefined;
  const estimate = createEstimator(async (_input, requestSignal) => {
    signal = requestSignal;
    await new Promise((resolve) => setTimeout(resolve, 35));
    return valid;
  }, { timeoutMs: 5 });
  await assert.rejects(estimate(input, controller().signal), expectStatus(504));
  assert.equal(signal?.aborted, true);
});
test("cancelled requests abort the provider and cannot return a late estimate", async () => {
  let signal: AbortSignal | undefined;
  const estimate = createEstimator(async (_input, requestSignal) => {
    signal = requestSignal;
    await new Promise((resolve) => setTimeout(resolve, 15));
    return valid;
  });
  const request = controller();
  const pending = estimate(input, request.signal);
  request.abort();
  await assert.rejects(pending, expectStatus(503));
  assert.equal(signal?.aborted, true);
});
test("HTTP contract enforces JSON, cross-site protection, validation, and privacy headers", async () => {
  let calls = 0;
  const app = express();
  app.use(express.json({ limit: "16kb" }));
  app.use("/api", createEstimateRouter(async () => { calls++; return valid; }));
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/openai/estimate`;
  try {
    let response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal((await response.json()).estimatedMinutes, 150);
    response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", "Sec-Fetch-Site": "cross-site" }, body: JSON.stringify(input) });
    assert.equal(response.status, 403);
    response = await fetch(url, { method: "POST", headers: { "Content-Type": "text/plain" }, body: "invalid" });
    assert.equal(response.status, 400);
    response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: "" }) });
    assert.equal(response.status, 400);
    assert.equal(calls, 1);
  } finally { server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); }
});
