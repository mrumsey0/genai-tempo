---
name: Browser verification
description: Runtime limitations encountered while verifying interactive flows in this workspace.
---

Do not assume the installed testing skill's specialized subagent kind or Playwright's default downloaded browser is available in this runtime.

**Why:** The runtime rejected the documented testing subagent kind, and the default Playwright browser cache was missing even though direct browser automation was possible.

**How to apply:** When browser verification is needed, check current runtime support. If the specialized tester is unavailable, use direct Playwright with the supported system Chromium executable rather than repeatedly retrying the unsupported kind or relying on an absent browser download.
