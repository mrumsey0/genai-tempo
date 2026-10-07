import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import type { Plugin, ResolvedConfig } from "vite";
import { mockupPreviewPlugin } from "./mockupPreviewPlugin.ts";

// Invoke the same discovery hooks used by Vite without starting a dev server.
async function refresh(plugin: Plugin): Promise<void> {
  const hook = plugin.buildStart;
  assert.equal(typeof hook, "function");
  await (hook as () => Promise<void>)();
}

test("mockup discovery includes only visible TSX files and refreshes additions/deletions", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "mockup-discovery-"));
  try {
    const fixtureFiles = [
      "Zebra.tsx",
      "nested/Alpha.tsx",
      "_Private.tsx",
      "_internal/Hidden.tsx",
      "nested/_internal/Hidden.tsx",
      ".Hidden.tsx",
      ".internal/Hidden.tsx",
      "nested/.Hidden.tsx",
      "notes.ts",
    ];
    const mockups = path.join(root, "src/components/mockups");
    for (const file of fixtureFiles) {
      await mkdir(path.dirname(path.join(mockups, file)), { recursive: true });
      await writeFile(path.join(mockups, file), "export default () => null;");
    }
    await mkdir(path.join(mockups, "Directory.tsx"));
    await symlink(path.join(mockups, "Zebra.tsx"), path.join(mockups, "Linked.tsx"));

    const plugin = mockupPreviewPlugin();
    const configHook = plugin.configResolved;
    assert.equal(typeof configHook, "function");
    (configHook as (config: ResolvedConfig) => void)({ root } as ResolvedConfig);
    await refresh(plugin);

    const generated = path.join(root, "src/.generated/mockup-components.ts");
    const source = await readFile(generated, "utf8");
    assert.match(source, /"\.\/components\/mockups\/Zebra\.tsx"/);
    assert.match(source, /import\("\.\.\/components\/mockups\/nested\/Alpha\.tsx"\)/);
    assert.match(source, /"\.\/components\/mockups\/Linked\.tsx"/);
    for (const excluded of fixtureFiles.slice(2).concat("Directory.tsx")) {
      assert.ok(!source.includes(excluded), `must exclude ${excluded}`);
    }
    assert.ok(source.indexOf("Linked.tsx") < source.indexOf("Zebra.tsx"));

    await writeFile(path.join(mockups, "Added.tsx"), "export default () => null;");
    await rm(path.join(mockups, "nested/Alpha.tsx"));
    await refresh(plugin);
    const updated = await readFile(generated, "utf8");
    assert.match(updated, /Added\.tsx/);
    assert.ok(!updated.includes("Alpha.tsx"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
