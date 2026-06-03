# Backend — Hide in-program Accelerator reps from the normal sales dashboard

**Status:** Frontend stopgap shipped for the team-members list only; everything
else needs this server change.
**Severity:** Accelerator trainees are polluting the normal sales dashboard
(target board, team roster, assign-targets picker, performance, scorecard, …).
**DB changes:** None required (optional: expose a derived `acp_status` field).

---

## The problem

Adding an Accelerator member (`POST /acp/batches/:id/members`) creates a real
sales `users` login (credentials are emailed to the rep). So **every Accelerator
trainee is also a normal sales `users` row.** Each endpoint that enumerates sales
reps therefore lists them alongside the permanent team — e.g. the batch reps
`kiran-batch-1`, `ram-1batch`, `sai-1batch` show up on **Target management** and
the **Sales team** page even though they're mid-program trainees, not staff.

These trainees should live **only in the Accelerator tab** until the program
ends. The dashboard owner's words:

> Accelerator reps should not be present in the normal dashboard — they should
> only be seen in the Accelerator tab. Once they complete, we either **fire**
> them or **convert** them to full-time.

So the lifecycle is:

| Accelerator state (`acp_members.tag`) | Login | Show in normal sales dashboard? |
|---|---|---|
| `active`, `close_monitoring`, `at_risk`, `firing_zone` (in program) | active | **No** — trainee, lives in the Accelerator tab |
| `fired` (removed at/after completion) | inactive | **No** — out of the program, not staff |
| `converted` (graduated to full-time) | active | **Yes** — now a normal sales rep |
| *(no `acp_members` row at all)* | — | **Yes** — ordinary rep, unchanged |

The single rule:

> **A sales user is hidden from the normal dashboard iff they have an
> `acp_members` row whose `tag <> 'converted'`.**

`converted` is the only Accelerator state that "graduates" the rep back into the
normal dashboard. Everything else (in-program *and* fired) is hidden.

---

## What to implement

### 1. One reusable predicate, applied to every rep-enumerating endpoint

Define it once and reuse it. Concept (Postgres/Knex sketch — adapt to schema):

```sql
-- A user is an "in-program accelerator trainee" (hide them) when they have
-- an acp_members row that hasn't graduated to full-time.
NOT EXISTS (
  SELECT 1
  FROM acp_members am
  WHERE am.user_id = users.id        -- or join on email if that's the link
    AND am.tag <> 'converted'
)
```

