# Backend Spec — Three-Tier Role Hierarchy & Team CRUD

**Audience:** Backend team (NYRA Sales API).
**Status:** Spec / requirements. Frontend has been built against this contract — toggle it on once these endpoints ship.
**Owner:** Frontend team.

---

## 1. The problem

Today the API has **two** role values in the JWT:

| Role | What they can do |
|---|---|
| `SUPER_ADMIN` | Everything — org-wide |
| `SALES_SUBADMIN` | Their own leads, scorecard, pins, overview |

The frontend's user-facing role surface needs **three** tiers:

```
SUPER_ADMIN  →  ADMIN (a.k.a. team / sub-admin)  →  MEMBER
```

The `PATCH /api/v1/sales/users/:userId/role` endpoint already accepts the *strings* `"member"` and `"admin"`, but the doc says they both map to `SALES_SUBADMIN` on the wire — so today an "admin" has identical permissions to a "member". This is the gap.

---

## 2. The three roles, defined

| UI label | Backend JWT role | Scope |
|---|---|---|
| **Super admin** | `SUPER_ADMIN` | Entire org. Creates and deletes teams. Creates and removes team admins. Has every existing super-admin permission today. |
| **Admin** (team admin / sub-admin) | `SALES_ADMIN` *(new)* | One team only. Manages members in that team. Views team-wide data for that team. **Cannot** access other teams or org-level features (audit log, super-admin actions). |
| **Member** | `SALES_SUBADMIN` *(unchanged)* | Themselves only. Views their own performance. Read-only on team data. |

> **Naming note:** Keep `SALES_SUBADMIN` as the JWT value for "member" so existing tokens and rows don't break. Add `SALES_ADMIN` as a new value for the team-admin tier. (Yes, the names are inverted from what the labels suggest — that's the cost of not renaming the existing role.)

The `member` / `admin` strings accepted by `PATCH /sales/users/:userId/role` should now map to:

| String value | Backend JWT role |
|---|---|
| `"member"` | `SALES_SUBADMIN` |
| `"admin"` | `SALES_ADMIN` *(was `SALES_SUBADMIN`)* |
| `"super_admin"` | `SUPER_ADMIN` |

---

## 3. Permission matrix

`✓` = allowed · `—` = forbidden (return 403) · `*` = scoped to own team only

