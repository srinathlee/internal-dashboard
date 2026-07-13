# Backend — Edit an Accelerator member's profile

**Endpoint to add:** `PATCH /api/v1/sales/acp/members/:memberId`
**What it does:** Lets an admin update a rep's `name`, `email`, `phone`,
`sprint_target`, or `revenue_target` from the rep's Profile screen. **`name`,
`email`, and `phone` must be mirrored onto the rep's underlying `users` row**
in the same transaction so the rep's identity stays consistent across the
Teams / Performance / target-board views — and so the rep can actually log in
with the new email.

**Status:** Frontend is wired and waiting — clicking **Edit → Save changes** on
the rep Profile page calls this endpoint today. It currently fails because the
route isn't registered.
**Severity:** Blocks admins from editing trainee profiles after creation.

---

## Why this is needed

The admin Profile screen (`/sales/accelerator/:batch/:rep/profile`) used to be
read-only — the only way to fix a typo in a rep's name, change a stale phone,
fix the email a typo was added to, or revise a target was to delete + re-add
them. With this endpoint, the **Account details** card has an inline
**Edit → Save** flow covering all five mutable fields.

---

## Contract

### Request

```http
PATCH /api/v1/sales/acp/members/:memberId
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Ravi Kumar",            // optional
  "email": "ravi@myteamflow.com",         // optional — login identifier, see below
  "phone": "+91 90000 00010",      // optional
  "sprint_target": 12000,          // optional, positive integer (₹ as the rest of the program)
  "revenue_target": 125000         // optional, positive integer
}
```

- **All fields are optional**; keys that aren't sent must be left untouched
  (true PATCH semantics). The FE only sends fields the admin actually changed.
- **`name`** — non-empty after trim; reasonable length cap (≤ 120 chars).
- **`email`** — non-empty after trim; must be a valid email format; **must be
  unique** across `users.email` (case-insensitive) — return `409 EMAIL_TAKEN`
  on conflict. Normalize to lowercase before storing. This is the rep's
  **login identifier** — see §"Email change semantics" below.
- **`phone`** — free-form string; trim before storing. May be empty (`""`) to
  clear it. No format enforcement (we already accept international + free-form
  in the add-member flow).
- **`sprint_target` / `revenue_target`** — positive integers (`> 0`). The FE
  validates this client-side too, but please reject on the server with `400`
  if violated.
- **NOT accepted here** (return `400` if present): `joined_at`, `ending_at`,
  `tag`, `status`, `current_*`, `sprint_revenue`, `subscription_revenue`,
  `note`. Each of those already has its own dedicated route or is
  system-derived.

### Email change semantics ⚠️

Email is the rep's **login identifier** (they sign in with it). On update:

- Validate format with a real email check, not just the FE's regex.
- Dedupe **case-insensitively** against `users.email` across the whole
  workspace — return **`409 EMAIL_TAKEN`** if another login already uses the
  trimmed/lowercased value. (No-op when the new value equals the rep's current
  email, even if case differs — i.e. don't 409 a rep against themselves.)
- Store the lowercased trimmed value on both `acp_members.email` and
  `users.email`.
- **Session behaviour:** if your sessions are keyed on `users.id`, existing
  sessions stay valid and the rep can keep working — they'll just sign in with
  the new email next time. If they're keyed on email (don't), an email change
  signs the rep out; either way is acceptable, please **document the chosen
  behaviour in the response or release notes** so admins know what to expect.
- The FE shows a single inline Email input on the Profile screen — there is no
  "are you sure?" prompt; this PATCH itself is the confirmation step.

### Auth

Admin-only — same guard as the other ACP admin mutations (`SALES_ADMIN` /
`SUPER_ADMIN`). A plain rep must get `403`.

### `users` row sync ⚠️ important

`name`, `email`, and `phone` should also be written to the rep's `users` row
(the same row joined into `acp_members.user_id`). If they're not synced:

- the rep's **name** in the Sales-team list, Target board, Performance and
  Scorecard screens will drift from the Accelerator profile, and
