# Backend — Delete a rep (admin) & delete a lead (rep)

Two delete flows for the backend. Both delete entirely (cascade their children)
and keep all derived counts correct.

- **Part 1 — Remove a rep from the Accelerator** (`DELETE /acp/members/:memberId`)
  — route currently returns `404`; needs to be registered.
- **Part 2 — Delete a lead** (`DELETE /sales/leads/:id`) — route exists; must
  delete the lead **entirely** (cascade any linked sprint) and update the counts;
  never blocked.

---

# Part 1 — `DELETE /acp/members/:memberId` returns 404

**Status:** Route missing on the server. Frontend is already wired and waiting.
**Severity:** Blocks the "Remove from program" button in the Accelerator rep profile.
**DB changes:** None (delete/cascade on existing tables only).

---

## The bug

The dashboard's **Remove from program** action (rep profile → Danger zone) sends:

```
DELETE http://localhost:4000/api/v1/sales/acp/members/:memberId
```

The server responds **`404 Not Found`** with a small JSON body — even though the
member exists (the same page just loaded it via `GET /acp/members/:memberId`).

A 404 on a member that demonstrably exists, where the **GET** on the *same path*
works and only the **DELETE** verb fails, means the `DELETE` route is not
registered. The handler needs to be added.

### Proof it's the route, not the data

| Request | Path | Result |
|---|---|---|
| `GET /api/v1/sales/acp/members/:id` | same id | ✅ 200 (page renders) |
| `DELETE /api/v1/sales/acp/members/:id` | same id | ❌ 404 |

Same id, same auth/cookie, same origin — only the verb differs.

---

## What to implement

Add `DELETE /api/v1/sales/acp/members/:memberId` next to the existing
`GET /acp/members/:memberId` handler.

### Auth

Admin-only — same guard as the other ACP admin mutations
(`SALES_ADMIN` / `SUPER_ADMIN`). A plain rep must get `403`.

### Semantics: **un-enroll**, do not delete the person

This is **not** "delete the user". It removes the rep from the Accelerator
program while keeping them a normal sales rep. Concretely:

| Data | Action |
|---|---|
| `acp_members` row (the membership) | **delete** |
| ACP daily logs for the member | **delete** |
| ACP sprints for the member | **delete** |
| ACP coaching / messages for the member | **delete** |
| `users` login (sales account) | **keep** |
| Pipeline leads owned by the rep | **keep** |

> Distinct from **"Fire"** (`PATCH` tag → `fired`), which only disables login
> but leaves the membership and batch intact. Removal is the harder action.

Do the child deletes in a transaction (or rely on `ON DELETE CASCADE` FKs from
`acp_members`) so a partial failure doesn't orphan logs/sprints.

### Response contract

On success, return the envelope the client already understands:

```json
{ "success": true, "data": { "id": ":memberId", "deleted": true } }
```

`200` (with the body above) or `204 No Content` are both fine — the dashboard
only checks for a non-error status, then navigates back to the batch.

### Idempotency (the *second* delete)

A repeat delete of an id that's already gone **may** return `404` — that's
acceptable and the dashboard can treat it as success. But the **first** delete
of a live member must succeed (`2xx`), which is exactly the case failing today.

---

## Suggested handler (Express/Knex sketch — adapt to your stack)

```js
// DELETE /api/v1/sales/acp/members/:memberId   (admin only)
router.delete("/acp/members/:memberId", requireSalesAdmin, async (req, res) => {
  const { memberId } = req.params;

  const member = await db("acp_members").where({ id: memberId }).first();
  if (!member) {
    return res.status(404).json({ success: false, message: "Member not found" });
  }

  await db.transaction(async (trx) => {
    // If you have ON DELETE CASCADE on these FKs, the acp_members delete alone
    // is enough. Otherwise delete children explicitly first:
    await trx("acp_daily_logs").where({ member_id: memberId }).del();
    await trx("acp_sprints").where({ member_id: memberId }).del();
    await trx("acp_messages").where({ member_id: memberId }).del();
    await trx("acp_members").where({ id: memberId }).del();

    // Intentionally NOT touched: `users` (login) and `leads` (pipeline).
  });

  return res.json({ success: true, data: { id: memberId, deleted: true } });
});
```

