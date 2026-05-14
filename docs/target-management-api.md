# Target Management — Backend API Spec

> Frontend reference: [components/sales/targets/target-management-screen.tsx](../components/sales/targets/target-management-screen.tsx)
> Current placeholder hook: [lib/hooks/use-targets.ts](../lib/hooks/use-targets.ts)
> Status: Frontend is built for **super_admin** only and stores targets in `localStorage`. This document is the contract the backend must implement so we can swap out the localStorage layer and later add the **sales_rep** view.

---

## 1. Overview

Target Management lets a super admin assign a **revenue target amount (INR)** to every sales rep, for each of five periods:

- `DAILY`
- `WEEKLY`
- `MONTHLY`
- `QUARTERLY`
- `YEARLY`

Each `(userId, period)` pair has at most one active target. The super admin also monitors team progress: how much each rep has actually achieved against the target for the active period, and a derived status (`BEHIND` / `AT_RISK` / `ON_TRACK` / `ACHIEVED`).

The sales rep frontend is **not yet built**, but the backend APIs for it should ship in this round so the FE can be added later without another backend change.

### Status thresholds (computed server-side)

Given `progress_pct = round(actual / target * 100)`:

| Range | Status |
| --- | --- |
| `pct >= 100` | `ACHIEVED` |
| `80 <= pct < 100` | `ON_TRACK` |
| `50 <= pct < 80` | `AT_RISK` |
| `pct < 50` | `BEHIND` |

If `target <= 0` → status is `UNSET` (FE shows "No target").

---

## 2. Data Model

### `sales_targets` table

| Column | Type | Notes |
| --- | --- | --- |
| `id` | UUID PK | |
| `user_id` | UUID FK → `users.id` | The sales rep this target is for |
| `period` | enum (`DAILY`, `WEEKLY`, `MONTHLY`, `QUARTERLY`, `YEARLY`) | |
| `target_amount` | numeric(14,2) | INR, must be > 0 |
| `currency` | char(3) | Always `INR` for now — store it anyway for forward compat |
| `effective_from` | date | Defaults to today; lets us version targets over time |
| `effective_to` | date NULLABLE | NULL = currently active |
| `created_by` | UUID FK → `users.id` | Super admin who set it |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

**Constraint:** unique `(user_id, period, effective_to)` where `effective_to IS NULL`
→ at most one active target per `(user, period)`.

**Update semantics:** Reassigning a target should close the old row (`effective_to = today`) and insert a new row. This preserves history for audit/leaderboard recomputation.

### Period boundaries (server-side, IST `Asia/Kolkata`)

| Period | Start | End |
| --- | --- | --- |
| `DAILY` | 00:00:00 today | 23:59:59 today |
| `WEEKLY` | Monday 00:00:00 of current ISO week | Sunday 23:59:59 |
| `MONTHLY` | 1st of month 00:00:00 | last day 23:59:59 |
| `QUARTERLY` | 1st of quarter (Jan/Apr/Jul/Oct) | last day of quarter |
| `YEARLY` | 1st Jan 00:00:00 | 31st Dec 23:59:59 |

### Actual progress source

`actual_amount` for a `(user, period)` = **sum of `subscription_value` (or `estimated_value` for closed-won leads) for the rep, where `subscription_closed_at` falls inside the period window**.

If the team later wants a different metric (deals closed, MRR, etc.) we'll add a `metric` column. For now everything is currency-only revenue.

---

## 3. Auth & RBAC

All endpoints require `Authorization: Bearer <jwt>`.

| Role | Can read own | Can read others | Can write | Can delete |
| --- | --- | --- | --- | --- |
| `super_admin` | ✅ | ✅ all reps | ✅ any rep | ✅ any rep |
| `sales_admin` | ✅ | ✅ reps in own team | ❌ | ❌ |
| `sales_rep` (`SALES_SUBADMIN`) | ✅ self only | ❌ | ❌ | ❌ |

Any cross-user read by a non-admin → `403 FORBIDDEN`.

---

## 4. Endpoints — Super Admin

Base path: `/api/v1/sales/targets`

### 4.1 `GET /api/v1/sales/targets` — list targets