| Endpoint | SUPER_ADMIN | SALES_ADMIN | SALES_SUBADMIN |
|---|:--:|:--:|:--:|
| `GET /api/v1/sales/me/overview` | ✓ | ✓ | ✓ |
| `GET /api/v1/sales/me/activity` | ✓ | ✓ | ✓ |
| `GET /api/v1/sales/team/overview` | ✓ | ✓\* | — |
| `GET /api/v1/sales/team/roster` | ✓ | ✓\* | — |
| `GET /api/v1/sales/team/activity` | ✓ | ✓\* | — |
| `POST /api/v1/sales/team/export` | ✓ | ✓\* | — |
| `GET /api/v1/sales/teams/config` | ✓ | ✓ | ✓ |
| `GET /api/v1/sales/users` | ✓ (all) | ✓\* (own team) | ✓ (self only) |
| `POST /api/v1/sales/teams/invites` | ✓ | ✓\* | — |
| `PATCH /api/v1/sales/users/me/profile` | ✓ | ✓ | ✓ |
| `PATCH /api/v1/sales/users/:userId/role` | ✓ | — | — |
| `PATCH /api/v1/sales/users/:userId/status` | ✓ | ✓\* (members in own team) | — |
| `GET /api/v1/sales/leads` | ✓ (all) | ✓\* (team) | ✓ (own only) |
| `POST /api/v1/sales/leads` | ✓ | ✓\* | ✓ |
| `GET /api/v1/sales/leads/:id` | ✓ | ✓\* | ✓ (own only) |
| `PUT /api/v1/sales/leads/:id` | ✓ | ✓\* | ✓ (own only) |
| `DELETE /api/v1/sales/leads/:id` | ✓ | ✓\* | — |
| `POST /api/v1/sales/leads/reassign` | ✓ | ✓\* | — |
| `GET /api/v1/sales/subadmins` | ✓ | ✓\* | — |
| `POST /api/v1/sales/subadmins` | ✓ | ✓\* (creates members in own team) | — |
| `PATCH /api/v1/sales/subadmins/:id` | ✓ | ✓\* (members in own team) | — |
| `DELETE /api/v1/sales/subadmins/:id` | ✓ | ✓\* (members in own team) | — |
| `PUT /api/v1/sales/subadmins/:id/target` | ✓ | ✓\* | — |
| `POST /api/v1/sales/subadmins/:id/coach` | ✓ | ✓\* | — |
| `POST /api/v1/sales/subadmins/:id/message` | ✓ | ✓\* | — |
| `GET /api/v1/sales/scoring-rule-sets/live` | ✓ | ✓ | ✓ |
| `POST /api/v1/sales/scoring-rule-sets` | ✓ | — | — |
| `POST /api/v1/sales/scoring-rule-sets/:id/restore` | ✓ | — | — |
| `GET /api/v1/sales/targets` | ✓ | ✓\* | ✓ (self only) |
| `PUT /api/v1/sales/targets/:userId` | ✓ | ✓\* | — |
| `GET /api/v1/sales/manual-points` | ✓ | ✓\* | ✓ (self only) |
| `POST /api/v1/sales/scorecard/adjustments` | ✓ | ✓\* | — |
| `DELETE /api/v1/sales/manual-points/:id` | ✓ | — | — |
| `GET /api/v1/sales/audit-log` | ✓ | — | — |
| `GET /api/v1/sales/scorecard/me/board` | ✓ | ✓ | ✓ |
| `GET /api/v1/sales/scorecard/users/:id/board` | ✓ | ✓\* | self only |
| `GET /api/v1/sales/scorecard/leaderboard` | ✓ | ✓\* | — |
| `GET /api/v1/sales/scorecard/team/board` | ✓ | ✓\* | — |
| `GET / PUT /api/v1/sales/scorecard/config` | ✓ | — | — |
| `POST /api/v1/sales/field-pins` | ✓ | ✓ | ✓ |
| `GET /api/v1/sales/field-pins` | ✓ (any) | ✓\* (team only) | self only |
| `DELETE /api/v1/sales/field-pins` | ✓ (any) | ✓\* | self only |

**Rules of thumb for the new `SALES_ADMIN`:**

- They are **always scoped to a single team** (the team they admin). Reject any request that targets a different team with **403 Forbidden** + `code: "WRONG_TEAM"`.
- They are **read-write on members** in their team but **cannot create or modify other admins or super admins**.
- They are **read-only on org-level** features (audit log, scorecard config, scoring rule sets — these stay super-admin-only).

---

## 4. New / changed endpoints

### 4.1 `GET /api/v1/teams` — list all teams

**Permission:** `SUPER_ADMIN` (full list), `SALES_ADMIN` & `SALES_SUBADMIN` (their own team only).

**Response**
```json
{
  "data": [
    {
      "id": "sales",
      "name": "Sales",
      "color": "blue",
      "description": "Outbound deal motion across hospitals & clinics.",
      "admin": {
        "user_id": "uuid",
        "name": "Arjun Mehta",
        "email": "arjun@nyra.ai"
      },
      "member_count": 12,
      "created_at": "...",
      "updated_at": "..."
    }
  ]
}
```

`admin` is `null` if the team currently has no admin.

---

### 4.2 `POST /api/v1/teams` — create a team **with an admin**

**Permission:** `SUPER_ADMIN` only.

The frontend asks the super admin for the team admin's details **at the same time** the team is created — so the request is a single atomic operation that creates both the team row and the `SALES_ADMIN` user, and binds them.

**Body**
```json
{
  "id": "sales",
  "name": "Sales",
  "color": "blue",
  "description": "Outbound deal motion across hospitals & clinics.",
  "admin": {
    "name": "Arjun Mehta",
    "email": "arjun@nyra.ai",
    "phone": "9876543210",
    "password": "TempPass123"
  }
}
```

**Validation:**
- `id` must be unique. Returns `409 Conflict` if already taken.
- `admin.email` must be unique across all users. Returns `409 Conflict` if taken.
- `admin.password` is required, min 8 chars, must be returned in the response so the super admin can share it once with the new admin (see "Password handling" below).

