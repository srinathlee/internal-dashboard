# Backend — Accelerator rep pitch-audio (upload → daily log → admin review)

**Goal:** an Accelerator **rep** uploads a pre-recorded pitch audio file; it
attaches to **that day's daily log**; the **admin** then sees a play bar on that
day's card in the rep's daily work log, listens, and leaves a review.

**Frontend status:** Built and wired, waiting on the routes below.
- Rep upload UI: header `Mic` → "Upload pitch recording" dialog (member-only).
- Admin playback: already renders an audio player on any daily-log day that has
  `audio_url` (no admin-side work needed beyond returning the field).

Base URL: `/api/v1/sales` · Auth: `Authorization: Bearer <token>` (HttpOnly cookie)

---

## Confirmed bug — the upload route is not registered

Uploading from the rep dialog fires:

```
POST http://localhost:4000/api/v1/sales/acp/me/daily-logs/audio
→ 404 Not Found        (Content-Length 117 — a small JSON "not found" body)
```

A 404 with a tiny JSON body on a `POST` to a path whose siblings exist means the
**route isn't registered**. This doc specifies it (plus the rep's read route and
the admin read field) so the full flow works end to end.

---

## Routes at a glance

| # | Method · Path | Who | Status |
|---|---|---|---|
| 1 | `POST /acp/me/daily-logs/audio` | Rep (member) | **NEW — currently 404** |
| 2 | `GET  /acp/me/daily-logs` | Rep (member) | **NEW** |
| 3 | `GET  /acp/members/:memberId/daily-logs` | Admin | exists — **just include the audio fields** |

The rep is **always resolved from the JWT** (`req.user → acp_member`). A rep
never passes a member id and must never be able to write another rep's log.

---

## 1. `POST /api/v1/sales/acp/me/daily-logs/audio`  *(NEW — fixes the 404)*

Upload / replace the pitch recording on one of the rep's own daily logs.

- **Auth:** logged-in sales `member`; resolve `acp_member` from the JWT.
- **Content-Type:** `multipart/form-data`.
- **Fields the frontend sends:**

| Field | Type | Notes |
|---|---|---|
| `date` | text | `YYYY-MM-DD` (e.g. `2026-05-25`). The day to attach to. Not in the future. |
| `audio` | file | The recording. `audio/mpeg`, `audio/mp4`/`m4a`, `audio/wav`, `audio/aac`, `audio/ogg`, `audio/webm`, … |

### Behaviour

1. Find the rep's daily log for `date`. **If none exists, create one** for that
   date (minimal row), so a rep can upload even before a structured log exists.
2. Store the file (see **Storage**) and set `audio_url` / `audio_filename` /
   `audio_duration` on that log.
3. **Replace on re-upload:** if the day already had a recording, overwrite it and
   delete the old object — one recording per day, idempotent.
4. Return the **updated daily log** (same shape as route 2 rows) with a fresh
   presigned `audio_url`.

```jsonc
// 200
{
  "success": true,
  "data": {
    "id": "uuid",
    "date": "2026-05-25",
    "week": 1,
    "day_in_week": 4,
    "activity_type": "field",
    "audio_url": "https://…signed…",   // presigned GET, directly playable
    "audio_filename": "Ram Siya Ram.mp3",
    "audio_duration": "3:00",          // "m:ss", optional
    "...": "rest of the daily-log fields"
  }
}
```

### Validation & errors

| Condition | Status | Body |
|---|---|---|
| Success | `200` (or `201`) | updated log (above) |
| Not enrolled in Accelerator | `404` | `{ "error": "Not an Accelerator member." }` |
| Missing/blank `date`, or future date | `400` | `{ "error": { "code": "BAD_DATE", "message": "…" } }` |
| No `audio` file part | `400` | `{ "error": "No audio file provided." }` |
| Not an audio MIME type | `415` | `{ "error": { "code": "BAD_AUDIO_TYPE", "message": "…" } }` |
| File too large | `413` | `{ "error": { "code": "AUDIO_TOO_LARGE", "message": "Max 25 MB." } }` |
| Storage / server error | `500` | `{ "error": "Upload failed." }` |

> **Size cap:** the frontend rejects files over **25 MB** before sending — please
> enforce the same server-side (multipart body limit + explicit check).

---

## 2. `GET /api/v1/sales/acp/me/daily-logs`  *(NEW)*