- the rep won't be able to **log in** with the new email — the login layer
  reads from `users.email`.

Suggested order (transaction, so a partial failure doesn't leave the two
tables disagreeing):

```js
await db.transaction(async (trx) => {
  // Lock the rep's row.
  const member = await trx("acp_members").where({ id: memberId }).first();
  if (!member) throw httpError(404, "Member not found");

  // 1. Email uniqueness check (case-insensitive, excluding the rep themselves).
  if (input.email !== undefined) {
    const newEmail = input.email.trim().toLowerCase();
    const clash = await trx("users")
      .whereRaw("LOWER(email) = ?", [newEmail])
      .andWhereNot({ id: member.user_id })
      .first();
    if (clash) throw httpError(409, "EMAIL_TAKEN");
  }

  // 2. Update the acp_members row.
  const memberUpdates = {};
  if (input.name !== undefined)            memberUpdates.name           = input.name.trim();
  if (input.email !== undefined)           memberUpdates.email          = input.email.trim().toLowerCase();
  if (input.phone !== undefined)           memberUpdates.phone          = input.phone.trim();
  if (input.sprint_target !== undefined)   memberUpdates.sprint_target  = input.sprint_target;
  if (input.revenue_target !== undefined)  memberUpdates.revenue_target = input.revenue_target;
  if (Object.keys(memberUpdates).length) {
    await trx("acp_members").where({ id: memberId }).update(memberUpdates);
  }

  // 3. Mirror name / email / phone to the backing users row so the rep's
  //    identity stays consistent across the dashboard and they can log in.
  const userUpdates = {};
  if (input.name !== undefined)  userUpdates.name  = input.name.trim();
  if (input.email !== undefined) userUpdates.email = input.email.trim().toLowerCase();
  if (input.phone !== undefined) userUpdates.phone = input.phone.trim();
  if (Object.keys(userUpdates).length) {
    await trx("users").where({ id: member.user_id }).update(userUpdates);
  }
});
```

(Adapt to your ORM/schema — the key points are **email uniqueness checked
inside the transaction** and **both tables updated atomically**.)

### Response

Return the **full normalized member** so the FE can update the cache in one
shot — same envelope and shape as `GET /acp/members/:memberId`:

```jsonc
{
  "success": true,
  "data": {
    "id": "384761b9-ce2b-41fc-873b-76c02035e24e",
    "name": "Ravi Kumar",
    "email": "ravi@myteamflow.com",
    "phone": "+91 90000 00010",
    "joined_at": "2026-06-02T00:00:00Z",
    "ending_at": "2026-08-02T00:00:00Z",
    "tag": "active",
    "status": "active",
    "sprint_rev": 7500,
    "sub_rev": 0,
    "sprint_target": 12000,
    "revenue_target": 125000,
    "lead_count": 4,
    "latest_review": "working_fine",
    "current_week": 1,
    "current_day": 3,
    "current_month": 1,
    "batch_id": "...",
    "batch_name": "Hyderabad Batch",
    "note": "...",
    "note_updated_at": "..."
  }
}
```

> Re-derive `month1_pct` (or whatever sprint-progress field surfaces) if
> `sprint_target` changed — it's `sprint_rev / sprint_target`.

### Errors

| Status | When |
|---|---|
| `400` | Validation: empty `name`/`email`, bad email format, non-positive target, target not an integer, unknown/forbidden field, malformed JSON |
| `401` / `403` | Not authenticated / not an admin |
| `404` | Member not found |
| `409` | `EMAIL_TAKEN` — another `users` row already owns that email (case-insensitive) |
| `500` | Server error |

Bodies should use the existing error envelope (`{ success: false, message }`).
For `409`, include a machine-readable hint so the FE can show a precise toast:

```jsonc
{ "success": false, "message": "Email already in use", "code": "EMAIL_TAKEN" }
```

---

## Acceptance criteria

