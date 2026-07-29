# TraderMind OS (imported & running)

## Overview
TraderMind OS is a comprehensive offline-first trading journal and analytics platform built with React + Vite. All data is stored locally in the browser via IndexedDB (Dexie.js). No server, no cloud sync — fully private.

## Architecture
- **Frontend**: React 19, TypeScript, Vite 7
- **Styling**: Tailwind CSS v4, Radix UI, shadcn/ui
- **Database**: Dexie v4 (IndexedDB), schema v21
- **State**: Zustand (with `useShallow` selectors for performance)
- **Data fetching**: TanStack Query v5
- **Virtualization**: @tanstack/react-virtual v3 (TradeJournal, large lists)
- **Analytics**: Custom metrics engine + Web Worker (analytics.worker.ts)
- **Charts**: Recharts
- **i18n**: Persian (Farsi / RTL) — full support via Vazirmatn font

## Artifact Layout
- `artifacts/tradermind/` — Main React web app (slug: `tradermind`, preview: `/`)
- `artifacts/api-server/` — API server (not used by main app — offline-first)

## Key Directories (inside `artifacts/tradermind/src/`)
| Path | Purpose |
|------|---------|
| `db/database.ts` | Dexie schema v21 (Trade, Strategy, Account, DailyJournal, …) |
| `core/repositories/` | Typed Dexie queries — always use instead of `db.x.toArray()` |
| `core/metrics/` | Pure metric functions (PnL, win-rate, expectancy, risk, …) |
| `services/analyticsEngine.ts` | Main analytics orchestrator |
| `services/analyticsCacheService.ts` | In-memory analytics cache (invalidated on DB writes) |
| `services/seedService.ts` | Dev tool — generates 10k synthetic trades for perf testing |
| `workers/analytics.worker.ts` | Web Worker for heavy off-thread analytics |
| `hooks/useTradeAnalytics.ts` | React Query hook — AbortController guards |
| `hooks/useAllTrades.ts` | React Query hook — uses repository |
| `store/useAppStore.ts` | Zustand store (always use `useShallow` selectors) |
| `pages/TradeJournal.tsx` | Virtualized trade list (react-virtual) |

## Prompt 3 — Performance Hardening (done)
- Repository pattern for all DB reads (no raw `db.x.toArray()`)
- In-memory analytics cache (`analyticsCacheService`)
- Web Worker for edge/perf/risk/stats analytics
- AbortController guards in `useTradeAnalytics` and `usePsychologyData`
- Zustand `useShallow` selectors in Sidebar, ThemeProvider, Settings
- `@tanstack/react-virtual` virtualization in TradeJournal
- Dynamic import for xlsx in backupService (already done)
- Synthetic data seed utility (10,000 trades)

## User Preferences
- Persian (Farsi) UI — maintain RTL layout
- Dark mode default
- Offline-first — no API calls, no auth required
