---
name: Workspace package helper
description: Limitations of the managed package-install helper in this pnpm workspace.
---

The managed package-install helper cannot accept an empty package list and may run a root-level `pnpm add` without the workspace flag.

**Why:** When only updating overrides and removing a dependency, the helper rejected an empty list; requesting an existing package then failed pnpm's workspace-root safeguard.

**How to apply:** Consult the package-management skill first. If the helper still lacks workspace support, synchronize the existing manifests and lockfile with pnpm directly rather than adding an unrelated package or disabling workspace safeguards.