**Response:** `201 Created`
```json
{
  "data": {
    "team": {
      "id": "sales",
      "name": "Sales",
      "color": "blue",
      "description": "Outbound deal motion across hospitals & clinics.",
      "created_at": "...",
      "updated_at": "..."
    },
    "admin": {
      "user_id": "uuid",
      "name": "Arjun Mehta",
      "email": "arjun@nyra.ai",
      "role": "SALES_ADMIN",
      "team_id": "sales",
      "status": "ACTIVE",
      "created_at": "..."
    }
  }
}
```

---

### 4.3 `PATCH /api/v1/teams/:teamId` — edit team metadata

**Permission:** `SUPER_ADMIN`.

**Body** (all optional)
```json
{
  "name": "Sales (Renamed)",
  "color": "indigo",
  "description": "..."
}
```

---

### 4.4 `DELETE /api/v1/teams/:teamId` — delete a team

**Permission:** `SUPER_ADMIN` only.

**Behaviour:**
- Refuses with `409 Conflict` if the team still has members. Backend returns:
  ```json
  { "error": { "code": "TEAM_NOT_EMPTY", "message": "Remove all members before deleting the team." } }
  ```
- On success, also deletes the team admin user (the `SALES_ADMIN` whose `team_id` is this team).
- Cascades / nullifies on leads, scorecards, and pins as appropriate (define per data model).

**Response:** `204 No Content`

---

### 4.5 `POST /api/v1/teams/:teamId/admin` — assign / replace the team admin

**Permission:** `SUPER_ADMIN`.

Use cases:
- The current admin was deleted/deactivated and a replacement is needed.
- Promoting an existing member to admin (pass `existing_user_id`).
- Adding a brand-new admin (pass the same `admin` object as in `POST /teams`).

**Body — replace with new user**
```json
{
  "admin": {
    "name": "Kavya Nair",
    "email": "kavya@nyra.ai",
    "phone": "9988776655",
    "password": "TempPass456"
  }
}
```

**Body — promote existing user**
```json
{ "existing_user_id": "uuid-of-existing-member" }
```

When `existing_user_id` is passed, that user's `role` is changed from `SALES_SUBADMIN` → `SALES_ADMIN`. The previous admin (if any) is automatically demoted to `SALES_SUBADMIN`.

**Response:** `200 OK` with the new admin object.

---

### 4.6 `DELETE /api/v1/teams/:teamId/admin` — demote / remove the team admin

**Permission:** `SUPER_ADMIN`.

**Body** (optional)
```json
{ "demote": true }
```

- `demote: true` (default) — the admin user stays in the team but their role drops to `SALES_SUBADMIN`. They become a regular member.
- `demote: false` — the admin user is **deleted** entirely.

**Response:** `200 OK`
```json
{ "data": { "team_id": "sales", "previous_admin_id": "uuid", "action": "demoted" | "deleted" } }
```

---

### 4.7 Update `POST /api/v1/sales/subadmins`

This endpoint already creates a `SALES_SUBADMIN`. Extend its `role` field so a `SALES_ADMIN` (with their own team scope) can use the same endpoint to create members in *their* team.

**Body** (additive)
```json
{
  "name": "Arjun Mehta",
  "email": "arjun@nyra.ai",
  "phone": "9876543210",
  "password": "SecurePass123",
  "team_id": "sales",
  "role": "SALES_SUBADMIN"
}
```