Returns all currently-active targets across all reps. Used by the "Assign targets" and "Monitor team" tabs.

**Query params**

| Name | Type | Default | Notes |
| --- | --- | --- | --- |
| `userId` | UUID | — | Filter to a single rep |
| `period` | enum | — | One of `DAILY` / `WEEKLY` / `MONTHLY` / `QUARTERLY` / `YEARLY` |
| `includeProgress` | boolean | `false` | When `true`, each row includes `actual_amount`, `progress_pct`, `status` for the current period window |

**Response 200**

```json
{
  "data": [
    {
      "id": "tgt_01HX...",
      "user_id": "usr_01HX...",
      "user_name": "Aditi Sharma",
      "period": "MONTHLY",
      "target_amount": 500000,
      "currency": "INR",
      "effective_from": "2026-05-01",
      "effective_to": null,
      "created_by": { "id": "usr_01HQ...", "name": "Super Admin" },
      "created_at": "2026-05-01T08:12:09Z",
      "updated_at": "2026-05-01T08:12:09Z",
      "progress": {
        "actual_amount": 320000,
        "progress_pct": 64,
        "status": "AT_RISK",
        "period_start": "2026-05-01T00:00:00+05:30",
        "period_end": "2026-05-31T23:59:59+05:30"
      }
    }
  ]
}
```

`progress` is omitted when `includeProgress=false`.

### 4.2 `GET /api/v1/sales/targets/:userId` — list a single rep's targets

Returns the active target for every period (up to 5 rows). Used to populate the right panel of "Assign targets".

**Response 200**

```json
{
  "data": {
    "user": { "id": "usr_01HX...", "name": "Aditi Sharma" },
    "targets": {
      "DAILY":     { "target_amount": 20000,  "id": "tgt_..." },
      "WEEKLY":    { "target_amount": 120000, "id": "tgt_..." },
      "MONTHLY":   { "target_amount": 500000, "id": "tgt_..." },
      "QUARTERLY": null,
      "YEARLY":    null
    }
  }
}
```

A `null` value means no active target for that period.

### 4.3 `PUT /api/v1/sales/targets/:userId` — set/update a single target

Upserts the target for one `(userId, period)` pair. If a target already exists it closes the old one (`effective_to = today`) and creates a new active row.

**Body**

```json
{
  "period": "MONTHLY",
  "target_amount": 500000,
  "currency": "INR"
}
```

**Validation**

- `period` ∈ enum (required)
- `target_amount` > 0 and finite (required)
- `currency` = `"INR"` (only INR supported right now)
- Target user must exist and have role `SALES_SUBADMIN` (sales rep). Reject `super_admin` / `sales_admin` targets.

**Response 200** — the new active row, same shape as a single item in 4.1.

**Errors**

| Status | Code | When |
| --- | --- | --- |
| `400` | `INVALID_AMOUNT` | `target_amount <= 0` or not finite |
| `400` | `INVALID_PERIOD` | Unknown period enum value |
| `404` | `USER_NOT_FOUND` | `:userId` doesn't exist |
| `409` | `USER_NOT_A_REP` | Target user isn't a sales rep |

### 4.4 `POST /api/v1/sales/targets/bulk` — "Apply to all reps"

Used by the "Apply to all reps" checkbox. Atomically sets the same `(period, target_amount)` for every **active** sales rep.

**Body**

```json
{
  "period": "WEEKLY",
  "target_amount": 100000,
  "currency": "INR",
  "user_ids": null
}
```

- If `user_ids` is `null` or omitted → apply to **all active sales reps**.
- If `user_ids` is an array of UUIDs → apply to that subset (lets the FE add "apply to selected" later without another endpoint).

**Response 200**

```json
{
  "data": {
    "period": "WEEKLY",
    "target_amount": 100000,
    "applied_to": 12,
    "skipped": [
      { "user_id": "usr_01...", "reason": "USER_INACTIVE" }
    ]
  }
}
```

Must be transactional — either all or none.

### 4.5 `DELETE /api/v1/sales/targets/:userId/:period` — remove a target

Closes the active target for that `(user, period)` by setting `effective_to = today`. Does **not** hard-delete — preserves audit history.

