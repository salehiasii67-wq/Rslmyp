---
name: TraderMind OS import
description: How the TraderMind project was restored from uploaded zip files into this Replit workspace.
---

## What was done
- `createArtifact({ artifactType: "react-vite", slug: "tradermind", previewPath: "/", title: "TraderMind OS" })` registered the artifact (port 23583 assigned by Replit)
- Extracted `tradermind-web_1785328038376.zip` → `artifacts/tradermind/` (excluding `.replit-artifact/`)
- Extracted `lib_1785328038456.zip` → `lib/` (excluding `dist/` and `.tsbuildinfo`)
- Extracted `scripts_1785328038434.zip` → `scripts/`
- Replaced root `pnpm-workspace.yaml`, `tsconfig.json`, `tsconfig.base.json` from uploaded txt/json files
- Replaced `pnpm-lock.yaml` from uploaded txt file
- Ran `pnpm install --no-frozen-lockfile` (560 packages added)

## Key facts
- **Offline-first**: uses Dexie v4 (IndexedDB schema v21) — no PostgreSQL or API server needed for the main app
- **Persian/RTL UI** with Vazirmatn font; dark mode default
- **Web Worker** at `src/workers/analytics.worker.ts` for heavy analytics
- **State**: Zustand v5, always use `useShallow` selectors
- **Repos pattern**: never raw `db.x.toArray()` — always go through `src/core/repositories/`
- Electron scripts exist in package.json but are unused in Replit; peer dep warning for `electron-builder-squirrel-windows` is harmless

**Why:** The user uploaded the project as zips from another environment and wanted it running here.

**How to apply:** If rebuilding from scratch, use the same createArtifact → extract → pnpm install sequence. Keep `.replit-artifact/artifact.toml` from Replit (do not overwrite with zip version).
