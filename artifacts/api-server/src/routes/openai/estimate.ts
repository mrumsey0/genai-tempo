import { Router, type IRouter } from "express";
import { createEstimator, EstimateFailure, type EstimateGenerator } from "../../lib/assignment-estimate";

export function createEstimateRouter(generate: EstimateGenerator): IRouter {
  const router: IRouter = Router();
  const estimate = createEstimator(generate);
  router.post("/openai/estimate", async (req, res): Promise<void> => {
    res.setHeader("Cache-Control", "no-store");
    if (req.get("sec-fetch-site") === "cross-site") {
      res.status(403).json({ error: "Open Tempo directly to request an estimate." }); return;
    }
    if (!req.is("application/json")) {
      res.status(400).json({ error: "Send assignment details as JSON." }); return;
    }
    const controller = new AbortController();
    const disconnect = () => { if (!res.writableEnded) controller.abort(); };
    res.on("close", disconnect);
    try {
      const result = await estimate(req.body, controller.signal);
      if (!res.destroyed) res.json(result);
    } catch (error) {
      if (res.destroyed) return;
      // Never forward provider errors, credentials, prompts, or responses to logs or clients.
      const failure = error instanceof EstimateFailure ? error :
        new EstimateFailure(503, "AI estimates are temporarily unavailable. Enter hours manually or try again.");
      if (failure.retryAfter) res.setHeader("Retry-After", String(failure.retryAfter));
      res.status(failure.status).json({ error: failure.message });
    } finally { res.off("close", disconnect); }
  });
  return router;
}