**Response 204** on success.

**Errors**

| Status | Code | When |
| --- | --- | --- |
| `404` | `TARGET_NOT_FOUND` | No active target for that `(user, period)` |

### 4.6 `GET /api/v1/sales/targets/monitor` — team monitor board

Single payload that powers the "Monitor team" tab (KPI tiles + per-rep rows + per-period snapshots).

**Query params**

| Name | Type | Default | Notes |
| --- | --- | --- | --- |
| `period` | enum | `MONTHLY` | The active period the FE is showing |
| `user_ids` | csv UUIDs | — | Optional filter (the multi-select chip) |

**Response 200**

```json
{
  "data": {
    "period": "MONTHLY",
    "period_start": "2026-05-01T00:00:00+05:30",
    "period_end": "2026-05-31T23:59:59+05:30",
    "tallies": {
      "behind": 3,
      "at_risk": 2,
      "on_track": 4,
      "achieved": 1,
      "unset": 0
    },
    "rows": [
      {
        "user": { "id": "usr_01...", "name": "Aditi Sharma", "initials": "AS" },
        "active_period": {
          "period": "MONTHLY",
          "target_amount": 500000,
          "actual_amount": 320000,
          "progress_pct": 64,
          "status": "AT_RISK"
        },
        "all_periods": {
          "DAILY":     { "target_amount": 20000,  "actual_amount": 14000,  "progress_pct": 70, "status": "AT_RISK" },
          "WEEKLY":    { "target_amount": 120000, "actual_amount": 90000,  "progress_pct": 75, "status": "AT_RISK" },
          "MONTHLY":   { "target_amount": 500000, "actual_amount": 320000, "progress_pct": 64, "status": "AT_RISK" },
          "QUARTERLY": null,
          "YEARLY":    null
        }
      }
    ]
  }
}
```

`all_periods` is included so the FE can render the expanded "per period snapshot" cards without a second roundtrip.

---

## 5. Endpoints — Sales Rep (no FE yet, but build now)

A sales rep can only ever see **their own** targets and progress. The backend must enforce this with `req.user.id` — never trust a userId from the path/query for non-admin roles.

### 5.1 `GET /api/v1/sales/targets/me` — my targets

Returns all 5 periods for the calling rep, with current progress baked in.

**Response 200**

```json
{
  "data": {
    "user": { "id": "usr_01...", "name": "Aditi Sharma" },
    "as_of": "2026-05-13T11:42:00+05:30",
    "periods": {
      "DAILY": {
        "target_amount": 20000,
        "actual_amount": 14000,
        "progress_pct": 70,
        "status": "AT_RISK",
        "period_start": "2026-05-13T00:00:00+05:30",
        "period_end":   "2026-05-13T23:59:59+05:30",
        "days_total": 1,
        "days_elapsed": 1,
        "days_remaining": 0
      },
      "WEEKLY":    { "...": "..." },
      "MONTHLY":   { "...": "..." },
      "QUARTERLY": null,
      "YEARLY":    null
    }
  }
}
```

`days_total / days_elapsed / days_remaining` lets the rep FE render a "pace" hint (e.g., "you're 50% through the month with 64% achieved").

### 5.2 `GET /api/v1/sales/targets/me/period/:period` — drill into one period

Same shape as one entry in 5.1's `periods` map, but with a **daily breakdown** for charting.

**Path param**

- `:period` ∈ `DAILY` / `WEEKLY` / `MONTHLY` / `QUARTERLY` / `YEARLY`

**Response 200**

```json
{
  "data": {
    "period": "MONTHLY",
    "target_amount": 500000,
    "actual_amount": 320000,
    "progress_pct": 64,
    "status": "AT_RISK",
    "period_start": "2026-05-01T00:00:00+05:30",
    "period_end":   "2026-05-31T23:59:59+05:30",
    "daily_breakdown": [
      { "date": "2026-05-01", "amount": 12000 },
      { "date": "2026-05-02", "amount": 0 },
      { "date": "2026-05-03", "amount": 45000 }
    ],
    "contributing_leads": [
      {
        "lead_id": "lead_01...",
        "clinic_name": "Apollo Cradle",
        "closed_at": "2026-05-03T15:21:00+05:30",
        "amount": 45000
      }
    ]
  }
}
```

