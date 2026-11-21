import { lookup } from "node:dns/promises";
import { request as httpsRequest } from "node:https";
import { request as httpRequest } from "node:http";
import ipaddr from "ipaddr.js";

const MAX_BYTES = 1024 * 1024;
export function calendarUrl(input: string): URL {
  let url: URL;
  try { url = new URL(input.trim().replace(/^webcal:/i, "https:")); }
  catch { throw new Error("Enter a valid public iCalendar (.ics) link."); }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password ||
    (url.port && url.port !== (url.protocol === "https:" ? "443" : "80"))) {
    throw new Error("Use a public HTTP, HTTPS, or webcal calendar link without login credentials.");
  }
  return url;
}

export function isPublicAddress(address: string): boolean {
  try {
    const parsed = ipaddr.process(address);
    return parsed.range() === "unicast";
  } catch { return false; }
}

export async function fetchCalendar(input: string, redirects = 0): Promise<string> {
  const url = calendarUrl(input);
  // Resolve once, reject every non-public result, and pin the connection to the
  // validated address. Redirects go through this same check to prevent SSRF.
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  let timer: ReturnType<typeof setTimeout> | undefined;
  const addresses = await Promise.race([
    lookup(hostname, { all: true }),
    new Promise<never>((_resolve, reject) => { timer = setTimeout(() => reject(new Error("The calendar host took too long to respond.")), 5000); }),
  ]).finally(() => { if (timer) clearTimeout(timer); });
  if (!addresses.length || addresses.some((entry) => !isPublicAddress(entry.address))) {
    throw new Error("Only publicly accessible calendar hosts can be imported.");
  }
  const address = addresses[0]!;
  return new Promise((resolve, reject) => {
    const request = (url.protocol === "https:" ? httpsRequest : httpRequest)(url, {
      method: "GET",
      headers: { Accept: "text/calendar", "Accept-Encoding": "identity", "User-Agent": "Tempo-Calendar-Import/1.0" },
      family: address.family,
      lookup: (_host, _options, callback) => callback(null, address.address, address.family),
      signal: AbortSignal.timeout(12_000),
    }, (response) => {
      if ([301, 302, 303, 307, 308].includes(response.statusCode ?? 0)) {
        response.resume();
        if (redirects >= 3 || !response.headers.location) {
          reject(new Error("The calendar link redirected too many times."));
          return;
        }
        try {
          const target = new URL(response.headers.location, url);
          fetchCalendar(target.toString(), redirects + 1).then(resolve, reject);
        } catch { reject(new Error("The calendar link returned an invalid redirect.")); }
        return;
      }
      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error("The calendar could not be downloaded. Check that the link is public and does not require sign-in."));
        return;
      }
      let size = 0;
      const chunks: Buffer[] = [];
      response.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > MAX_BYTES) {
          response.destroy();
          reject(new Error("This calendar exceeds the 1 MB import limit."));
        } else chunks.push(chunk);
      });
      response.on("error", () => reject(new Error("The calendar download was interrupted.")));
      response.on("end", () => {
        const content = Buffer.concat(chunks).toString("utf8").replace(/^\uFEFF/, "").trim();
        if (!content.startsWith("BEGIN:VCALENDAR") || !content.endsWith("END:VCALENDAR")) {
          reject(new Error("This link returned a webpage or unsupported file. Use the calendar’s public iCalendar (.ics) feed link."));
        } else resolve(content);
      });
    });
    request.on("error", () => reject(new Error("The calendar host could not be reached. Check the link and try again.")));
    request.end();
  });
}
