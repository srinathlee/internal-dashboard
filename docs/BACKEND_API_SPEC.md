# Backend API Spec — Sales Department (v1)

> Scope: everything that the **Sales Member**, **Sales Admin**, and **Super Admin** roles touch in the current dashboard. Onboarding team is intentionally out of scope here — its API surface mirrors Sales 1:1 once Sales is built, so build Sales first and copy the pattern.

This document is the contract a backend engineer can implement against without re-reading the frontend. Every endpoint listed maps to a real screen or mutation already wired in the UI.

---

## Table of contents

1. [Roles & access matrix](#1-roles--access-matrix)
2. [Conventions](#2-conventions)
3. [Auth & identity](#3-auth--identity)
4. [Users & teams (sales-scoped)](#4-users--teams-sales-scoped)
5. [Leads](#5-leads)
6. [Lead timeline (calls, meetings, notes, stage changes)](#6-lead-timeline)
7. [Pipeline (Kanban)](#7-pipeline-kanban)
8. [Hospitals](#8-hospitals)
9. [Field location (pins)](#9-field-location-pins)
10. [Scorecard — read APIs](#10-scorecard--read-apis)
11. [Scorecard — admin APIs (rule sets, manual points, targets)](#11-scorecard--admin-apis)
12. [Audit log](#12-audit-log)
13. [Database schema (PostgreSQL DDL)](#13-database-schema)
14. [RLS / authorization rules](#14-rls--authorization-rules)
15. [Audit-log triggers](#15-audit-log-triggers)
16. [Implementation order](#16-implementation-order)

---

## 1. Roles & access matrix

The frontend has three roles. Every endpoint must enforce these scopes server-side, regardless of what the UI checks.

| Role | `teamId` | What they see | What they can write |
|---|---|---|---|
| **Sales Member** | `"sales"` | Hospitals (read), own leads, own pipeline, own scorecard, own field pins | Edit own leads, change own lead stages, log call/meeting/note on own leads, drop own pins, edit own profile |
| **Sales Admin** | `"sales"` | Everything members see + team-wide leads/pipeline, all reps' scorecards, team rankings, team field map, scoring rule editor, manual points form, audit (sales-scoped) | All member writes + invite/deactivate sales reps, set per-rep targets, edit scoring rule set, award manual points, override stage on any sales lead |
| **Super Admin** | `null` | All teams, all reps, full audit log, role assignment | All admin writes across **all** teams + assign roles, change anyone's status |

Access predicates already in code:

- [lib/access.ts:12-14](../lib/access.ts#L12-L14) — `isSalesMember`
- [lib/access.ts:16-18](../lib/access.ts#L16-L18) — `isSalesAdmin`
- [lib/access.ts:26-30](../lib/access.ts#L26-L30) — `isSalesAdminOrSuperAdmin`
- [lib/permissions.ts:8-34](../lib/permissions.ts#L8-L34) — full grant table

The grant table verbatim (use this as the single source of truth in the backend):

```ts
member:      [performance:read:self]
admin:       [performance:read:self, performance:read:team, performance:export:team,
              team:add_member, team:remove_member, user:invite, targets:set]
super_admin: admin grants + [performance:read:all, performance:export:all,
              audit_log:read, user:assign_role]
```

**Authorization rule of thumb:** every request goes through this gate:
1. Is the user authenticated? (else 401)
2. Is the user `status = 'active'`? (else 403)
3. Does the role grant the permission?
4. Is the resource in scope? (member: own only; admin: own team only; super_admin: all)

---

## 2. Conventions

### Base URL

```
/api/v1
```

### Auth

`Authorization: Bearer <jwt>` on every request except `/auth/login`.

### Response envelope

Success:
```json
{ "data": { ... } }
```

Or for collections:
```json
{ "data": [...], "meta": { "page": 1, "perPage": 50, "total": 137 } }
```

Error:
```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "You can only edit leads you own.",
    "details": { "leadId": "lead_001" }
  }
}
```

Standard error codes: `UNAUTHENTICATED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `VALIDATION_FAILED` (422), `CONFLICT` (409), `RATE_LIMITED` (429), `INTERNAL` (500).

### Pagination

Cursor-based for high-volume lists (leads, audit log):
```
GET /api/v1/leads?cursor=eyJpZCI6Imxl...&perPage=50
```
Returns `meta.nextCursor` (null when exhausted). Page-based for short lists (users, teams).

### Timestamps

Always ISO 8601 with timezone (`2026-05-05T08:14:00.000Z`). Date-only fields use `YYYY-MM-DD`.

### IDs

Stable string IDs. Recommended prefix scheme matching the seed data:

| Entity | Prefix | Example |
|---|---|---|
| User | `u_` | `u_arjun` |
| Lead | `lead_` | `lead_001` |
| Lead timeline event | `lte_` | `lte_8f2k…` |
| Hospital | `hosp_` | `hosp_42` |
| Field pin | `pin_` | `pin_1715002…` |
| Audit entry | `a_` | `a_001` |
| Manual point award | `mp_` | `mp_20260507…` |
| Scoring rule set version | `rs_v` | `rs_v4` |

Generate with ULIDs server-side; the prefix is for human readability only.

---

## 3. Auth & identity

Currently mocked at [lib/auth.tsx:87-100](../lib/auth.tsx#L87-L100) — accepts any email, no password.

### `POST /auth/login`

**Body**
```json
{ "email": "rahul.kumar@nyra.ai", "password": "..." }
```

**Response 200**
```json
{
  "data": {
    "token": "<jwt>",
    "user": {
      "id": "u_rahul",
      "name": "Rahul Kumar",
      "email": "rahul.kumar@nyra.ai",
      "role": "admin",
      "teamId": "sales",
      "status": "active",
      "joinedAt": "2024-10-14T09:00:00.000Z",
      "lastActiveAt": "2026-05-05T07:42:00.000Z"
    }
  }
}
```

JWT payload (minimum):
```json
{ "sub": "u_rahul", "role": "admin", "teamId": "sales", "exp": 1715... }
```

**Errors**: 401 on bad credentials, 403 if `status = 'inactive'`.

**Side effect**: insert `user.login` audit entry.

### `POST /auth/logout`

Invalidates the session token. Insert `user.logout` audit entry. Returns 204.

### `GET /auth/me`

Returns the current user record. Used on every page load to hydrate `useAuth`.

---

## 4. Users & teams (sales-scoped)

Frontend uses [lib/mock-data.ts:268-274](../lib/mock-data.ts#L268-L274): `getUser`, `getTeamMembers`.

### `GET /teams/sales`

Returns the team config + metric definitions. Drives KPI cards.

**Response**
```json
{
  "data": {
    "id": "sales",
    "name": "Sales",
    "color": "blue",
    "description": "Outbound deal motion across hospitals & clinics.",
    "metrics": [
      { "key": "revenue", "label": "Revenue", "unit": "currency",
        "format": "integer", "aggregation": "sum",
        "betterWhen": "higher", "currency": "INR" },
      { "key": "dealsClosed", "label": "Deals Closed", "unit": "count",
        "format": "integer", "aggregation": "sum", "betterWhen": "higher" },
      { "key": "avgDealSize", "label": "Avg Deal Size", "unit": "currency",
        "format": "integer", "aggregation": "avg",
        "betterWhen": "higher", "currency": "INR" },
      { "key": "conversionRate", "label": "Conversion Rate", "unit": "percent",
        "format": "decimal", "aggregation": "avg", "betterWhen": "higher" }
    ]
  }
}
```

Permission: any authenticated sales-team user or super_admin.

### `GET /users?teamId=sales&role=member&status=active&q=...`

Used by:
- [components/sales/pipeline/pipeline-screen.tsx:64-67](../components/sales/pipeline/pipeline-screen.tsx#L64-L67) — rep filter
- [components/sales/scorecard/scorecard-admin-screen.tsx:113-119](../components/sales/scorecard/scorecard-admin-screen.tsx#L113-L119) — rep switcher

**Response**
```json
{
  "data": [
    { "id": "u_arjun", "name": "Arjun Mehta", "email": "...",
      "role": "member", "teamId": "sales", "status": "active",
      "joinedAt": "...", "lastActiveAt": "..." }
  ]
}
```

**Permission**:
- member: only sees themselves (filter forced to `userId = self`)
- admin (sales): sees all sales users
- super_admin: sees all users across teams

### `POST /teams/sales/invites`

Send a sales-rep invite. Existing form: [components/team/invite-member-modal.tsx](../components/team/invite-member-modal.tsx).

**Body**
```json
{ "name": "Aarav Khanna", "email": "aarav@nyra.ai", "role": "member" }
```

**Response 201**
```json
{ "data": { "userId": "u_aarav", "inviteId": "inv_xyz",
            "inviteUrl": "https://app.../join?token=..." } }
```

**Permission**: `team:add_member` (sales admin or super_admin). For role=admin invitees, requires super_admin (uses `user:assign_role`).

**Side effect**: `user.invite` + `team.member_add` audit entries.

### `PATCH /users/:userId/role`

**Body**: `{ "role": "admin" }`

**Permission**: `user:assign_role` (super_admin only). Sales admins can NOT promote/demote.

**Side effect**: `user.role_change` audit (`details: "member → admin"`).

### `PATCH /users/:userId/status`

**Body**: `{ "status": "inactive" }`

**Permission**: sales admin can deactivate sales members; super_admin can deactivate anyone.

**Side effect**: `user.deactivate` audit entry.

### `PATCH /users/me/profile`

**Body**: `{ "name": "string" }` (email change deferred — separate verified flow).

Not currently audited. Add `user.profile_update` action if it becomes sensitive.

---

## 5. Leads

Backed by [lib/types.ts:199-236](../lib/types.ts#L199-L236) and seed at [lib/sales-leads-data.ts](../lib/sales-leads-data.ts).

### `GET /leads`

Used by [leads-screen.tsx](../components/sales/leads/leads-screen.tsx) and [pipeline-screen.tsx](../components/sales/pipeline/pipeline-screen.tsx).

**Query params**
| Param | Type | Notes |
|---|---|---|
| `ownerId` | string | Filter to a specific rep. Members are always force-filtered to `ownerId=self`. |
| `stage` | LeadStage | Single stage filter from the dropdown. |
| `stages` | LeadStage[] | Comma-separated, used by Kanban. |
| `q` | string | Substring match on `clinicName`, `doctorName`, `phone`, `city`. |
| `withNextAction` | bool | Pipeline filter chip. |
| `sinceLastActivity` | int | Days; "Slow" filter uses `>= 7`. |
| `cursor` | string | Pagination. |
| `perPage` | int | Default 50, max 200. |

**Response item** — full `Lead` shape from [lib/types.ts:199-236](../lib/types.ts#L199-L236) **without** the `timeline` array (keep that separate; it's heavy). Add a thin counter:

```json
{
  "id": "lead_001",
  "clinicName": "32 Pearly White Dental Clinic",
  "doctorName": "Dr. Anika Rao",
  "specialization": "Dentistry",
  "phone": "9240214452",
  "city": "Hyderabad",
  "area": "Gachibowli",
  "address": "Garg's Vivanta, Plot No.4, ...",
  "stage": "subscription-closed",
  "source": "referral",
  "value": 12000,
  "monthlyAppointments": 220,
  "branches": 1,
  "notes": "Strong referral...",
  "ownerId": "u_arjun",
  "lastActivityAt": "2026-05-05T09:14:00.000Z",
  "nextAction": "Send onboarding kit and schedule kickoff.",
  "lostReason": null,
  "lostNotes": null,
  "timelineCount": 8
}
```

### `GET /leads/:leadId`

Returns the full lead **with** its `timeline` array (oldest-first).

**Permission**: member can fetch only own leads; admin/super_admin any.

### `POST /leads`

Create. The "+ New lead" dropdown ([new-lead-dropdown.tsx](../components/sales/pipeline/new-lead-dropdown.tsx)) currently emits a toast and is wired to four entry points: Manual entry, From hospitals, Import CSV, Field capture. The first three should hit this endpoint with different shapes; CSV import hits a separate batch endpoint (below).

**Body** (Manual / Field / From-hospital all collapse here)
```json
{
  "clinicName": "string (required)",
  "doctorName": "string (required)",
  "specialization": "string (required)",
  "phone": "string (required, regex /^\\+?[0-9 \\-()]{6,}$/)",
  "city": "string (required)",
  "area": "string",
  "address": "string",
  "source": "cold | referral | inbound | event | website (required)",
  "stage": "LeadStage (default: cold-lead)",
  "value": 0,
  "monthlyAppointments": 0,
  "branches": 1,
  "notes": "",
  "ownerId": "u_arjun",
  "hospitalId": "hosp_42 (optional, set when 'From hospitals' was used)"
}
```

**Permission**: any sales user can create. Members may only set `ownerId = self`. Admins may assign to any sales rep.

**Side effect**: insert one `stage-change` timeline event from `null → cold-lead` so the timeline tells a complete story; create a server-generated lead id; set `lastActivityAt = now`.

### `POST /leads/import`

Bulk CSV import (deferred in v1 UI but wire-protected here).

**Body**: `multipart/form-data` with a `file` part. Server parses, validates row-by-row, returns:

```json
{ "data": { "imported": 47, "skipped": 3,
  "errors": [{ "row": 12, "field": "phone", "message": "Invalid format" }] } }
```

### `PUT /leads/:leadId`

Full edit from [edit-lead-modal.tsx:152-176](../components/sales/leads/edit-lead-modal.tsx#L152-L176). The modal sends every field, not a partial.

**Body** = `LeadPatch` from [edit-lead-modal.tsx:44-58](../components/sales/leads/edit-lead-modal.tsx#L44-L58):
```ts
{
  clinicName, doctorName, specialization, phone, city, source, area, address,
  monthlyAppointments, branches, value, stage, notes
}
```

**Permission**: member can edit own; admin can edit any sales lead; super_admin any.

**Side effect**:
- `lastActivityAt = now`
- If `stage` changed, **append** a `stage-change` timeline event with `actorId = caller`, `fromStage = previous`, `toStage = new`.

### `PATCH /leads/:leadId/stage`

Inline stage change from the detail sheet ([leads-screen.tsx:145-173](../components/sales/leads/leads-screen.tsx#L145-L173)) and from Kanban drag-drop ([pipeline-screen.tsx:150-200](../components/sales/pipeline/pipeline-screen.tsx#L150-L200)).

**Body**
```json
{ "stage": "doctor-meeting" }
```

When `stage = "lost"` server returns `409 LOST_REQUIRES_REASON` — caller must use `/leads/:leadId/lost` instead.

**Side effect**: append `stage-change` timeline event; bump `lastActivityAt`.

### `POST /leads/:leadId/lost`

Mark-as-lost flow from [mark-as-lost-modal.tsx](../components/sales/pipeline/mark-as-lost-modal.tsx).

**Body**
```json
{
  "reason": "pricing | timing | competitor | no-budget | lost-contact | wrong-fit | other",
  "notes": "optional free-form"
}
```

**Server actions** (atomic):
1. Set `stage = 'lost'`, `lostReason = body.reason`, `lostNotes = body.notes`, `lastActivityAt = now`.
2. Append a `stage-change` timeline event with content `"Lost reason: <reason> — <notes>"` (matches [pipeline-screen.tsx:169-178](../components/sales/pipeline/pipeline-screen.tsx#L169-L178)).

### `POST /leads/:leadId/restore`

Reopen a lost lead. Sets `stage = 'cold-lead'` (or whatever the previous stage was — store it in `lostFromStage` when transitioning to lost), clears `lostReason`/`lostNotes`. Append `stage-change` event. Permission: admin / super_admin.

### `DELETE /leads/:leadId`

Soft delete (set `deletedAt`). Permission: admin only. Members never delete.

---

## 6. Lead timeline

Powers the Activity tab in [lead-detail-sheet.tsx](../components/sales/leads/lead-detail-sheet.tsx). Today the call/meeting/note buttons (lines 172, 177, 182) emit `toast.info("…— Phase 2")`. Wire them to these endpoints.

Type: see [lib/types.ts:183-197](../lib/types.ts#L183-L197).

### `GET /leads/:leadId/timeline`

Returns events oldest-first (UI sorts ascending).

```json
{
  "data": [
    { "id": "lte_...", "actorId": "u_arjun", "timestamp": "...",
      "type": "stage-change", "fromStage": "cold-lead", "toStage": "first-contact" },
    { "id": "lte_...", "actorId": "u_arjun", "timestamp": "...",
      "type": "call", "durationSec": 312,
      "content": "Intro call — interested, asked for case studies." }
  ]
}
```

### `POST /leads/:leadId/timeline/calls`

**Body**: `{ "durationSec": 312, "content": "string" }`

Side effect: bump `lead.lastActivityAt`.

### `POST /leads/:leadId/timeline/meetings`

**Body**: `{ "content": "string", "occurredAt": "ISO" }`

### `POST /leads/:leadId/timeline/notes`

**Body**: `{ "content": "string" }`

### `PATCH /leads/:leadId/next-action`

The "Next action editor — Phase 2" placeholder at [lead-detail-sheet.tsx:303](../components/sales/leads/lead-detail-sheet.tsx#L303). Update the lead's `nextAction` field.

**Body**: `{ "nextAction": "string | null" }`

> Timeline events are **immutable**. Never expose PATCH or DELETE on individual events. If a rep made a mistake, they post a corrective note rather than edit history. (Same constraint as `audit_log`.)

---

## 7. Pipeline (Kanban)

Pipeline summary numbers come from [lib/sales-pipeline.ts:115-150](../lib/sales-pipeline.ts#L115-L150) (`summarizePipeline`). The frontend currently computes this client-side; for v1 you can keep doing that and just hit `GET /leads` with the pipeline filter chips. Once volume grows, expose:

### `GET /pipeline/summary?ownerIds=u_arjun,u_kavya&period=...`

Computed server-side using these formulas (verbatim from [lib/sales-pipeline.ts](../lib/sales-pipeline.ts)):

- `openValue` = sum(`lead.value`) where stage is in `OPEN_STAGES`
- `openCount` = count of those leads
- `weightedForecast` = sum(`lead.value * STAGE_PROBABILITY[lead.stage]`) for open stages
  - probabilities: cold=0.05, first-contact=0.10, doctor-meeting=0.25, pitch-delivered=0.50, hot-lead=0.75, sprint-started=0.85, sprint-review=0.95
- `closedWonValue` / `closedWonCount` = leads with stage `subscription-closed`
- `lostCount` = leads with stage `lost`
- `winRatePct` = `closedWonCount / (closedWonCount + lostCount) * 100` (null when denominator is 0)

**Permission**: members see only own; admins see team-wide.

### Stage transition rules

These are stage values, not sequence — the UI lets reps move freely between any pair. Backend enforces only one rule:

> Moving to `lost` requires `reason`. Use `/leads/:leadId/lost` (not the generic stage-change endpoint).

If you want to add forward-only rules later, that's a future migration — the seed data has reverse moves (`doctor-meeting → first-contact` at [sales-leads-data.ts:88](../lib/sales-leads-data.ts#L88)) so don't enforce now.

---

## 8. Hospitals

[components/hospitals/hospitals-screen.tsx](../components/hospitals/hospitals-screen.tsx). Read-only in v1, but the data model needs full CRUD because hospitals seed leads via "From hospitals" in the new-lead dropdown.

### `GET /hospitals?city=&q=&sort=name|branchCount|userCount`

Returns the hospital grid.

```json
{
  "data": [
    { "id": "hosp_1", "name": "Apollo Clinic", "address": "...",
      "city": "Hyderabad", "adminCount": 2, "userCount": 14,
      "branchCount": 3, "createdById": "u_rahul", "nyraAiNumber": "9240210000" }
  ]
}
```

**Permission**: any sales user; super_admin.

### `GET /hospitals/:id` — single record (used by "From hospitals" picker)

### `POST /hospitals` — create (admin / super_admin)

### `PATCH /hospitals/:id` — edit (admin / super_admin)

### `DELETE /hospitals/:id` — soft delete (super_admin only)

---

## 9. Field location (pins)

Two surfaces:
- **Member**: [field-location-screen.tsx](../components/sales/field-location/field-location-screen.tsx) — drop your own pin, see your history. Currently uses `localStorage` keyed by `nyra-dashboard:field-pins:<userId>`.
- **Admin**: [field-location-admin-screen.tsx](../components/sales/field-location/field-location-admin-screen.tsx) — team map, per-rep history.

### `POST /field-pins`

**Body**
```json
{ "lat": 17.4399, "lng": 78.3489 }
```

The `userId` and `timestamp` are server-set (timestamp = now). Returns the created pin.

**Permission**: any sales user. `userId` is always `self` — admins do not drop pins on someone else's behalf.

### `GET /field-pins?userId=&from=&to=`

Returns pins matching the filters, newest-first.

**Permission**:
- member: `userId` forced to self
- admin: any sales user
- super_admin: any user

### `DELETE /field-pins`

Clear pin history. Body: `{ "userId": "u_arjun" }` (omit to clear self). Permission: self for members; admin can clear any sales rep.

---

## 10. Scorecard — read APIs

The scorecard is not stored — it's **computed** from leads, timeline events, daily metrics, and targets. The reference implementation is [scorecard-shared.ts:641-779](../components/sales/scorecard/scorecard-shared.tsx#L641-L779) (`buildScorecard`).

The cleanest backend pattern is to expose the building blocks and let the server (not the client) do the aggregation per request. The client calls one endpoint and gets the rendered scorecard.

### `GET /scorecards/:userId?period=month|quarter|year|range&from=&to=`

Computes the scorecard for one rep. The frontend already encodes the period semantics in [scorecard-shared.ts:207-269](../components/sales/scorecard/scorecard-shared.tsx#L207-L269) (`resolveWindow`) — match those exact rules so the UI doesn't need to translate.

**Response**
```json
{
  "data": {
    "user": { "id": "u_arjun", "name": "...", "email": "..." },
    "window": { "from": "2026-05-01", "to": "2026-05-31",
                "label": "May 2026", "tagDate": "2026-05" },
    "totalPoints": 47,
    "weightedScore": 76.42,
    "grade": { "letter": "B", "tone": "indigo" },
    "mrr": 240000,
    "metrics": [
      {
        "id": "new_leads",
        "label": "New leads assigned",
        "description": "New sales leads created in the period",
        "unit": "count",
        "weight": 15,
        "achieved": 11,
        "target": 20,
        "progress": 0.55,
        "score": 8.25,
        "status": "on-track",
        "rawCount": 11,
        "trend": [
          { "date": "2026-05-01", "value": 0 },
          { "date": "2026-05-02", "value": 1 }
        ]
      }
    ]
  }
}
```

**Computation rules** (replicate exactly from [scorecard-shared.ts](../components/sales/scorecard/scorecard-shared.tsx)):
- `new_leads` (weight 15, target 20): count of leads owned by the user where their timeline has a `stage-change` event with `toStage = first-contact` inside the window.
- `discipline` (weight 10, target 80%): `(active_days / total_days) * 100` where `active_days` = distinct dates of any timeline event the rep authored inside the window.
- `meetings` (weight 20, target 8): count of `type=meeting` timeline events.
- `pipeline_moved` (weight 25, target = `targets.values.revenue`): sum of `lead.value` for leads moved to `pitch-delivered` in the window.
- `deals_won` (weight 20, target = `min(targets.values.dealsClosed, 3)`): count from `daily_metrics.dealsClosed` summed in the window. Fallback: 1 if any closed-won lead in the window.
- `field_checkins` (weight 10, target 12): count of `field_pins` for the user inside the window. (Currently mocked from `userId` hash — wire to real pins.)

For each row:
```
progress = min(1, achieved / target)   // 0 when target = 0
score    = progress * weight
status   = progress >= 0.5 ? "on-track" : "at-risk"
```

Letter grade from `weightedScore`: see [scorecard-shared.ts:404-411](../components/sales/scorecard/scorecard-shared.tsx#L404-L411). 95+ A+, 85+ A, 75+ B, 65+ C, 50+ D, else F.

**Permission**:
- member: `userId` must equal self
- admin: any sales rep
- super_admin: any user

### `GET /scorecards/team?teamId=sales&period=&from=&to=`

Batch endpoint — returns scorecards for every active member of the team. Drives the rankings tab and the rep switcher in [scorecard-admin-screen.tsx:135-143](../components/sales/scorecard/scorecard-admin-screen.tsx#L135-L143).

**Response**
```json
{
  "data": {
    "window": { "from": "...", "to": "...", "label": "May 2026" },
    "scorecards": [
      { "user": {...}, "totalPoints": 47, "weightedScore": 76.42,
        "grade": {...}, "mrr": 240000, "metrics": [...] }
    ],
    "teamSummary": {
      "reps": 3, "averageScore": 68.3, "grade": { "letter": "C", "tone": "amber" },
      "onTrack": 1, "atRisk": 1, "behind": 0, "inactive": 1, "mrr": 540000
    }
  }
}
```

`teamSummary` formulas from [scorecard-admin-screen.tsx:275-325](../components/sales/scorecard/scorecard-admin-screen.tsx#L275-L325):
- per-rep status: `onTrack` if `repScore ≥ 75`, `atRisk` if `≥ 50`, `behind` if `< 50`, `inactive` if every metric has `rawCount = 0`.
- `averageScore` = mean of rep weighted scores.

**Permission**: admin / super_admin only.

### `GET /scorecards/share/:repId?period=...` (deferred)

Generates a signed shareable link. Used by the "Share with manager" button at [scorecard-admin-screen.tsx:478](../components/sales/scorecard/scorecard-admin-screen.tsx#L478). Tokenized read-only view.

### `GET /scorecards/:userId/export?format=pdf` (deferred)

PDF export endpoint for the "Export PDF" button at [scorecard-admin-screen.tsx:481-484](../components/sales/scorecard/scorecard-admin-screen.tsx#L481-L484). Returns `application/pdf`. Audit as `performance.export`.

---

## 11. Scorecard — admin APIs

### Scoring rule sets

The setup tab at [scorecard-admin-screen.tsx:1184-1629](../components/sales/scorecard/scorecard-admin-screen.tsx#L1184-L1629) lets admins edit per-metric `MetricRow`. New shape (not yet in `lib/types.ts` — add to backend):

```ts
ScoringRule {
  id: string
  systemId: string         // snake_case stable identifier
  label: string
  description: string
  unit: "count" | "currency" | "percent"
  weight: number           // 0–100, the ruleset must sum active weights to 100
  sortOrder: number
  active: boolean
  target: number
  pointsPerUnit: number
  bonusPoints: number
  bonusAtTargetPct: number
  cap: number | null
  floor: number | null
  stretch: number | null
}

ScoringRuleSet {
  id: string               // rs_v4
  teamId: "sales"
  version: number          // incrementing integer
  isLive: boolean          // exactly one is live per team
  appliedAt: string | null
  appliedById: string | null
  summary: string
  changes: string[]        // human-readable diff lines
  rules: ScoringRule[]
}
```

Mock history at [scorecard-admin-screen.tsx:1977-2021](../components/sales/scorecard/scorecard-admin-screen.tsx#L1977-L2021).

#### `GET /scoring-rule-sets?teamId=sales`

Returns version history (newest first). UI: [scorecard-admin-screen.tsx:2023-2133](../components/sales/scorecard/scorecard-admin-screen.tsx#L2023-L2133).

#### `GET /scoring-rule-sets/live?teamId=sales`

Returns the currently live rule set. The frontend rule editor seeds from this.

#### `POST /scoring-rule-sets` (publish a new version)

**Body**: full `{ teamId, summary, changes[], rules[] }`. Server:
1. Validates that **active rules' weights sum to 100** (UI enforces at [scorecard-admin-screen.tsx:1296-1304](../components/sales/scorecard/scorecard-admin-screen.tsx#L1296-L1304); backend must also enforce — return `422 WEIGHTS_NOT_100`).
2. Increments version: `live.version + 1`.
3. Sets `isLive = true` on the new row, flips previous live to `isLive = false`.
4. Audit: `scoring_rules.publish`.

**Permission**: sales admin or super_admin.

#### `POST /scoring-rule-sets/:versionId/restore`

Roll back. Internally just publishes a new version whose rules match the chosen version (so versioning stays append-only).

UI: [scorecard-admin-screen.tsx:2116-2123](../components/sales/scorecard/scorecard-admin-screen.tsx#L2116-L2123).

### Targets per rep

Current frontend stores a flat `targets` table — one record per user per team. With per-rep overrides being added (see "Custom targets by rep" placeholder at [scorecard-admin-screen.tsx:1609-1624](../components/sales/scorecard/scorecard-admin-screen.tsx#L1609-L1624)), use:

#### `GET /targets?userId=&teamId=&period=monthly&from=&to=`

#### `PUT /targets/:userId?period=monthly`

**Body**
```json
{ "values": { "revenue": 1500000, "dealsClosed": 25,
              "avgDealSize": 60000, "conversionRate": 32 } }
```

**Permission**: `targets:set` (admin / super_admin). Admin scoped to own team.

**Side effect**: `targets.update` audit with details `"revenue: ₹10L → ₹15L"` (mirror existing format at [mock-data.ts:447](../lib/mock-data.ts#L447)).

### Manual point awards

Form at [scorecard-admin-screen.tsx:2166-2393](../components/sales/scorecard/scorecard-admin-screen.tsx#L2166-L2393).

Schema (new):
```ts
ManualPointAward {
  id: string
  userId: string                  // recipient
  awardedById: string             // admin who clicked apply
  metricId: string                // matches ScoringRule.id
  points: number                  // signed (positive add, negative deduct)
  reason: string                  // required, free-form
  category: "coaching" | "spiff" | "correction" | "other"
  internalNote: string | null     // not visible to rep
  createdAt: string
}
```

#### `POST /manual-points`

**Body**
```json
{
  "userId": "u_arjun",
  "metricId": "new_leads",
  "points": 5,
  "reason": "Hit 3 demos in one day during the sprint contest.",
  "category": "spiff",
  "internalNote": "Won the May spiff."
}
```

**Validation**:
- `userId`, `metricId`, `points`, `reason` required.
- `points != 0`.

**Permission**: sales admin (own team only) or super_admin.

**Side effect**: `manual_points.award` audit with details `"+5 pts on new_leads"`.

#### `GET /manual-points?userId=&from=&to=`

Returns awards within window. The scorecard read endpoint must add these to each metric's `score` after the standard `progress * weight` calculation. Apply category-aware logic later if needed; for v1, just sum.

#### `DELETE /manual-points/:id`

Reverse an award. Append an opposite-sign record (do NOT hard-delete) so audit history stays intact.

### Coaching notes & 1-on-1 scheduling (placeholders)

[scorecard-admin-screen.tsx:587-606](../components/sales/scorecard/scorecard-admin-screen.tsx#L587-L606) has dropdown items: "Log coaching note", "Schedule 1-on-1", "Award manual points". The first two emit toasts today.

Suggested endpoints when you wire them:
- `POST /coaching-notes` — `{ userId, content, ruleSetVersionId? }`
- `POST /one-on-ones` — `{ userId, occursAt, talkingPoints[] }`

---

## 12. Audit log

Defined at [lib/types.ts:111-135](../lib/types.ts#L111-L135). Every mutation in this spec must insert exactly one audit row.

### Required action set (extend [lib/types.ts:111-120](../lib/types.ts#L111-L120))

Existing:
```
user.login, user.logout, user.invite, user.role_change, user.deactivate,
team.member_add, team.member_remove, targets.update, performance.export
```

Add for sales:
```
lead.create, lead.update, lead.stage_change, lead.lost, lead.restore, lead.delete,
lead.timeline.call, lead.timeline.meeting, lead.timeline.note, lead.next_action_update,
hospital.create, hospital.update, hospital.delete,
field_pin.create, field_pin.clear,
scoring_rules.publish, scoring_rules.restore,
manual_points.award, manual_points.reverse
```

### `GET /audit-log?actorId=&action=&teamId=&from=&to=&cursor=`

Returns audit entries newest-first.

**Permission**:
- super_admin: full access (`audit_log:read` permission).
- sales admin: scoped — only entries where `resource` ties back to `teamId = sales`. Implementation: store `teamId` on each audit row (denormalized), filter in RLS.
- members: no access. Returns 403.

### Audit row shape (server-generated, never client-supplied)

```json
{
  "id": "a_001",
  "timestamp": "2026-05-05T08:14:12.000Z",
  "actorId": "u_priya",
  "action": "lead.stage_change",
  "resource": "Sales / 32 Pearly White Dental Clinic",
  "resourceId": "lead_001",
  "ip": "203.0.113.21",
  "details": "stage: pitch-delivered → hot-lead",
  "teamId": "sales"
}
```

Append-only. No PATCH, no DELETE on audit rows ever.

---

## 13. Database schema

PostgreSQL, ready to drop into Supabase or any Postgres. All `id` fields are text (ULID with prefix). `jsonb` for opaque blobs.

```sql
-- ENUMs (matching lib/types.ts unions)
CREATE TYPE role AS ENUM ('member', 'admin', 'super_admin');
CREATE TYPE team_id AS ENUM ('sales', 'onboarding');
CREATE TYPE user_status AS ENUM ('active', 'inactive');

CREATE TYPE lead_stage AS ENUM (
  'cold-lead', 'first-contact', 'doctor-meeting', 'pitch-delivered',
  'hot-lead', 'sprint-started', 'sprint-review', 'subscription-closed', 'lost'
);
CREATE TYPE lead_source AS ENUM ('cold', 'referral', 'inbound', 'event', 'website');
CREATE TYPE lead_lost_reason AS ENUM (
  'pricing', 'timing', 'competitor', 'no-budget', 'lost-contact',
  'wrong-fit', 'other'
);
CREATE TYPE lead_activity_type AS ENUM ('stage-change', 'note', 'call', 'meeting');

CREATE TYPE manual_point_category AS ENUM ('coaching', 'spiff', 'correction', 'other');

-- ---------- users ----------
CREATE TABLE users (
  id              text PRIMARY KEY,
  name            text NOT NULL,
  email           text UNIQUE NOT NULL,
  role            role NOT NULL,
  team_id         team_id,                        -- null when role = super_admin
  status          user_status NOT NULL DEFAULT 'active',
  joined_at       timestamptz NOT NULL DEFAULT now(),
  last_active_at  timestamptz NOT NULL DEFAULT now(),
  password_hash   text,                           -- nullable until auth ships
  CONSTRAINT users_super_admin_no_team
    CHECK ((role = 'super_admin') = (team_id IS NULL))
);
CREATE INDEX users_team_role_idx ON users (team_id, role) WHERE status = 'active';

-- ---------- hospitals ----------
CREATE TABLE hospitals (
  id              text PRIMARY KEY,
  name            text NOT NULL,
  address         text NOT NULL,
  city            text NOT NULL,
  admin_count     int NOT NULL DEFAULT 0,
  user_count      int NOT NULL DEFAULT 0,
  branch_count    int NOT NULL DEFAULT 1,
  created_by_id   text REFERENCES users(id),
  nyra_ai_number  text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);
CREATE INDEX hospitals_city_idx ON hospitals (city) WHERE deleted_at IS NULL;

-- ---------- leads ----------
CREATE TABLE leads (
  id                    text PRIMARY KEY,
  clinic_name           text NOT NULL,
  doctor_name           text NOT NULL,
  specialization        text NOT NULL,
  phone                 text NOT NULL,
  city                  text NOT NULL,
  area                  text NOT NULL DEFAULT '',
  address               text NOT NULL DEFAULT '',
  stage                 lead_stage NOT NULL DEFAULT 'cold-lead',
  source                lead_source NOT NULL,
  value                 int NOT NULL DEFAULT 0,
  monthly_appointments  int NOT NULL DEFAULT 0,
  branches              int NOT NULL DEFAULT 1,
  notes                 text NOT NULL DEFAULT '',
  owner_id              text NOT NULL REFERENCES users(id),
  hospital_id           text REFERENCES hospitals(id),
  last_activity_at      timestamptz NOT NULL DEFAULT now(),
  next_action           text,
  lost_reason           lead_lost_reason,
  lost_notes            text,
  lost_from_stage       lead_stage,                -- to enable /restore
  team_id               team_id NOT NULL DEFAULT 'sales',  -- denormalized for RLS
  created_at            timestamptz NOT NULL DEFAULT now(),
  deleted_at            timestamptz
);
CREATE INDEX leads_owner_stage_idx ON leads (owner_id, stage) WHERE deleted_at IS NULL;
CREATE INDEX leads_team_stage_idx ON leads (team_id, stage) WHERE deleted_at IS NULL;
CREATE INDEX leads_search_idx ON leads
  USING gin (to_tsvector('simple', clinic_name || ' ' || doctor_name || ' ' || phone || ' ' || city));

-- ---------- lead_timeline_events (immutable) ----------
CREATE TABLE lead_timeline_events (
  id            text PRIMARY KEY,
  lead_id       text NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  actor_id      text NOT NULL REFERENCES users(id),
  type          lead_activity_type NOT NULL,
  timestamp     timestamptz NOT NULL DEFAULT now(),
  from_stage    lead_stage,
  to_stage      lead_stage,
  content       text,
  duration_sec  int,
  CONSTRAINT lte_stage_change_has_to
    CHECK (type <> 'stage-change' OR to_stage IS NOT NULL),
  CONSTRAINT lte_call_has_duration
    CHECK (type <> 'call' OR duration_sec IS NOT NULL)
);
CREATE INDEX lte_lead_ts_idx ON lead_timeline_events (lead_id, timestamp);
CREATE INDEX lte_actor_ts_idx ON lead_timeline_events (actor_id, timestamp);

-- Enforce immutability with a trigger (no UPDATE / DELETE allowed on this table).

-- ---------- daily_metrics ----------
CREATE TABLE daily_metrics (
  user_id   text NOT NULL REFERENCES users(id),
  team_id   team_id NOT NULL,
  date      date NOT NULL,
  values    jsonb NOT NULL,
  PRIMARY KEY (user_id, date)
);
CREATE INDEX dm_team_date_idx ON daily_metrics (team_id, date);

-- ---------- targets ----------
CREATE TABLE targets (
  user_id   text NOT NULL REFERENCES users(id),
  team_id   team_id NOT NULL,
  period    text NOT NULL DEFAULT 'monthly',
  values    jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, period)
);

-- ---------- field_pins ----------
CREATE TABLE field_pins (
  id          text PRIMARY KEY,
  user_id     text NOT NULL REFERENCES users(id),
  team_id     team_id NOT NULL,
  lat         double precision NOT NULL,
  lng         double precision NOT NULL,
  timestamp   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX field_pins_user_ts_idx ON field_pins (user_id, timestamp DESC);

-- ---------- scoring_rule_sets ----------
CREATE TABLE scoring_rule_sets (
  id              text PRIMARY KEY,
  team_id         team_id NOT NULL,
  version         int NOT NULL,
  is_live         boolean NOT NULL DEFAULT false,
  applied_at      timestamptz,
  applied_by_id   text REFERENCES users(id),
  summary         text NOT NULL DEFAULT '',
  changes         jsonb NOT NULL DEFAULT '[]'::jsonb,
  UNIQUE (team_id, version),
  -- exactly one live ruleset per team
  EXCLUDE (team_id WITH =) WHERE (is_live)
);

CREATE TABLE scoring_rules (
  id                    text PRIMARY KEY,
  rule_set_id           text NOT NULL REFERENCES scoring_rule_sets(id) ON DELETE CASCADE,
  system_id             text NOT NULL,
  label                 text NOT NULL,
  description           text NOT NULL DEFAULT '',
  unit                  text NOT NULL,           -- count|currency|percent
  weight                numeric NOT NULL,
  sort_order            int NOT NULL,
  active                boolean NOT NULL DEFAULT true,
  target                numeric NOT NULL,
  points_per_unit       numeric NOT NULL DEFAULT 1,
  bonus_points          numeric NOT NULL DEFAULT 0,
  bonus_at_target_pct   numeric NOT NULL DEFAULT 100,
  cap                   numeric,
  floor                 numeric,
  stretch               numeric,
  UNIQUE (rule_set_id, system_id)
);

-- ---------- manual_point_awards ----------
CREATE TABLE manual_point_awards (
  id              text PRIMARY KEY,
  user_id         text NOT NULL REFERENCES users(id),
  awarded_by_id   text NOT NULL REFERENCES users(id),
  team_id         team_id NOT NULL,
  metric_id       text NOT NULL,                  -- matches scoring_rules.system_id
  points          numeric NOT NULL,
  reason          text NOT NULL,
  category        manual_point_category NOT NULL DEFAULT 'coaching',
  internal_note   text,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mpa_user_created_idx ON manual_point_awards (user_id, created_at DESC);

-- ---------- audit_log (immutable) ----------
CREATE TABLE audit_log (
  id            text PRIMARY KEY,
  timestamp     timestamptz NOT NULL DEFAULT now(),
  actor_id      text REFERENCES users(id),
  action        text NOT NULL,
  resource      text NOT NULL,
  resource_id   text,
  team_id       team_id,
  ip            inet,
  details       text
);
CREATE INDEX audit_actor_ts_idx ON audit_log (actor_id, timestamp DESC);
CREATE INDEX audit_team_ts_idx  ON audit_log (team_id, timestamp DESC);
```

### Immutability triggers

```sql
CREATE OR REPLACE FUNCTION reject_modify() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'append-only table'; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER lte_no_update BEFORE UPDATE OR DELETE ON lead_timeline_events
  FOR EACH ROW EXECUTE FUNCTION reject_modify();
CREATE TRIGGER audit_no_update BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION reject_modify();
```

---

## 14. RLS / authorization rules

If you go with Supabase or Postgres-native auth, these RLS policies enforce the role matrix from §1. The key pattern: every table that needs scope has a `team_id` column (denormalized) so the policy is a fast index lookup, not a join.

```sql
-- Helpers — read claims from the JWT (Supabase exposes auth.uid() and auth.jwt())
CREATE OR REPLACE FUNCTION current_user_id() RETURNS text AS $$
  SELECT current_setting('request.jwt.claim.sub', true);
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION current_user_role() RETURNS role AS $$
  SELECT current_setting('request.jwt.claim.role', true)::role;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION current_user_team() RETURNS team_id AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.teamId', true), '')::team_id;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION is_super_admin() RETURNS boolean AS $$
  SELECT current_user_role() = 'super_admin';
$$ LANGUAGE sql STABLE;

-- Block inactive users at every table (Postgres has no global guard, do it per-policy).

-- ---------- users ----------
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_self_or_admin_read ON users FOR SELECT USING (
  is_super_admin()
  OR (current_user_role() = 'admin' AND team_id = current_user_team())
  OR id = current_user_id()
);

CREATE POLICY users_admin_write ON users FOR UPDATE USING (
  is_super_admin()
  OR (current_user_role() = 'admin' AND team_id = current_user_team())
);

-- ---------- leads ----------
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY leads_member_own ON leads FOR SELECT USING (
  is_super_admin()
  OR (current_user_role() = 'admin' AND team_id = current_user_team())
  OR (current_user_role() = 'member' AND owner_id = current_user_id())
);

CREATE POLICY leads_member_own_write ON leads FOR UPDATE USING (
  is_super_admin()
  OR (current_user_role() = 'admin' AND team_id = current_user_team())
  OR (current_user_role() = 'member' AND owner_id = current_user_id())
);

CREATE POLICY leads_member_create ON leads FOR INSERT WITH CHECK (
  is_super_admin()
  OR (current_user_role() = 'admin' AND team_id = current_user_team())
  OR (current_user_role() = 'member' AND owner_id = current_user_id()
      AND team_id = current_user_team())
);

-- ---------- lead_timeline_events ----------
ALTER TABLE lead_timeline_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY lte_via_lead ON lead_timeline_events FOR SELECT USING (
  EXISTS (SELECT 1 FROM leads l WHERE l.id = lead_id
          AND (is_super_admin()
               OR (current_user_role() = 'admin' AND l.team_id = current_user_team())
               OR (current_user_role() = 'member' AND l.owner_id = current_user_id())))
);
CREATE POLICY lte_create ON lead_timeline_events FOR INSERT WITH CHECK (
  actor_id = current_user_id()
  AND EXISTS (SELECT 1 FROM leads l WHERE l.id = lead_id
              AND (is_super_admin()
                   OR (current_user_role() = 'admin' AND l.team_id = current_user_team())
                   OR (current_user_role() = 'member' AND l.owner_id = current_user_id())))
);

-- ---------- field_pins ----------
ALTER TABLE field_pins ENABLE ROW LEVEL SECURITY;
CREATE POLICY pins_self ON field_pins FOR SELECT USING (
  is_super_admin()
  OR (current_user_role() = 'admin' AND team_id = current_user_team())
  OR user_id = current_user_id()
);
CREATE POLICY pins_create_self ON field_pins FOR INSERT WITH CHECK (
  user_id = current_user_id()
);

-- ---------- audit_log ----------
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_super_admin_or_team_admin ON audit_log FOR SELECT USING (
  is_super_admin()
  OR (current_user_role() = 'admin' AND team_id = current_user_team())
);
-- No UPDATE / DELETE policy → table-level reject_modify() trigger handles that.

-- ---------- targets, scoring_rules*, manual_point_awards ----------
-- All scoped by team_id; admin reads/writes own team only, super_admin all.
-- See §13 schema; apply the same pattern.
```

> If you're not on Postgres-with-RLS, do the equivalent check in middleware. Either way: **never trust the client's claim about who they are** — re-fetch role/teamId from `users` on every request from the JWT's `sub`.

---

## 15. Audit-log triggers

You can either:

**Option A — explicit insert from each route handler** (more flexible, easier to format `details`).

**Option B — Postgres triggers** that emit audit rows on every INSERT/UPDATE on watched tables. Faster, can't be skipped, but harder to write nice `details` strings.

Recommendation: **A for human-readable mutations** (lead.update, targets.update — where `details` matters), **B for everything else** (auth events, simple state flips).

Example trigger for lead stage changes:

```sql
CREATE OR REPLACE FUNCTION audit_lead_stage_change() RETURNS trigger AS $$
BEGIN
  IF NEW.stage IS DISTINCT FROM OLD.stage THEN
    INSERT INTO audit_log (id, actor_id, action, resource, resource_id, team_id, details)
    VALUES (
      gen_random_uuid()::text,
      current_user_id(),
      'lead.stage_change',
      'Sales / ' || NEW.clinic_name,
      NEW.id,
      NEW.team_id,
      'stage: ' || OLD.stage || ' → ' || NEW.stage
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER leads_audit_stage AFTER UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION audit_lead_stage_change();
```

---

## 16. Implementation order

Build in this order — each phase unblocks UI features the user can interact with end-to-end without the next phase being done.

### Phase 1 — Auth & users (1–2 days)
- `users` table + seed from [lib/mock-data.ts:173-266](../lib/mock-data.ts#L173-L266)
- `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`
- JWT signing + middleware
- Replace [lib/auth.tsx](../lib/auth.tsx) `signIn` with a fetch
- `GET /users`, `GET /teams/sales`

**You can ship**: real login, the team page reads from API.

### Phase 2 — Leads (2–3 days)
- `leads` + `lead_timeline_events` tables + RLS
- All endpoints in §5 and §6
- Seed 50 leads from [lib/sales-leads-data.ts](../lib/sales-leads-data.ts) into Postgres so the UI looks the same after switching from mock data
- Wire [leads-screen.tsx](../components/sales/leads/leads-screen.tsx), [pipeline-screen.tsx](../components/sales/pipeline/pipeline-screen.tsx), and the lead detail sheet to fetch instead of `seedLeads`

**You can ship**: a real CRM. Reps create/edit leads, drag in pipeline, mark lost.

### Phase 3 — Hospitals + field pins (1 day)
- `hospitals` + `field_pins` tables
- §8 and §9 endpoints
- Move field pins out of localStorage to the API (member screen + admin screen)

### Phase 4 — Daily metrics + targets (1–2 days)
- `daily_metrics` + `targets` tables
- Generators or ingestion path to seed `daily_metrics` (replace [lib/mock-data.ts:327-351](../lib/mock-data.ts#L327-L351))
- `GET /targets`, `PUT /targets/:userId`

### Phase 5 — Scorecard read APIs (2 days)
- `GET /scorecards/:userId` and `GET /scorecards/team`
- Implement `buildScorecard` server-side per the rules in §10
- Replace client-side `buildScorecard` calls with fetches

**You can ship**: rep + admin scorecards backed by real data, rankings tab works.

### Phase 6 — Scoring rule sets + manual points (2 days)
- `scoring_rule_sets`, `scoring_rules`, `manual_point_awards` tables
- §11 endpoints
- Wire the metric setup tab and manual points form

### Phase 7 — Audit log surface (1 day)
- `audit_log` table + triggers + `GET /audit-log`
- Wire the audit log screen for super_admin

### Phase 8 — Onboarding team (mirror)
- Repeat phases 2–6 with `team_id = 'onboarding'`. Schemas already support both via the `team_id` enum.

---

## Appendix: source file map

If you want to verify any rule against the live frontend, here's where each thing lives:

| Concept | File |
|---|---|
| Roles, permissions | [lib/types.ts](../lib/types.ts), [lib/permissions.ts](../lib/permissions.ts) |
| Sales access predicates | [lib/access.ts](../lib/access.ts) |
| Mocked auth | [lib/auth.tsx](../lib/auth.tsx) |
| Seed users / teams / metrics / targets / audit | [lib/mock-data.ts](../lib/mock-data.ts) |
| Seed leads + timeline | [lib/sales-leads-data.ts](../lib/sales-leads-data.ts) |
| Pipeline labels & summary math | [lib/sales-pipeline.ts](../lib/sales-pipeline.ts) |
| Leads list / search / inline stage change | [components/sales/leads/leads-screen.tsx](../components/sales/leads/leads-screen.tsx) |
| Edit lead modal (PUT body) | [components/sales/leads/edit-lead-modal.tsx](../components/sales/leads/edit-lead-modal.tsx) |
| Lead detail sheet (timeline writes) | [components/sales/leads/lead-detail-sheet.tsx](../components/sales/leads/lead-detail-sheet.tsx) |
| Pipeline Kanban + drag-drop + mark-lost | [components/sales/pipeline/pipeline-screen.tsx](../components/sales/pipeline/pipeline-screen.tsx), [components/sales/pipeline/mark-as-lost-modal.tsx](../components/sales/pipeline/mark-as-lost-modal.tsx) |
| Scorecard data builder & period helpers | [components/sales/scorecard/scorecard-shared.tsx](../components/sales/scorecard/scorecard-shared.tsx) |
| Sales-admin scorecard, rule editor, manual points | [components/sales/scorecard/scorecard-admin-screen.tsx](../components/sales/scorecard/scorecard-admin-screen.tsx) |
| Member scorecard | [components/sales/scorecard/scorecard-screen.tsx](../components/sales/scorecard/scorecard-screen.tsx) |
| Field pins (member, localStorage today) | [components/sales/field-location/field-location-screen.tsx](../components/sales/field-location/field-location-screen.tsx) |
| Field pins (admin team map) | [components/sales/field-location/field-location-admin-screen.tsx](../components/sales/field-location/field-location-admin-screen.tsx) |
| Hospitals grid | [components/hospitals/hospitals-screen.tsx](../components/hospitals/hospitals-screen.tsx) |