> **Join key:** use whatever links `acp_members` → `users` (a `user_id` FK is
> ideal; the membership email matches the login email if there's no FK yet). If
> there's currently no FK, please add `acp_members.user_id` — matching on email
> is brittle.

Add this predicate to the `WHERE` of **every endpoint that returns a list of
sales reps for an admin.** Known surfaces in this dashboard (all GET):

| Endpoint | Powers |
|---|---|
| `/api/v1/sales/subadmins` | **Sales team** members table |
| `/api/v1/sales/targets/monitor` | **Target management → Monitor team** board |
| `/api/v1/sales/targets/monitor/:userId` | Per-rep target detail (return `404` if hidden) |
| `/api/v1/sales/targets/reps` | **Assign targets** rep picker |
| `/api/v1/sales/targets/bulk` | Bulk target assign (ignore/redirect hidden ids) |
| `/api/v1/sales/users` | Generic rep list / pipeline rep filter |
| `/api/v1/sales/team/performance` | **Performance** screen |
| `/api/v1/sales/team/overview` | Team overview |
| `/api/v1/sales/team/roster` | Roster |
| `/api/v1/sales/scorecard/leaderboard` | **Scorecard** admin leaderboard |
| `/api/v1/sales/scorecard/team/board` | Scorecard team board |
| `/api/v1/sales/distance/team` | Distance per rep |
| `/api/v1/sales/distance/org/summary` | Org distance roll-up |
| `/api/v1/sales/location/team-status` | Live-location per rep |
| `/api/v1/sales/location/sessions` | Location sessions per rep |
| `/api/v1/sales/team/broadcast` recipients | Team broadcast audience |

> Prefer filtering at the **rep-enumeration layer** (a shared query helper) over
> patching each handler — that way new admin screens inherit the behavior for
> free, and there's one place to flip if the rule changes.

### 2. Tallies / counts must match the filtered rows

The target board renders summary tiles (**Behind / At risk / On track / Ahead**)
and a **rep count** ("21 reps"). These are computed server-side
(`MonitorBoardResponse.tallies`, and the row count). **They must be computed
over the already-filtered set**, or the headline numbers will disagree with the
visible rows. Same for any other endpoint that returns both rows and an
aggregate count.

### 3. Convert-to-full-time action (so trainees can graduate back in)

This is the only way a rep leaves the hidden set into the dashboard, so the tag
needs to be settable. Reuse the existing tag route:

```
PATCH /api/v1/sales/acp/members/:memberId/tag   { "tag": "converted" }
```

Semantics for `tag = "converted"`:

- Set `acp_members.tag = 'converted'`.
- Keep / re-enable the `users` login (status `active`) — they're now staff.
- Echo it back in the existing response envelope so the client reflects it:
  `{ "success": true, "data": { "tag": "converted", "status": "active" } }`
  (mirrors the `fired → inactive` echo the FE already reads).
- After this, the predicate above stops hiding them — they appear in the normal
  dashboard automatically. No per-screen work.

> `"fired"` already works (`tag = 'fired'` → login `inactive`) and stays hidden
> from the dashboard, which is the desired end-state for a non-converted rep.
> The FE will add a "Convert to full-time" option to the rep-profile status
> control once this accepts `tag: "converted"` without a `400`.

### 4. (Optional but recommended) expose `acp_status` on user rows

Even with server-side hiding, it's useful for the FE to **badge** a rep who
graduated from the Accelerator ("ex-Accelerator"). If cheap, add to each user
row in the list responses:

```jsonc
"acp_status": "none" | "in_program" | "fired" | "converted"
```

Then `in_program` / `fired` can be filtered defensively on the client too, and
`converted` can show a small badge. Not required for the core fix.

---

## Acceptance criteria

- [ ] A rep with an `acp_members` row tagged `active` / `close_monitoring` /
      `at_risk` / `firing_zone` does **not** appear in: Sales team members,
      target board, assign-targets picker, performance, scorecard leaderboard.
- [ ] A `fired` Accelerator rep does **not** appear in the normal dashboard.
- [ ] A `converted` Accelerator rep **does** appear in the normal dashboard,
      indistinguishable from a normal rep.
- [ ] A user with no `acp_members` row is unaffected.
- [ ] The board `tallies` and rep count reflect the filtered set (no mismatch
      between the "Behind: N" tiles and the visible rows).
- [ ] `PATCH /acp/members/:id/tag {tag:"converted"}` returns `2xx` with
      `{tag:"converted", status:"active"}` and the rep reappears on the next
      dashboard load.
- [ ] The Accelerator tab itself is **unchanged** — batches, batch members, week
      view, rep profiles still list trainees (this filter is for the *normal*
      sales endpoints only, not `/acp/*`).

## How to verify

1. Open **Sales → Target management**. Confirm batch trainees (e.g.
   `kiran-batch-1`, `ram-1batch`, `sai-1batch`) are gone and the rep count drops.
2. Open **Sales team** (`/team`). Same trainees gone from the members table.
3. Open **Accelerator** → the same trainees are still listed in their batch.
4. `PATCH .../tag {tag:"converted"}` on one trainee → it reappears in steps 1–2
   and is no longer shown as a trainee where states are surfaced.
5. `curl` the monitor endpoint and confirm `tallies.total` == `rows.length`.

---

## Frontend reference

- **Stopgap already shipped (team list only):** `team-detail-screen.tsx` now
  cross-references Accelerator member emails (`useAcpEnrolledEmails()` in
  `lib/hooks/use-accelerator.ts`) and hides non-`converted` trainees from the
  members table. This is a client-side interim measure for the one surface that
  exposes per-rep emails; it becomes a harmless no-op once the server stops
  returning those reps from `/sales/subadmins`.
- **Everything else (board, assign-targets, performance, scorecard, …) cannot be
  fixed on the client** — those endpoints return only `{id, name, initials,
  role}` per rep (no email, no ACP flag) and the board `user.id` is the sales
  `users.id`, while `AcpMember.id` is a separate `acp_members` UUID, so there's
  no reliable join key on the FE. They depend on this server change.
