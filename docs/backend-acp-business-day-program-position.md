# Backend — Accelerator program position: 6-day week (Sunday off)

**Status:** Frontend computes program week/day client-side from `joined_at` on a
**6 working-day** week (Mon–Sat; only Sunday skipped). The server's
`current_week` / `current_day` / `current_month`, the daily-log
`week_number` / `day_in_week`, **and the week-view endpoint** should adopt the
same rule so server-driven consumers (the RN app, the admin **Weekly board**)
agree with this dashboard.
**Severity:** Cosmetic-but-confusing + the admin Weekly board is wrong until the
week-view changes (see §3).
**DB changes:** None (position is derived; just change the derivation + the
week-view day count/types).

> Supersedes the earlier 5-day (Mon–Fri) version of this doc — the program is now
> a **6-day week with only Sunday off**.

---

## The rule

The Accelerator program runs **Monday–Saturday** (6 working days). **Sunday** is
the only weekly off and is skipped when numbering days/weeks.

- The **join day is Day 1** (joins are on a working day).
- Each program **week = 6 working days** (Mon–Sat).
- Weeks **1–4 → Month 1**, weeks **5–8 → Month 2**.
- A rep past week 8 pins at **W8 · Day 6**.

The day-in-week increments across Mon–Sat and rolls over after Saturday (Sunday
is skipped, not numbered): a **Friday** join makes **Saturday "Day 2"** and the
following **Monday "Day 3"**.

### Worked example

`john` joined **Fri 2026-05-22**:

| Date | Weekday | Program position |
|---|---|---|
| 2026-05-22 | Fri | M1 · W1 · **Day 1** |
| 2026-05-23 | Sat | M1 · W1 · **Day 2** |
| 2026-05-24 | Sun | — (skipped) |
| 2026-05-25 | Mon | M1 · W1 · **Day 3** |
| 2026-05-26 | Tue | M1 · W1 · **Day 4** |
| 2026-05-27 | Wed | M1 · W1 · **Day 5** |
| 2026-05-28 | Thu | M1 · W1 · **Day 6** |
| 2026-05-29 | Fri | M1 · W2 · **Day 1** |
| 2026-05-30 | Sat | M1 · W2 · **Day 2** |
| 2026-06-01 | Mon | M1 · W2 · **Day 3** |

---

## 1. Position derivation

Count working days (Mon–Sat) only — exclude Sunday. Reference (Postgres-ish):

```sql
-- working days elapsed since the join day, zero-based (join day -> 0 -> "Day 1")
-- = (Mon–Sat count in [joined_date, target_date]) - 1
WITH d AS (
  SELECT generate_series(joined_date, target_date, interval '1 day')::date AS day
)
SELECT GREATEST(0, COUNT(*) FILTER (WHERE EXTRACT(ISODOW FROM day) <> 7) - 1)
FROM d;   -- ISODOW: Mon=1 … Sun=7, so "<> 7" keeps Mon–Sat
```

```
elapsed       = working_days_elapsed(joined_date, current_date)  -- 0-based
current_week  = LEAST(8, elapsed / 6 + 1)
current_day   = LEAST(6, elapsed % 6 + 1)     -- 1..6, Mon..Sat
current_month = current_week <= 4 ? 1 : 2
```

Apply the **same** numbering to the daily-log `week_number` / `day_in_week`
(a log dated on a given date gets the week/day for that date). Logs should only
fall on Mon–Sat.

---

## 2. Day-type schedule (6-day week)

| Day | Type |
|---|---|
| Day 1 | Training |
| Day 2 | Training |
| Day 3 | Field |
| Day 4 | Field |
| Day 5 | Field |
| **Day 6** | **Observation** (weeks 1–2 only; field otherwise) |

Rules: weeks 1 days 1–2 = Training; **day 6 of weeks 1–2 = Observation**; every
other working day = Field. (Matches the frontend `expectedActivity`.)

---

## 3. Week-view endpoint must return 6 days  ⚠️ (admin Weekly board)

`GET /api/v1/sales/acp/batches/:id/week-view?week=N` currently returns **5 days**
with the old day-types. The admin batch dashboard's **Weekly board** renders its
day tiles **directly from this response** (`days[]` + each day's `activity_type`
/ `is_training_day` / `reps`), so until this endpoint returns **6 days** with the
§2 types:

- The board shows only 5 tiles (the FE grid is already widened to 6).
- The day-types are wrong (it still labels Day 5 "Observation").
- Reps whose current position is **Day 6** don't land on any tile.

So please update the week-view to emit `days` `1..6` with the §2 `activity_type`
per day, and key each day's `reps` to the new Mon–Sat numbering.

> The rep-facing surfaces (profile header, daily-work-log labels, alerts) are
> already correct on the frontend — they compute from `joined_at` and ignore the
> server's `current_*`. The **Weekly board is the one surface that still depends
> on the server**, via week-view.

---

## Frontend behavior (already shipped)

`programPosition()` in
[lib/acp/program-position.ts](../lib/acp/program-position.ts) is the single
source of truth (6 working days, Sunday off). It drives the rep profile header,
daily-work-log day labels, the batch Weekly board's per-day rep buckets, the
rep-account "Program week" field, and the alert engine
([lib/acp/alerts.ts](../lib/acp/alerts.ts)) — whose end-of-week checkpoints and
the week-1/2 observation day now fall on **Day 6**. The FE no longer reads the
server's `current_week`/`current_day`/`current_month` and recomputes each daily
log's `week`/`day_in_week` from `joined_at` + the log date.

## Acceptance criteria

- [ ] A Friday joiner has Saturday = Day 2 and the next Monday = Day 3.
- [ ] `current_day` is always 1..6 and never lands on a Sunday.
- [ ] Weeks roll over after 6 working days; Sundays are skipped, not numbered.
- [ ] `current_week` 1–4 ⇒ month 1; 5–8 ⇒ 2; capped at W8/D6.
- [ ] Daily-log `week_number` / `day_in_week` use the same numbering.
- [ ] `week-view` returns days 1–6 with day-types per §2 (Day 6 = Observation in
      weeks 1–2), so the admin Weekly board shows 6 correctly-typed tiles.
- [ ] The 2026-05-22 worked-example table reproduces exactly.
