import { Router, type IRouter } from "express";
import { ImportCalendarBody, ImportCalendarResponse } from "@workspace/api-zod";
import { fetchCalendar } from "../lib/calendar-fetch";

const router: IRouter = Router();
let active = 0;
let windowStart = Date.now();
let requests = 0;

router.post("/calendars/import", async (req, res): Promise<void> => {
  res.setHeader("Cache-Control", "no-store");
  const parsed = ImportCalendarBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Enter a public calendar link of at most 4096 characters." });
    return;
  }
  if (Date.now() - windowStart > 60_000) { windowStart = Date.now(); requests = 0; }
  if (active >= 4 || requests >= 30) {
    res.status(429).json({ error: "Too many calendar imports. Please wait a minute and try again." });
    return;
  }
  active++;
  requests++;
  try {
    // The source URL and feed contents are never stored or logged.
    const content = await fetchCalendar(parsed.data.url);
    res.json(ImportCalendarResponse.parse({ content }));
  } catch (error) {
    // Do not forward arbitrary DNS/TLS errors that could expose source URLs.
    const message = error instanceof Error && !("code" in error)
      ? error.message : "The calendar host could not be reached. Check the link and try again.";
    res.status(400).json({ error: message });
  } finally { active--; }
});

export default router;