`team_id` is required when called by `SUPER_ADMIN`. Inferred from the JWT when called by `SALES_ADMIN` (and rejected if it doesn't match their own team).

`role` defaults to `SALES_SUBADMIN`. Only `SUPER_ADMIN` can pass `SALES_ADMIN` here.

---

### 4.8 Update `GET /api/v1/sales/users`

Add a `role` filter and a `team_id` filter so the frontend can query "members of my team" or "all admins":

| Param | Notes |
|---|---|
| `role` | `member`, `admin`, `super_admin` — comma-separated allowed |
| `team_id` | Required for `SUPER_ADMIN` when filtering; auto-applied for `SALES_ADMIN`. |

---

## 5. Password handling

> **The frontend will never display existing passwords** (impossible — they're hashed). Instead, the super admin's flows are:
>
> 1. **At creation time** — super admin types a password, backend stores its hash, **and returns the plaintext exactly once in the response** so the super admin can copy/share it. (See §4.2 response.)
> 2. **At reset time** — super admin calls `PATCH /sales/subadmins/:id` with a new `password`. Backend hashes and stores it. The response includes a confirmation but no plaintext (the super admin already typed it).

The frontend will:
- Show a "View / copy initial password" toast immediately after team creation, with a 30-second clipboard copy CTA.
- Offer a "Reset password" action on the admin/member row that opens a modal where the super admin types a new password.

No "show password" button anywhere.

---

## 6. JWT claims

Add `team_id` to the JWT for `SALES_ADMIN` and `SALES_SUBADMIN` so the API can scope every request without re-querying the user table:

```json
{
  "sub": "uuid",
  "email": "arjun@nyra.ai",
  "name": "Arjun Mehta",
  "role": "SALES_ADMIN",
  "team_id": "sales",
  "iat": 1234567890,
  "exp": 1234567890
}
```

For `SUPER_ADMIN`, `team_id` is `null`.

---

## 7. Migration plan

1. Add `SALES_ADMIN` to the role enum.
2. Add the four team CRUD endpoints (§4.1–4.6).
3. Update the role mapping at `PATCH /sales/users/:userId/role` so `"admin"` → `SALES_ADMIN` (was `SALES_SUBADMIN`). **Existing users with role `"admin"` need to be re-keyed**: write a one-shot migration that promotes any user previously labelled `admin` (if any) to the new `SALES_ADMIN` JWT role.
4. Add `team_id` to JWT claims.
5. Apply scope rules from §3 to every existing endpoint.
6. Update auth middleware to set `req.user.team_id` and check it on team-scoped routes.
7. Ship.

---

## 8. Acceptance test cases

The backend should have explicit tests for:

- ✅ `SUPER_ADMIN` creates a team — both `team` and `admin` rows are created atomically; rolling back on either failure leaves no orphans.
- ✅ `SUPER_ADMIN` deletes an empty team — succeeds; admin user is deleted too.
- ✅ `SUPER_ADMIN` deletes a non-empty team — returns 409 with `TEAM_NOT_EMPTY`.
- ✅ `SALES_ADMIN` creates a `SALES_SUBADMIN` in their own team — succeeds.
- ✅ `SALES_ADMIN` tries to create a `SALES_SUBADMIN` in **another** team — returns 403 with `WRONG_TEAM`.
- ✅ `SALES_ADMIN` tries to promote someone to `SALES_ADMIN` — returns 403.
- ✅ `SALES_ADMIN` reads `/team/overview` for their team — succeeds.
- ✅ `SALES_ADMIN` reads `/team/overview` with `?team_id=other_team` query — returns 403.
- ✅ `SALES_ADMIN` calls `/audit-log` — returns 403.
- ✅ `SALES_SUBADMIN` calls `/team/roster` — returns 403.
- ✅ `SALES_SUBADMIN` reads only their own data on `/sales/leads` (no `?sales_user_id` override).
- ✅ Replacing a team admin demotes the old one to `SALES_SUBADMIN` automatically.

---

## 9. Frontend contract checklist

Once the above is live, the frontend will:

- [ ] Replace the current "Add associate" flow on `/teams` with a hierarchical Teams view: super admin sees all teams, can create/delete teams, view each team's admin + members.
- [ ] When creating a team, render a single form that captures team metadata **and** the team admin's name/email/phone/initial password.
- [ ] On the team detail page, super admin sees the team admin at the top with edit/delete/replace actions, and the member list below with create/edit/deactivate/delete actions.
- [ ] Show the initial password once after team or admin creation with a copyable inline panel.
- [ ] Add "Reset password" row action for both admins and members.
- [ ] Decode the new JWT `team_id` claim so `SALES_ADMIN` users see their team's data on dashboard, leads, scorecard, and field location.
- [ ] Surface 403 / `WRONG_TEAM` errors with a clear toast.

These are tracked in the frontend repo — let frontend know when items 1-7 of the migration plan land so the UI can be flipped on.
