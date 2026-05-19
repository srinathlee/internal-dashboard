# Backend fix request — let `SALES_ADMIN` assign targets

**Owner:** Frontend (Internal Dashboard)
**Affected role:** `SALES_ADMIN`
**Severity:** Blocking — sales admins cannot complete their core workflow.

---

## The problem

When a `SALES_ADMIN` opens **Target management → Assign targets**, picks one of
their team's reps, edits a target value, and clicks **Save**, the request
fails with:

```
HTTP 403
{
  "error": "Only SUPER_ADMIN can assign targets."
}
```

The frontend surfaces this verbatim as a toast:

> **Couldn't save targets** — Only SUPER_ADMIN can assign targets.

Reproduction screenshot is attached in the linked ticket / Slack thread.

---

## Why this needs to change

The product spec gives sales admins ownership of their team:

| Role | Scope of authority |
|---|---|
| `SUPER_ADMIN` | All teams, all reps |
| `SALES_ADMIN` | **Their own team's reps only** |
| `SALES_SUBADMIN` (sales rep) | Read-only `/sales/targets/me` |

Assigning numeric targets is part of "managing your own team." Restricting
this to `SUPER_ADMIN` forces the super admin to be in the loop for every
target tweak across every team, which doesn't scale and doesn't match how
adding members / setting initial targets already works (the
`POST /api/v1/sales/teams/:teamId/reps` flow already lets `SALES_ADMIN`
create a rep *with* initial targets in one call — same data model, same
team).

---

## What we need

### Primary fix

Allow `SALES_ADMIN` to call **`PUT /api/v1/sales/targets/assign/:userId`**
when the target rep (`:userId`) belongs to **the caller's own team**.

```
PUT /api/v1/sales/targets/assign/:userId
Body: { "targets": { <metricKey>: { <period>: <number>, ... }, ... } }

Allowed when:
  - caller.role === "SUPER_ADMIN"                    → any rep
  - caller.role === "SALES_ADMIN"                    → rep where
                                                       rep.team_id === caller.team_id
                                                       AND rep.role === "SALES_SUBADMIN"
  - else                                             → 403
```

Concretely, the backend gate should change from "role check only" to
"role + team-scope check," matching the pattern already used in the
subadmin and follow-up endpoints.

### Cross-team protection

`SALES_ADMIN` must NOT be able to assign targets to a rep in a different
team. If they try (e.g. by hand-crafting a request with another team's
`:userId`), respond with `403`:

```json
{
  "error": {
    "code": "WRONG_TEAM",
    "message": "You can only assign targets to reps in your own team."
  }
}
```

The frontend already knows how to surface `WRONG_TEAM` with a friendly
message (see `FRIENDLY_BY_CODE` in `lib/hooks/use-async.ts`).

### Audit-trail / `updated_by`

If the assign-targets table tracks who made the change (`updated_by` /
audit log), make sure the row records the **`SALES_ADMIN`'s user id**, not
the super admin's, when a sales admin saves. This keeps the audit log
truthful.

---

## Endpoints to audit at the same time

While you're in there, please confirm the same role+team rule applies
consistently across the target-management surface so the UI doesn't get
half-fixed:

| Method | Endpoint | Expected behavior |
|---|---|---|
| `GET` | `/api/v1/sales/targets/metrics` | Already open to `SALES_ADMIN` (read-only catalogue) — confirm. |
| `GET` | `/api/v1/sales/targets/reps` | Should return **only the caller's team reps** for `SALES_ADMIN`. Super admin sees all. |
| `GET` | `/api/v1/sales/targets/monitor` | Should return **only the caller's team rows** for `SALES_ADMIN`. Super admin sees all. |
| `GET` | `/api/v1/sales/targets/monitor/:userId` | Allowed for `SALES_ADMIN` when `:userId` is in their team; else `403`. |
| `GET` | `/api/v1/sales/targets/assign/:userId` | Allowed for `SALES_ADMIN` when `:userId` is in their team; else `403`. |
| `PUT` | `/api/v1/sales/targets/assign/:userId` | **The primary fix above.** |
| `POST` | `/api/v1/sales/teams/:teamId/reps` | Already allows `SALES_ADMIN` when `:teamId === caller.team_id`. Confirm this is still true after the fix — we now route both `SUPER_ADMIN` and `SALES_ADMIN` through the rich 3-step "Add member" flow that hits this endpoint with initial targets. |

If any of the GETs above currently leak cross-team data to a
`SALES_ADMIN`, please tighten them in the same PR — the frontend assumes
the server is the source of truth for scoping.

---

## How to verify the fix

1. Sign in as a `SALES_ADMIN` of the `sales` team.
2. Navigate to **Target management → Assign targets**.
3. Pick a rep from the dropdown (only the admin's own team's reps should appear).
4. Edit any cell (e.g. Leads → Monthly → `5`) and click **Save**.
   - **Expected:** `200`, toast reads "1 target saved".
5. Repeat with a multi-cell edit across periods and metrics.
   - **Expected:** `200`, toast reads "N targets saved" with the correct count.
6. **Negative test:** as the same `SALES_ADMIN`, attempt
   `PUT /api/v1/sales/targets/assign/<rep-from-another-team>` via curl.
   - **Expected:** `403` with `error.code = "WRONG_TEAM"`.
7. **Negative test:** as a `SALES_SUBADMIN`, attempt the same `PUT`.
   - **Expected:** `403` (unchanged from today).

---

## Frontend side

The frontend already opens these surfaces to `SALES_ADMIN`. No FE changes
needed once the backend allows the call — the screen will start saving
successfully on its own. The fallback error toast will keep working for
genuine 403s (e.g. cross-team).

Relevant files for reference:

- `lib/api/sales-metric-targets.ts` — `saveAssignTargets()` → the failing PUT.
- `components/sales/targets/target-management-screen.tsx` — the screen that opens
  for both `SUPER_ADMIN` and `SALES_ADMIN` (gate uses `isSalesAdminOrSuperAdmin`).
- `components/layout/nav-config.ts` — the sidebar item.

---

## Asks summary

- [ ] Allow `SALES_ADMIN` on `PUT /api/v1/sales/targets/assign/:userId` for in-team reps.
- [ ] Return `403 { error.code: "WRONG_TEAM" }` for out-of-team attempts.
- [ ] Audit the GET endpoints listed above for consistent team scoping.
- [ ] Confirm `POST /api/v1/sales/teams/:teamId/reps` (with initial targets) still works for `SALES_ADMIN` on their own team.
- [ ] Record the acting `SALES_ADMIN`'s user id in any audit/`updated_by` field.
