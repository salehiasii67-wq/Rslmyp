---
name: TraderMind analytics conventions
description: Durable conventions for interpreting TraderMind financial analytics and protecting boundary cases.
---

## Rule

Treat `profitLoss` as gross trade P/L and `fees` as a separate cost. Any financial summary, curve, drawdown, profit factor, or displayed aggregate must use net P/L (`profitLoss - fees`). Keep R-based metrics independent from monetary P/L.

Use ISO week years for weekly grouping: the week is identified by the year containing its Thursday, not by the calendar month or the date of the Monday alone.

**Why:** Multiple analytics paths previously disagreed about fees, and naive week arithmetic mis-grouped trades around month/year boundaries. These errors change user-facing performance conclusions without causing runtime failures.

**How to apply:** Reuse the shared net-P/L helper for monetary calculations and add regression cases for fees, exact bucket boundaries, weekday names, and ISO year transitions whenever analytics logic changes.