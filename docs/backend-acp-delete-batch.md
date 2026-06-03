# Backend — Delete an Accelerator batch (cascade)

**Endpoint:** `DELETE /api/v1/sales/acp/batches/:batchId`
**What it does:** Permanently deletes a batch **and everything inside it** —
the membership rows, every member's daily logs, sprints, and coaching messages.
Sales user logins and pipeline leads stay intact.

**Status:** Frontend is wired and waiting — the admin **Delete batch** menu on
the batches grid POSTs against this URL today. The route currently exists in
the API client (`deleteAcpBatch()`) but **needs the server-side cascade
implemented**; a route that just deletes the `acp_batches` row will orphan
every child table.

**Severity:** Functional gap. Without the cascade, deleting a batch leaves
orphan `acp_members` / `acp_daily_logs` / `acp_sprints` / `acp_messages` rows
pointing at a missing batch — the next overview/stats query will either error
or report ghost data.

**DB changes:** None required (delete/cascade on existing tables only). Adding
`ON DELETE CASCADE` to the FKs from `acp_members` → batch (and from the child
tables → member) is the cleanest implementation, but explicit child-table
deletes in a transaction work too.

---

## What gets deleted

A single batch delete fans out across **five** ACP tables. Everything below
must happen atomically (transaction or cascade FKs):

| Data | Action |
|---|---|
| `acp_batches` row for `:batchId` | **delete** |
| Every `acp_members` row where `batch_id = :batchId` | **delete** |
| Every `acp_daily_logs` row for those members | **delete** (cascade from `acp_members`) |
| Every `acp_sprints` row for those members | **delete** (cascade from `acp_members`) |
| Every `acp_messages` row for those members | **delete** (cascade from `acp_members`) |
| Pitch audio files (S3 / object storage) referenced by those logs | **delete** (best-effort; see §"Audio cleanup") |
| `users` login for those members (sales account) | **keep** |
| `leads` rows owned by those members (pipeline) | **keep** |

> The "members keep their sales accounts and pipeline leads" semantics matches
> the existing per-member action (`DELETE /acp/members/:memberId`,
> [docs/backend-acp-delete-rep-and-lead.md](./backend-acp-delete-rep-and-lead.md)).
> Deleting a batch is just that action applied to every member of the batch,
> then the batch row itself.

---

## Auth

Admin-only — same guard as the other ACP admin mutations (`SALES_ADMIN` /
`SUPER_ADMIN`). A plain rep must get `403`.

A SALES_ADMIN deleting a batch they don't manage (different team / no scope)
should get `403` too if your auth model scopes batches per team.

---

## Implementation sketch (Express/Knex)

```js
// DELETE /api/v1/sales/acp/batches/:batchId   (admin only)
router.delete("/acp/batches/:batchId", requireSalesAdmin, async (req, res) => {
  const { batchId } = req.params;

  const batch = await db("acp_batches").where({ id: batchId }).first();
  if (!batch) {
    // Idempotent: a second delete of the same id is acceptable as success;
    // the FE treats 404 here as already-deleted.
    return res.status(404).json({ success: false, message: "Batch not found" });
  }

  // Collect the audio object keys *before* the cascade so we can clean
  // storage after the row delete. If you don't track keys, skip this and
  // run a periodic janitor instead.
  const audioRows = await db("acp_daily_logs")
    .join("acp_members", "acp_daily_logs.member_id", "acp_members.id")
    .where("acp_members.batch_id", batchId)
    .whereNotNull("acp_daily_logs.audio_key")
    .select("acp_daily_logs.audio_key");

  await db.transaction(async (trx) => {
    // If ON DELETE CASCADE is wired on acp_members.batch_id and on the
    // child tables (logs/sprints/messages) → acp_members.id, this single
    // delete is enough:
    await trx("acp_batches").where({ id: batchId }).del();

    // Otherwise, delete the children explicitly first:
    //   const memberIds = (await trx("acp_members").where({ batch_id: batchId }).select("id")).map(r => r.id);
    //   await trx("acp_daily_logs").whereIn("member_id", memberIds).del();
    //   await trx("acp_sprints").whereIn("member_id", memberIds).del();
    //   await trx("acp_messages").whereIn("member_id", memberIds).del();
    //   await trx("acp_members").where({ batch_id: batchId }).del();
    //   await trx("acp_batches").where({ id: batchId }).del();

    // Intentionally NOT touched: `users` (sales logins) and `leads` (pipeline).
  });

  // Best-effort: delete the audio objects. A failure here should NOT roll
  // back the DB delete — the rows are already gone; the worst case is
  // dangling objects you can sweep in a janitor job.
  for (const r of audioRows) {
    try { await storage.deleteObject(r.audio_key); } catch {}
  }

  return res.json({
    success: true,
    data: { id: batchId, deleted: true },
  });
});
```

> Table / column names above are placeholders — match them to your actual ACP
> schema. The important parts are: **single transaction**, **all five tables
> drained**, **users + leads untouched**.

### Audio cleanup

Each daily log can have an uploaded pitch recording in object storage
(`audio_url` is presigned; the underlying key is what you need to delete).
Two acceptable approaches:

1. **Eager** — collect keys before the cascade, attempt deletes after the
   DB commit. Failures are logged but don't roll back. (Sketch above.)
2. **Lazy janitor** — leave the objects in place and run a periodic sweep
   that deletes objects whose keys aren't referenced by any `acp_daily_logs`
   row. Simpler endpoint, slightly more storage cost between sweeps.

Either is fine; pick whichever fits your storage setup. Document the choice
in the response notes so admins know whether they need to manually clean up.

### Stats / overview consistency

`GET /acp/overview` aggregates across batches; after the delete, its counters
must not include the removed batch. If those numbers are cached, invalidate
on batch delete (the FE re-fetches both `useAcpBatches` and `useAcpOverview`
right after a successful delete, so a stale-once read is acceptable but
not ideal).

---

## Contract

### Response — success

```jsonc
{
  "success": true,
  "data": { "id": ":batchId", "deleted": true }
}
```

`200` (with body) or `204 No Content` are both fine — the FE only checks for
a non-error status, then refetches `batches` + `overview`.

### Errors

| Status | When |
|---|---|
| `401` / `403` | Not authenticated / not an admin (or out-of-scope team) |
| `404` | Batch not found — **also returned on a repeat delete**; FE treats as success |
| `500` | Server error |

### Idempotency

A repeat delete of an id that's already gone returns `404`. The dashboard
already treats that as a no-op success — the second call from a flapping
network or a stale tab won't surface an error toast.

---

## Acceptance criteria

- [ ] Deleting a batch removes the `acp_batches` row, every `acp_members`
      row in the batch, and every `acp_daily_logs` / `acp_sprints` /
      `acp_messages` row those members owned.
- [ ] After delete, `GET /acp/batches` no longer includes the batch and
      `GET /acp/batches/:batchId` returns `404`.
- [ ] After delete, the members' **sales `users` logins still exist** and they
      can still sign in (they're just no longer enrolled in the program).
- [ ] After delete, the pipeline **leads owned by those members still exist**
      in `leads` and on the leads screen.
- [ ] `GET /acp/overview` counters reflect the removed batch (no ghost
      members / ghost revenue).
- [ ] Repeat delete returns `404` and does **not** corrupt anything.
- [ ] Audio objects in storage are either eagerly deleted or covered by a
      documented janitor process.
- [ ] Admin-only — plain rep gets `403`.

## How to verify

1. Pick a batch with **≥ 2 members**, each with daily logs (and at least one
   with audio + sprints + messages).
2. Note one of the members' sales `users.id` and one of their pipeline lead
   ids before deleting.
3. From the dashboard: batches grid → **⋯ → Delete batch** → type the batch
   name → confirm.
   - Expect: success toast, the card disappears from the grid, overview
     counters drop accordingly.
4. Confirm in the DB:

   ```sql
   -- Should all return 0 rows.
   SELECT * FROM acp_batches      WHERE id            = '<batchId>';
   SELECT * FROM acp_members      WHERE batch_id      = '<batchId>';
   SELECT * FROM acp_daily_logs   WHERE member_id IN  (SELECT id FROM acp_members WHERE batch_id = '<batchId>');
   SELECT * FROM acp_sprints      WHERE member_id IN  (SELECT id FROM acp_members WHERE batch_id = '<batchId>');
   SELECT * FROM acp_messages     WHERE member_id IN  (SELECT id FROM acp_members WHERE batch_id = '<batchId>');

   -- Should both still exist.
   SELECT id FROM users           WHERE id            = '<userId>';
   SELECT id FROM leads           WHERE id            = '<leadId>';
   ```

5. Try logging in as one of the (formerly enrolled) reps with their previous
   credentials — login should still succeed; they should no longer have
   Accelerator surfaces.
6. Re-issue the same `DELETE` via curl — `404` on the second call is fine.

```bash
curl -i -X DELETE \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  $BASE/api/v1/sales/acp/batches/$BATCH_ID
# First call  -> 200 (or 204).
# Second call -> 404 (already removed; FE treats as success).
```

---

## Frontend reference (no changes needed)

The client side is complete and waits on the cascade above:

- API call: `deleteAcpBatch()` in
  [lib/api/sales-accelerator.ts](../lib/api/sales-accelerator.ts).
- Mutation hook: `useAcpMutations().deleteBatch` in
  [lib/hooks/use-accelerator.ts](../lib/hooks/use-accelerator.ts).
- UI: 3-dot DropdownMenu on each `BatchCard` →
  `DeleteBatchDialog` (type-name confirmation) →
  [components/sales/accelerator/accelerator-overview-screen.tsx](../components/sales/accelerator/accelerator-overview-screen.tsx).
  On success the screen refetches `useAcpBatches` + `useAcpOverview` so the
  card vanishes and the top-line counters drop in the same tick.

---

## Out of scope

- **Restoring a deleted batch** — there's no undo. This is destructive on
  purpose; if you want soft-delete (`deleted_at` column), that's a separate
  conversation and a separate ticket. The dashboard's typed-name
  confirmation exists *because* there's no undo.
- **Bulk delete** — one batch at a time. The FE doesn't expose a multi-select.