The rep's own daily logs, newest first. The upload dialog uses it to mark which
days already have a recording ("uploading replaces it"). It's a best-effort
enhancement — the upload in route 1 must work even before this ships.

- **Auth:** logged-in sales `member`; resolve `acp_member` from the JWT.
- **Not enrolled:** `404` (same convention as `GET /acp/me/messages`).
- **Enrolled, no logs:** `200` with `[]` (empty array, **not** 404).

```jsonc
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "date": "2026-05-25",
      "week": 1,
      "day_in_week": 4,
      "activity_type": "field",        // training | field | observation | retrain | absent
      "note": "Started sprint at lead-by-john.",
      "visited": ["lead-by-john"],
      "sprint_accepted": ["lead-by-john"],
      "sprint_revenue": 2500,
      "audio_url": "https://…signed…", // null when no recording
      "audio_filename": "Ram Siya Ram.mp3",
      "audio_duration": "3:00"
    }
  ]
}
```

---

## 3. Admin read + review — mostly already exists

### 3a. Show the recording — `GET /acp/members/:memberId/daily-logs`

This admin route already powers the daily work log. **No new route** — just make
sure each daily-log object carries the three audio fields when a recording is
present:

- `audio_url` — **presigned, directly playable** (the admin `<audio>` hits it
  straight). Short-lived is fine; the page re-fetches logs on load/focus.
- `audio_filename` — original filename, shown as the track label.
- `audio_duration` — optional `"m:ss"`; `null`/omitted is fine (UI derives it).

The admin's daily-log day card **already renders** a play/pause bar the moment
`audio_url` is set — so once route 1 stores it, the admin sees it on that day
(e.g. john → Day 4) with zero further admin-UI work.

### 3b. Review the rep — already wired

The "Admin review" dropdown on each day's card already posts to the existing
review route (e.g. `PATCH /acp/daily-logs/:logId/review` with
`{ admin_review: "working_fine" | "observation" | "retrain" }`). No change — the
admin listens via 3a, then sets the review here as today.

---

## Storage notes

- Store per `(acp_member_id, date)` so a re-upload overwrites cleanly, e.g.
  `acp/pitch/<member_id>/<date>.<ext>`.
- Keep objects **private**; return **presigned GET URLs** in responses (never a
  public bucket URL). Matches the existing "presigned, directly playable"
  contract for `audio_url`.
- Transcoding optional — browsers play the common types directly.

---

## The full round-trip (what "done" looks like)

1. Rep opens the header **Upload pitch** dialog → picks **Day** (default today) →
   selects an **audio file** → **Upload**.
2. `POST /acp/me/daily-logs/audio` stores it on that day's log and returns the
   log with a presigned `audio_url`.
3. Admin opens the rep's profile → **Daily work log** → that day now shows a
   **play bar** (filename + duration). Admin plays it.
4. Admin sets the **Admin review** for that day. Done.

---

## Acceptance criteria

- [ ] `POST /acp/me/daily-logs/audio` (multipart `date` + `audio`) **no longer
      404s** — it attaches the file to that day's log (creating the log if
      missing) and returns it with a working presigned `audio_url`.
- [ ] Re-uploading for the same `date` **replaces** the previous recording.
- [ ] A rep **cannot** upload against another rep's log (JWT-resolved only).
- [ ] Oversized (>25 MB) / non-audio uploads rejected with `413` / `415`.
- [ ] `GET /acp/me/daily-logs` returns the rep's logs (`200 []` when none), `404`
      when not enrolled.
- [ ] `GET /acp/members/:memberId/daily-logs` returns `audio_url` for the day,
      and it **plays in the admin's daily work log**; the admin can then set the
      day's review.

---

## Optional follow-up

`DELETE /acp/me/daily-logs/:date/audio` — let a rep remove a recording uploaded
by mistake (clear the three fields + delete the object). Not needed for v1; the
UI currently only uploads/replaces.

## Alternative: presigned-PUT upload

The frontend does a **single multipart POST** today (simplest). If you'd rather
the client upload straight to object storage, expose a
`POST /acp/me/daily-logs/audio/presign` (returns a presigned PUT URL + object
key) plus a `…/confirm` step — that needs a small frontend change, so tell us and
we'll switch. Otherwise the multipart POST in §1 is the contract.
