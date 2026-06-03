# Backend handoff — Accelerator Day 6 (6-day week) & static FE data

Two things in one doc:

1. **Day 6 / 6-day program week** — the program just changed from a 5-day to a
   6-day week. The dashboard is already running on the new schedule; a few
   server endpoints need to catch up. **§1**.
2. **Static frontend data** — content the FE currently hardcodes that could
   live on the server (so we can edit it without a redeploy). **§2**.

Companion doc with deeper math: [`backend-acp-business-day-program-position.md`](./backend-acp-business-day-program-position.md).

---

## §1 — Day 6 / the 6-day program week

### 1.1 The schedule

The program now runs **Monday–Saturday** (6 working days). Only **Sunday** is
skipped.

- Join day = **Day 1**.
- Each program week = **6 working days** (Mon–Sat).
- Weeks 1–4 = Month 1; weeks 5–8 = Month 2.
- Position is capped at **W8 · Day 6**.

**Day-type schedule** (single source of truth — copy into any backend helper):

| Day | Type (weeks 1–2) | Type (weeks 3–8) |
|---|---|---|
| Day 1 | **Training** | Field |
| Day 2 | **Training** | Field |
| Day 3 | Field | Field |
| Day 4 | Field | Field |
| Day 5 | Field | Field |
| **Day 6** | **Observation** | Field |

Compact rule (frontend `programDayActivity`):

```ts
if (week === 1 && dayInWeek <= 2) return "training";
if (dayInWeek === 6 && week <= 2) return "observation";
return "field";
```

### 1.2 Endpoints / fields that need to change

#### A. `GET /api/v1/sales/acp/batches/:batchId/week-view?week=N`  ⚠️ highest priority

The admin **Weekly board** renders straight from this response. Today it
returns 5 days; it needs to return **6**.

- `days` array length = **6** (`day: 1..6`).
- Each day's `activity_type` per the table in §1.1 (so `is_training_day`
  is true for W1 D1–D2 only, and `activity_type` is `"observation"` for
  D6 of weeks 1–2).
- Existing per-day `reps` payload stays the same — just key it to the new
  day numbering (a rep who was "on day 5 (observation)" under the old rule is
  now on whatever day the 6-day-week math puts them on, computed from their
  `joined_at`).
- The FE has already widened its grid to fit 6 tiles — once you return 6,
  the board shows them.

#### B. Member fields — `current_week` / `current_day` / `current_month`

Compute from `joined_at` using 6-day-week math:

```
elapsed       = working_days_between(joined_date, today)       -- skip Sundays
current_week  = LEAST(8, elapsed / 6 + 1)
current_day   = LEAST(6, elapsed % 6 + 1)
current_month = current_week <= 4 ? 1 : 2
```

Postgres `working day` predicate: `EXTRACT(ISODOW FROM day) <> 7` (ISODOW
puts Sunday = 7).

> The web dashboard no longer **reads** these for display (the FE recomputes
> from `joined_at`), but the **RN app** still does. Please update them so the
> two clients agree.

#### C. Daily-log fields — `week_number` / `day_in_week`

- A log dated on a given date gets the `(week, day)` for that date under the
  new 6-day numbering.
- Logs should only ever fall on **Mon–Sat** — Sunday is not a program day.

### 1.3 Worked example

Rep `john` joined **Fri 2026-05-22**:

| Date | Weekday | Program position | Day type (W1) |
|---|---|---|---|
| 2026-05-22 | Fri | M1 · W1 · **Day 1** | Training |
| 2026-05-23 | Sat | M1 · W1 · **Day 2** | Training |
| 2026-05-24 | Sun | — (skipped) | — |
| 2026-05-25 | Mon | M1 · W1 · **Day 3** | Field |
| 2026-05-26 | Tue | M1 · W1 · **Day 4** | Field |
| 2026-05-27 | Wed | M1 · W1 · **Day 5** | Field |
| 2026-05-28 | Thu | M1 · W1 · **Day 6** | **Observation** |
| 2026-05-29 | Fri | M1 · W2 · **Day 1** | Field |
| 2026-05-30 | Sat | M1 · W2 · **Day 2** | Field |
| 2026-06-01 | Mon | M1 · W2 · **Day 3** | Field |

### 1.4 Acceptance criteria — §1

- [ ] `/acp/batches/:id/week-view` returns 6 days with the day-types in §1.1.
- [ ] `current_day` is always 1..6 and never lands on a Sunday.
- [ ] Logs only fall on Mon–Sat (a log row should never have `day_in_week`
      pointing at a Sunday).
- [ ] A Friday joiner has Saturday = Day 2 and the next Monday = Day 3.
- [ ] The 2026-05-22 worked-example table reproduces exactly.

---