> Table names above are placeholders — match them to your actual ACP schema
> (whatever backs daily logs, sprints, and coaching messages).

---

## How to verify the fix

1. Pick a rep that **exists** in a batch.
2. From the dashboard: rep profile → **Remove from program** → confirm.
   - Expect: success toast, redirect to the batch, rep gone from the member list.
3. Confirm the rep's **sales login still works** and their **leads still exist**.
4. (Optional) Re-issue the same `DELETE` via curl — `404` on the second call is fine.

```bash
curl -i -X DELETE \
  --cookie "$SESSION_COOKIE" \
  http://localhost:4000/api/v1/sales/acp/members/<memberId>
# First call  -> 200/204
# Second call -> 404 (already removed; acceptable)
```

---

## Frontend reference (no changes needed)

The client side is complete and correct — it will start working the moment the
route returns `2xx`:

- API call: `deleteAcpMember()` — `lib/api/sales-accelerator.ts`
- Mutation hook: `useAcpMutations().deleteMember` — `lib/hooks/use-accelerator.ts`
- UI: `RemoveFromProgramCard` (Danger zone) — `components/sales/accelerator/rep-account-screen.tsx`

---

# Part 2 — Lead deletion (rep): delete entirely + update counts

**Endpoint:** `DELETE /api/v1/sales/leads/:id` (already exists)
**Change:** deleting a lead must **delete it entirely** — including any ACP
sprint it generated — and **update every derived count** in the same
transaction. Deletion is **never blocked**.

> Supersedes the earlier "block sprint-linked deletes with `409 SPRINT_LINKED`"
> idea. That path is **dropped** — the frontend no longer special-cases it.
> A lead with a sprint is deleted along with the sprint, and the sprint's ₹ is
> removed from the roll-ups so no orphaned revenue is left behind.

## Observed bug (live) ⚠️

A rep deleted lead **third-lead-by-jhon**. On the admin rep-profile, after the
page re-read:

- ✅ **Lead count updated** — the SPRINT ₹ caption dropped to `3 running · 2 leads`.
  So the delete handler ran and `lead_count` decremented correctly.
- ❌ **Sprint still shows** — the **Sprints** panel still lists
  `third-lead-by-jhon · ₹0` and the header count still reads **3**.
- ❌ **Daily work log still shows** — Day 4 still renders a
  `third-lead-by-jhon — Sprint accepted` card.

So the `leads` row and `lead_count` are handled, but the **sprint generated from
the lead** and the lead's **daily-log references** are left behind. The delete
must also remove those, in the same transaction, so the lead disappears
everywhere it was surfaced.

> `sprint_rev` only looked correct here because this sprint was ₹0. A deleted
> lead whose sprint was ₹2,500 would leave **SPRINT ₹ overstated** — the
> subtraction below is required, not optional.

## Behaviour

A rep deletes one of their own leads. Hard-delete the lead **with its children**
and correct the counts atomically:

| Data | Action |
|---|---|
| `leads` row | **delete** |
| Lead activities / timeline | **delete** |
| Voice notes, next-action, follow-ups | **delete** |
| ACP sprint generated from the lead (`acp_sprints.source_lead_id = lead.id`) | **delete** (cascade) — *currently left behind* |
| Lead's references in the rep's daily logs (`sprint_accepted` / `visited`) | **remove** — *currently left behind* |
| Rep `lead_count` | **−1** *(already working)* |
| Rep `sprint_rev` + daily-log / batch / overview roll-ups | **− the deleted sprint's ₹** (only when a sprint was removed) |

Wrap it in a transaction (or `ON DELETE CASCADE` FKs from `leads`) so a partial
failure can't leave a sprint pointing at a deleted lead.

> **Daily-log note:** the structured arrays the rep-profile renders its cards
> from (`sprint_accepted`, `visited`) must drop the deleted lead so the card
> disappears. If those are stored by lead id / FK, delete the rows; if they're
> stored as denormalized name strings, strip the matching entry. The free-text
> `note` ("Started sprint at …") is prose and may keep the mention — only the
> structured card needs to go.

## Suggested cascade (sketch — adapt to your schema)

