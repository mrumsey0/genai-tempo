---
name: Workspace package helper
description: Limitations of the managed package-install helper in this pnpm workspace.
---

The managed package-install helper cannot accept an empty package list and may run a root-level `pnpm add` without the workspace flag.

**Why:** When only updating overrides and removing a dependency, the helper rejected an empty list; requesting an existing package then failed pnpm's workspace-root safeguard.

**How to apply:** Consult the package-management skill first. If the helper still lacks workspace support, synchronize the existing manifests and lockfile with pnpm directly rather than adding an unrelated package or disabling workspace safeguards.

Dependency upgrades must be checked against the resolved lockfile, not just the parent package version.

**Why:** Recursive selective updates and upgrades to the latest direct parent can retain vulnerable transitive versions that still satisfy the parent's range.

**How to apply:** Run the dependency audit after resolution. If the latest parent still permits a vulnerable dependency, enforce a compatible patched minimum rather than assuming a parent upgrade refreshed it.

Preserve the workspace YAML's explanatory comments when using pnpm update.

**Why:** Updating catalog-backed dependencies can rewrite the whole YAML file and strip security-policy comments even though the settings remain enabled.

**How to apply:** Keep the annotated structure intact and inspect the workspace configuration diff after package-manager commands.