## §2 — Static frontend data candidates

Content the dashboard currently hardcodes. Each item is tagged:

- **🔴 Must move to backend** — out of sync risk or product editability is
  needed.
- **🟡 Worth moving to backend** — would be nice to make tunable without a
  deploy.
- **⚪ Fine to keep on FE** — pure display metadata, listed for awareness.

### 2.1 🟡 Week themes / subtitles (8 weeks)

**Week titles** ([acp-shared.tsx](../components/sales/accelerator/acp-shared.tsx) `WEEK_CONFIG`):

| Week | Title |
|---|---|
| 1 | Training |
| 2 | Observation |
| 3 | Sprint push |
| 4 | M1 close |
| 5 | Conversion |
| 6 | Selling |
| 7 | M2 target |
| 8 | Final |

**Week subtitles** ([batch-dashboard-screen.tsx](../components/sales/accelerator/batch-dashboard-screen.tsx) `WEEK_SUBTITLE`):

| Week | Subtitle |
|---|---|
| 1 | Training + field observation |
| 2 | Observation |
| 3 | Sprint push |
| 4 | Month 1 close |
| 5 | Conversion |
| 6 | Selling |
| 7 | M2 target |
| 8 | Final |

**Backend candidate:** include in a `/acp/program/config` endpoint (see §2.7).

### 2.2 🟡 Program duration / dates ("2 months")

Currently hardcoded in two places:

- [add-member-modal.tsx](../components/sales/accelerator/add-member-modal.tsx):
  "Duration: 2 months" label; joining date = `now`; ending date = `now + 2 months`
  (FE-computed).
- [create-batch-modal.tsx](../components/sales/accelerator/create-batch-modal.tsx):
  "Duration: 2 months" label.

The backend already returns `ending_at` on `AcpMember`, so the modal could read
it back after create instead of computing. But the **"2 months" constant** is
hardcoded in two modals' Program-schedule cards.

**Suggested:** make `ending_at` authoritative server-side (compute from
`joined_at` + the program length); expose the program length via
`/acp/program/config.duration_months`.

### 2.3 🔴 Default targets (₹10K M1, ₹1.1L M2)

Currently hardcoded in **five** places:

| File | Use |
|---|---|
| [lib/acp/alerts.ts](../lib/acp/alerts.ts) | `DEFAULT_SPRINT_TARGET = 10000`, `DEFAULT_REVENUE_TARGET = 110000` — fallback when member has no target |
| [lib/api/sales-accelerator.ts](../lib/api/sales-accelerator.ts) | `normalizeMember` defaults `sprint_target=10000`, `revenue_target=110000` when fields missing |
| [rep-profile-screen.tsx](../components/sales/accelerator/rep-profile-screen.tsx) | `m.sprint_target \|\| 10000`, `m.revenue_target \|\| 110000` in captions |
| [rep-detail-panel.tsx](../components/sales/accelerator/rep-detail-panel.tsx) | same fallbacks |
| [add-member-modal.tsx](../components/sales/accelerator/add-member-modal.tsx) & [create-batch-modal.tsx](../components/sales/accelerator/create-batch-modal.tsx) | static text: `"Month 1 — Sprint amount: ₹10.0K"`, `"Month 2 — Revenue generation: ₹1.1L"` |

**Ask of backend:**
1. **Always** send `sprint_target` and `revenue_target` on every `AcpMember`
   response (create + read). The FE fallback is only there because the fields
   are sometimes missing — once they're guaranteed, we delete the constants.
2. If you want the *defaults* tunable, expose them via `/acp/program/config`
   (`default_sprint_target`, `default_revenue_target`). The two modals can
   then read those instead of hardcoded labels.

### 2.4 ⚪ Day-type schedule (Training / Observation / Field)

FE-authoritative via `programDayActivity(week, day)` (defined in
[lib/acp/program-position.ts](../lib/acp/program-position.ts)). Backend needs
the **same rule** for the week-view endpoint (§1.2.A) and to set
`activity_type` on each daily log.

Until the rule becomes tunable (e.g. add a 3rd training day, holidays), it's
fine to hardcode identically on both sides — but please make sure server-side
matches the FE table exactly.

### 2.5 ⚪ Tag / Review / Activity enums + display labels

Pure enum metadata — no reason to move:

- **`AcpTag`**: `active`, `close_monitoring`, `at_risk`, `firing_zone`, `fired`,
  `converted` — labelled in `TAG_META`.
- **`AcpReview`**: `working_fine`, `observation`, `retrain` — labelled in
  `REVIEW_META`.
- **`AcpActivity`**: `training`, `field`, `observation`, `retrain`, `absent` —
  labelled in `ACTIVITY_META`.