- [ ] `PATCH /acp/members/:id` accepts any subset of
      `{name, email, phone, sprint_target, revenue_target}` and updates only
      those fields.
- [ ] `name`, `email`, and `phone` are mirrored to the underlying `users` row
      in the **same transaction**.
- [ ] After save, the rep's name and email in the **Sales team** members list,
      **Target board**, **Performance** screen, and **Scorecard** reflect the
      update.
- [ ] After an email change, the rep can **sign in with the new email** (and
      not the old one).
- [ ] Validation: empty `name` or `email` → `400`; bad email format → `400`;
      `sprint_target` ≤ 0 → `400`; `joined_at` / `tag` / `status` in the body
      → `400`.
- [ ] Email uniqueness: another rep's email → `409 EMAIL_TAKEN`; sending the
      rep's own current email (any case) → success (not a 409).
- [ ] Admin-only — plain rep gets `403`.
- [ ] Response body is the full normalized member (same shape as
      `GET /acp/members/:id`).
- [ ] Idempotent — sending the same patch twice returns success both times.

---

## Verification — quick `curl`

```bash
# Update a name + sprint target.
curl -X PATCH "$BASE/api/v1/sales/acp/members/$MEMBER_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Ravi Kumar","sprint_target":12000}'
# Expect: 200 with the full updated member.

# Change email (login identifier).
curl -X PATCH "$BASE/api/v1/sales/acp/members/$MEMBER_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email":"ravi.kumar@myteamflow.com"}'
# Expect: 200; both acp_members.email and users.email now hold the lowercased value.

# Then sign in as the rep with the new email — should succeed.
# Old email → should now fail to authenticate.

# Re-fetch the rep from the sales side — name + email should match
# (proves users-row sync).
curl "$BASE/api/v1/sales/subadmins" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  | jq '.data.sales_subadmins[] | select(.id=="'"$USER_ID"'") | {name, email}'

# Validation: empty name → 400.
curl -i -X PATCH "$BASE/api/v1/sales/acp/members/$MEMBER_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"   "}'

# Validation: bad email format → 400.
curl -i -X PATCH "$BASE/api/v1/sales/acp/members/$MEMBER_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email":"not-an-email"}'

# Conflict: another rep already owns this email → 409 EMAIL_TAKEN.
curl -i -X PATCH "$BASE/api/v1/sales/acp/members/$MEMBER_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email":"someone-else-already@myteamflow.com"}'

# Self-no-op: sending the rep's own current email (any case) → 200, not 409.
curl -i -X PATCH "$BASE/api/v1/sales/acp/members/$MEMBER_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email":"RAVI.KUMAR@MYTEAMFLOW.COM"}'

# Forbidden field → 400.
curl -i -X PATCH "$BASE/api/v1/sales/acp/members/$MEMBER_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"joined_at":"2026-01-01"}'
```

---

## Frontend reference (already wired)

- API call: `updateAcpMember()` in
  [lib/api/sales-accelerator.ts](../lib/api/sales-accelerator.ts).
- Mutation hook: `useAcpMutations().updateMember` in
  [lib/hooks/use-accelerator.ts](../lib/hooks/use-accelerator.ts).
- UI: `AccountDetailsCard` in
  [components/sales/accelerator/rep-account-screen.tsx](../components/sales/accelerator/rep-account-screen.tsx)
  — the **Edit → Save changes** flow. Only sends fields the admin actually
  changed; on success, refetches the member via the screen's `useAcpMember`
  hook so the displayed values update without a reload.

---

## Out of scope (intentional)

These need their own routes / flows and are **not** part of this PATCH:

- **`joined_at` change** — moves the entire program calendar for that rep;
  needs a deliberate UI + side-effects (logs, sprints).
- **`tag` change** — already handled by `PATCH /acp/members/:id/tag`
  (active / fired / converted).
- **`status` change** — derived from `tag` on the backend.
- **Note** — already handled by `PATCH /acp/members/:id/note`.
- **Password** — already handled by `PATCH /acp/members/:id/password`.