```js
// DELETE /api/v1/sales/leads/:id   (owner or admin)
await db.transaction(async (trx) => {
  // 1. Any ACP sprint that came from this lead → remove it and back out its ₹.
  const sprint = await trx("acp_sprints")
    .where({ source_lead_id: leadId })
    .first();
  if (sprint) {
    await trx("acp_sprints").where({ id: sprint.id }).del();
    if (sprint.status !== "refunded" && sprint.amount > 0) {
      await trx("acp_members")
        .where({ id: sprint.member_id })
        .decrement("sprint_rev", sprint.amount);
      // …and the same amount off that day's daily-log sprint_rev + batch/overview.
    }
  }

  // 2. Drop the lead from the rep's daily-log sprint_accepted / visited.
  //    (Row delete if FK-linked; array/string strip if denormalized.)
  await trx("acp_daily_log_leads").where({ lead_id: leadId }).del();

  // 3. Lead children + the lead itself.
  await trx("lead_activities").where({ lead_id: leadId }).del();
  await trx("leads").where({ id: leadId }).del();

  // lead_count is recomputed from the rep's remaining leads (already correct).
});
```

## Auth

- A rep may delete a lead **only** where `sales_user_id == current_user` → else
  `403`.
- Admin / super admin may delete any lead.
- Unknown id → `404`.

## Response

```json
{ "success": true }
```

`200` or `204`. **No `409`** for sprint-linked leads — deletion always proceeds
for the owner.

## Acceptance criteria

- [ ] Deleting a lead with no sprint removes it and decrements `lead_count` by 1.
- [ ] Deleting a lead **with** a sprint also **deletes that sprint** — it no
      longer appears in `GET /acp/members/:id/sprints`, and the Sprints panel
      count drops accordingly (the live bug: it stayed at 3).
- [ ] The deleted lead no longer appears as a **daily work log** card for the rep.
- [ ] `sprint_rev` / SPRINT ₹ / M1 / batch / overview drop by the removed
      sprint's ₹ (no orphaned revenue).
- [ ] `lead_count` decrements by 1 *(already verified working)*.
- [ ] No `409 SPRINT_LINKED` is returned; deletion succeeds for the owner.
- [ ] A rep gets `403` deleting another rep's lead.

## Backfill — clean sprints already orphaned by past deletes

The `third-lead-by-jhon` sprint (and any like it deleted before this fix) is
already orphaned. Remove sprints whose source lead no longer exists, then
re-roll the affected members' `sprint_rev`:

```sql
-- 1. delete sprints pointing at a lead that's gone
DELETE FROM acp_sprints s
WHERE s.source_lead_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM leads l WHERE l.id = s.source_lead_id);

-- 2. recompute sprint_rev from each member's remaining non-refunded sprints
UPDATE acp_members m
SET sprint_rev = COALESCE((
  SELECT SUM(s.amount) FROM acp_sprints s
  WHERE s.member_id = m.id AND s.status <> 'refunded'
), 0);
```

(Adjust table/column names to match your schema.)

## Frontend reference (done)

- `deleteLead()` — `lib/api/sales-leads.ts` (unchanged route).
- `leads-screen.tsx` no longer blocks sprint-linked deletes: it deletes, drops
  the row optimistically, then refetches so totals stay accurate.
- The admin rep-profile re-reads `member`, daily logs **and** sprints on tab
  focus (`useRefetchOnFocus`). It already shows the updated `lead_count`
  (`2 leads`).
- **Stopgap (frontend):** `rep-profile-screen.tsx` now hides sprints that have
  **no `lead_id` and ₹0** — the exact shape of an orphan whose lead was deleted
  (the backend nulls the lead link instead of deleting the sprint). This clears
  the lingering `third-lead-by-jhon · ₹0` row and drops the Sprints count. It is
  deliberately limited to ₹0 so it never disagrees with the backend's SPRINT ₹
  total — **a non-zero orphan is NOT hidden** and still needs the cascade above.
  The stopgap becomes a no-op once the backend deletes orphaned sprints.
- The **daily-log card** for the deleted lead still shows (it carries no lead id
  to filter on) — that one needs the backend cleanup. The dashboard can only
  drop what the server stops returning.
