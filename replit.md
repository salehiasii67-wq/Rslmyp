# TraderMind OS

یک ژورنال معاملاتی و پلتفرم آنالیتیکس آفلاین-اول جامع. تمام داده‌ها به صورت محلی در مرورگر از طریق IndexedDB ذخیره می‌شوند — بدون سرور، بدون cloud sync.

## Run & Operate

- `pnpm --filter @workspace/tradermind run dev` — run the TraderMind web app
- `pnpm --filter @workspace/api-server run dev` — run the API server (not used by main app)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 19, Vite 7, Tailwind CSS v4
- DB: Dexie v4 (IndexedDB, schema v21) — fully offline, no server DB needed
- State: Zustand v5 (always use `useShallow` selectors)
- Data fetching: TanStack Query v5
- Virtualization: @tanstack/react-virtual v3
- Analytics: Custom metrics engine + Web Worker
- Charts: Recharts
- i18n: Persian (Farsi / RTL) — Vazirmatn font

## Where things live

| Path | Purpose |
|------|---------|
| `artifacts/tradermind/src/db/database.ts` | Dexie schema v21 |
| `artifacts/tradermind/src/core/repositories/` | Typed Dexie queries |
| `artifacts/tradermind/src/core/metrics/` | Pure metric functions |
| `artifacts/tradermind/src/services/analyticsEngine.ts` | Analytics orchestrator |
| `artifacts/tradermind/src/workers/analytics.worker.ts` | Web Worker |
| `artifacts/tradermind/src/hooks/useTradeAnalytics.ts` | React Query hook |
| `artifacts/tradermind/src/store/useAppStore.ts` | Zustand store |

## Architecture decisions

- Offline-first: IndexedDB via Dexie — no server required
- Web Worker for heavy analytics to keep UI thread responsive
- Repository pattern for all DB reads (never raw `db.x.toArray()`)
- In-memory analytics cache (`analyticsCacheService`) — invalidated on DB writes
- AbortController guards in async hooks

## User preferences

- Persian (Farsi) UI — maintain RTL layout
- Dark mode default
- Offline-first — no API calls, no auth required

## Gotchas

- Always use `useShallow` when selecting from Zustand store
- Never use raw `db.x.toArray()` — always go through repositories
- Electron-related scripts (`electron:dev`, `electron:build`) are not used in Replit

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