`contributing_leads` lets the rep see what's been counted.

### 5.3 `GET /api/v1/sales/targets/me/history` — past period results

For a "how did I do last month / last quarter" view.

**Query params**

| Name | Type | Default | Notes |
| --- | --- | --- | --- |
| `period` | enum | required | |
| `limit` | int | `6` | Last N completed periods (max 24) |

**Response 200**

```json
{
  "data": {
    "period": "MONTHLY",
    "history": [
      {
        "period_key": "2026-04",
        "period_start": "2026-04-01T00:00:00+05:30",
        "period_end":   "2026-04-30T23:59:59+05:30",
        "target_amount": 480000,
        "actual_amount": 510000,
        "progress_pct": 106,
        "status": "ACHIEVED"
      }
    ]
  }
}
```

---

## 6. Common response envelope & errors

All endpoints follow the existing API envelope:

```json
{ "data": <payload> }
```

Errors:

```json
{
  "error": {
    "code": "INVALID_AMOUNT",
    "message": "target_amount must be greater than 0",
    "details": { "field": "target_amount" }
  }
}
```

Standard codes: `UNAUTHORIZED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `VALIDATION_ERROR` (400), `CONFLICT` (409), `INTERNAL` (500).

---

## 7. Audit log

Every write (`PUT /targets/:userId`, `POST /targets/bulk`, `DELETE /targets/:userId/:period`) must emit a row to the existing audit log with:

- `actor_id` = super admin's user id
- `action` = `TARGET_SET` / `TARGET_BULK_SET` / `TARGET_REMOVED`
- `resource` = `sales_target`
- `resource_id` = the target row id (or list for bulk)
- `details` = `{ user_id, period, old_amount, new_amount }`

---

## 8. Out of scope (for this round)

- Multi-currency targets (only INR for now).
- Non-revenue metrics (deals closed, hospitals added, etc.).
- Stretch targets / floor targets.
- Per-team targets (only per-user).
- Pushing notifications when a rep falls behind — Slack/email reminders are a follow-up.

These should be designable into the schema (`metric` column, `stretch_target` column) but not exposed in the API yet.

---

## 9. Frontend integration checklist

Once the backend is live, the following frontend changes will happen (no backend action needed — listed for context):

1. Replace `loadTargets()` / `saveTargets()` in [target-management-screen.tsx](../components/sales/targets/target-management-screen.tsx) with calls to `useTargets()` and a new `useSetTarget()` mutation.
2. Replace `pseudoActual()` with the `actual_amount` returned by `GET /targets/monitor`.
3. Add a `/sales/my-targets` route for sales reps wired to `GET /targets/me`.
4. Update [lib/hooks/use-targets.ts](../lib/hooks/use-targets.ts) to use the new period enum (`DAILY|WEEKLY|MONTHLY|QUARTERLY|YEARLY`) — note the current placeholder uses `monthly|quarterly|half_yearly|yearly` (no daily/weekly). Backend should ship the new enum; FE will migrate.

---

## 10. Endpoint summary

| Method | Path | Role | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/v1/sales/targets` | super_admin, sales_admin | List active targets (filterable) |
| `GET` | `/api/v1/sales/targets/:userId` | super_admin, sales_admin | All 5 periods for one rep |
| `PUT` | `/api/v1/sales/targets/:userId` | super_admin | Set/update one `(user, period)` target |
| `POST` | `/api/v1/sales/targets/bulk` | super_admin | Apply same target to many reps |
| `DELETE` | `/api/v1/sales/targets/:userId/:period` | super_admin | Remove an active target |
| `GET` | `/api/v1/sales/targets/monitor` | super_admin, sales_admin | Team monitor board (tallies + rows) |
| `GET` | `/api/v1/sales/targets/me` | sales_rep | My targets + current-period progress |
| `GET` | `/api/v1/sales/targets/me/period/:period` | sales_rep | One period with daily breakdown |
| `GET` | `/api/v1/sales/targets/me/history` | sales_rep | Past N completed periods |
