import { test } from "node:test";
import assert from "node:assert/strict";
import { calendarUrl, isPublicAddress, fetchCalendar } from "./calendar-fetch.ts";

test("calendar URLs accept standard public protocols and normalize webcal", () => {
  assert.equal(calendarUrl("webcal://example.com/calendar.ics").protocol, "https:");
  for (const url of ["file:///etc/passwd", "ftp://example.com/a", "https://user:pass@example.com/a", "https://example.com:1234/a", "bad"]) {
    assert.throws(() => calendarUrl(url));
  }
});
test("import connections reject private, loopback, link-local, mapped and reserved IPs", async () => {
  for (const ip of ["127.0.0.1", "10.1.1.1", "172.16.0.1", "192.168.1.1", "169.254.169.254", "0.0.0.0", "::1", "fe80::1", "fc00::1", "::ffff:127.0.0.1", "100.64.0.1", "224.0.0.1"]) {
    assert.equal(isPublicAddress(ip), false, ip);
  }
  assert.equal(isPublicAddress("8.8.8.8"), true);
  assert.equal(isPublicAddress("2606:4700:4700::1111"), true);
  await assert.rejects(fetchCalendar("http://127.0.0.1/feed.ics"), /publicly accessible/);
  await assert.rejects(fetchCalendar("http://[::1]/feed.ics"), /publicly accessible/);
});