**Ask of backend:** send the enum *values* exactly as listed above. We
normalize unknown strings to safe defaults, so anything unexpected just becomes
invisible to the user.

### 2.6 🔴 "Convert to full-time" tag — already documented separately

The rep-profile status dropdown is currently binary **active / fired**. The
program lifecycle includes a third end-state — **converted** — that graduates
a trainee back into the normal sales dashboard. The FE will add the dropdown
option once `PATCH /acp/members/:id/tag` accepts `tag: "converted"` without
erroring.

Spec: [`backend-acp-hide-from-sales-lists.md`](./backend-acp-hide-from-sales-lists.md).

### 2.7 🟡 Proposal — one `/acp/program/config` endpoint

If you want to consolidate the tunable bits (2.1 + 2.2 + 2.3 + 2.4), one
admin-side read endpoint is enough:

```jsonc
GET /api/v1/sales/acp/program/config
{
  "weeks": 8,
  "days_per_week": 6,
  "rest_days": ["sunday"],
  "duration_months": 2,
  "default_sprint_target": 10000,
  "default_revenue_target": 110000,
  "week_titles": [
    { "week": 1, "title": "Training",   "subtitle": "Training + field observation" },
    { "week": 2, "title": "Observation","subtitle": "Observation" },
    { "week": 3, "title": "Sprint push","subtitle": "Sprint push" },
    { "week": 4, "title": "M1 close",   "subtitle": "Month 1 close" },
    { "week": 5, "title": "Conversion", "subtitle": "Conversion" },
    { "week": 6, "title": "Selling",    "subtitle": "Selling" },
    { "week": 7, "title": "M2 target",  "subtitle": "M2 target" },
    { "week": 8, "title": "Final",      "subtitle": "Final" }
  ],
  "day_schedule": [
    { "week": 1, "day": 1, "activity_type": "training" },
    { "week": 1, "day": 2, "activity_type": "training" },
    { "week": 1, "day": 3, "activity_type": "field" },
    { "week": 1, "day": 4, "activity_type": "field" },
    { "week": 1, "day": 5, "activity_type": "field" },
    { "week": 1, "day": 6, "activity_type": "observation" },
    { "week": 2, "day": 6, "activity_type": "observation" },
    // ... rest default to "field"
  ]
}
```

Not urgent — current setup works — but it'd let you change program parameters
without a frontend deploy.

---

## §3 — Already FE-only (don't duplicate on backend)

Just so backend doesn't redo work this dashboard already does:

- **Position math** (`getRepWeek` / `programPosition`) — FE derives week/day
  from `joined_at`. Backend's `current_*` is still needed for the RN app (§1.2.B),
  but the dashboard ignores it for display.
- **Alert rules** — entire alert engine is FE-computed
  ([lib/acp/alerts.ts](../lib/acp/alerts.ts)) — every M1/M2 milestone,
  end-of-week checkpoint, daily-task reminder. **No backend alert-storage
  endpoint is needed for this dashboard.** (The `/acp/.../alerts` routes in the
  original API doc target the RN app, not this dashboard.)
- **Bell unread tracking** — done locally via `localStorage` + an open-time
  watermark. The bell does call `markAllRead` on the existing notification list
  endpoint when opened.
- **Daily-log week/day labels** — FE recomputes from `joined_at` + log date;
  any `week_number`/`day_in_week` the server echoes is ignored for display.

---

## §4 — Open questions

1. **Public holidays** — the FE skips only Sunday. Should program days also
   skip Indian holidays (Diwali, Independence Day, etc.)? If yes, both sides
   should consult the same holiday source; if no, please confirm so we don't
   add it.
2. **Backfill of existing reps** — reps mid-program who joined under the old
   5-day rule: do their stored `current_*` and log `week_number`/`day_in_week`
   need to be recomputed under the 6-day rule? (The web dashboard recomputes
   on display, so it looks correct either way — but the RN app and any
   stored values will be inconsistent with new joiners' until a backfill.)
3. **Is `/acp/program/config` worth doing now?** Or keep the constants on the
   FE for v1 and revisit later?

---

## §5 — Verification — quick checks for backend QA

After implementing §1:

```bash
# Pick a Friday-joining rep, today is some weekday in week 2.
# Expect: current_day in {1..6}, never on a Sunday log.
curl ".../acp/members/$ID" | jq '.data | {joined_at, current_week, current_day, current_month}'

# Expect: days[0..5] with day=1..6, activity_type matching §1.1.
curl ".../acp/batches/$BATCH/week-view?week=1" | jq '.data.days[] | {day, activity_type, is_training_day}'

# Expect: every log's day_in_week is 1..6, none on Sundays.
curl ".../acp/members/$ID/daily-logs" \
  | jq '.data[] | {date, day_in_week, week_number}'
```
