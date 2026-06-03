/**
 * Accelerator Program (ACP) API surface.
 *
 * Wraps `GET/POST/PATCH /api/v1/sales/acp/*` (see FRONTEND_ACP_API.md). The
 * server speaks a `{ success, data }` envelope with snake_case wire shapes
 * (member_count, total_sprint_rev, latest_review, days keyed "1".."5", …); we
 * normalize each into the stable internal `Acp*` shapes the components consume.
 *
 * Every call still degrades to a self-contained mock store when the server is
 * genuinely unreachable (404 / 501 / network) — handy for local/offline demos
 * before a deploy has the routes. Flip `ACP_MOCK_FALLBACK` to false to make all
 * failures (including 404s) surface instead.
 */

import { ApiError, apiData } from "./client";

// ---------------------------------------------------------------------------
// Model (internal, component-facing)
// ---------------------------------------------------------------------------

export type AcpReview = "working_fine" | "observation" | "retrain";

export type AcpTag =
  | "active"
  | "close_monitoring"
  | "at_risk"
  | "firing_zone"
  | "fired"
  | "converted";

export type AcpActivity =
  | "training"
  | "field"
  | "observation"
  | "retrain"
  | "absent";

export interface AcpTopPerformer {
  id?: string;
  name: string;
  total_revenue: number;
}

export interface AcpOverview {
  active_members: number;
  total_members: number;
  total_sprints: number;
  sprint_revenue: number;
  subscription_revenue: number;
  conversion_rate: number;
  refund_rate: number;
  top_performer: AcpTopPerformer | null;
}

export interface AcpBatch {
  id: string;
  name: string;
  location: string;
  active_members: number;
  total_members: number;
  /** sprint + subscription revenue, summed for the card. */
  total_revenue: number;
  /** Sprint revenue only — the sprint portion of total_revenue. */
  sprint_revenue: number;
  at_risk_count: number;
  created_at?: string;
}

export interface AcpMember {
  id: string;
  name: string;
  email: string;
  phone?: string;
  joined_at: string;
  ending_at?: string;
  tag: AcpTag;
  sprint_revenue: number;
  subscription_revenue: number;
  sprint_target: number;
  revenue_target: number;
  /** Month-1 sprint progress 0–100 (sprint_rev / sprint_target). */
  month1_pct: number;
  /**
   * Total pipeline leads owned by this rep across all stages — drives the
   * "N leads" count, which goes up the moment a lead is added (independent of
   * sprint ₹, which only counts Sprint-started leads). Undefined when the
   * backend doesn't send it yet (see docs/backend-fix-acp-rep-lead-count.md);
   * the UI then falls back to showing the sprint total.
   */
  lead_count?: number;
  /** Latest admin review for the rep, or null. */
  current_review: AcpReview | null;
  /** Server-computed program position (preferred over client week calc). */
  current_week?: number;
  current_day?: number;
  current_month?: number;
  batch_id: string;
  batch_name?: string;
  status: "active" | "inactive";
  /** Private admin note about the rep (admin-only). Empty/absent when unset. */
  note?: string;
  /** ISO timestamp of the last note edit, when the server reports it. */
  note_updated_at?: string;
}

export interface AcpDailyLog {
  id: string;
  member_id?: string;
  /** YYYY-MM-DD */
  date: string;
  /** 0 when unknown — the rep panel recomputes from joined_at + date. */
  week: number;
  day_in_week: number;
  activity_type: AcpActivity;
  note: string;
  visited: string[];
  sprint_accepted: string[];
  sprint_revenue?: number;
  /** Presigned, directly playable when present. */
  audio_url?: string | null;
  audio_filename?: string | null;
  audio_duration?: string | null;
  admin_review: AcpReview | null;
}

export interface AcpBatchStats {
  active_members: number;
  total_members: number;
  total_sprints: number;
  sprint_revenue: number;
  subscription_revenue: number;
  top_performers: { id: string; name: string; total_revenue: number }[];
  fire_list: { id: string; name: string; tag: AcpTag }[];
  review_counts: Record<AcpReview, number>;
}

export interface AcpWeekDayRep {
  member_id: string;
  name: string;
  initials?: string;
  tag: AcpTag;
  review: AcpReview | null;
  sprint_revenue: number;
  has_audio: boolean;
  visited_count: number;
  sprint_accepted_count: number;
}

export interface AcpWeekDay {
  day: number;
  activity_type: AcpActivity;
  is_training_day: boolean;
  reps: AcpWeekDayRep[];
}

export interface AcpWeekView {
  week: number;
  title?: string;
  description?: string;
  days: AcpWeekDay[];
}

export interface AcpProgramWeekTitle {
  week: number;
  title: string;
  subtitle?: string;
}

export interface AcpProgramDaySchedule {
  week: number;
  day: number;
  activity_type: AcpActivity;
}

/**
 * Program-level constants served by `GET /acp/program/config` so the FE
 * doesn't need to hardcode week titles, default targets, duration, etc.
 * Falls back to the FE-local defaults when this endpoint is unavailable
 * (older backend deploys).
 */
export interface AcpProgramConfig {
  weeks: number;
  days_per_week: number;
  rest_days: string[];
  duration_months: number;
  default_sprint_target: number;
  default_revenue_target: number;
  week_titles: AcpProgramWeekTitle[];
  day_schedule: AcpProgramDaySchedule[];
}

export interface CreateBatchInput {
  name: string;
  location: string;
}

export interface AddMemberInput {
  name: string;
  email: string;
  phone: string;
  password?: string;
  sprint_target?: number;
  revenue_target?: number;
  joined_at?: string;
}

/**
 * Partial-update shape for editing an existing Accelerator member's profile
 * from the admin rep-account screen. Missing keys are left untouched on the
 * server. `joined_at` is intentionally excluded — changing the program-start
 * date out from under a rep would reshuffle every week/day label. The backend
 * must mirror `name` / `phone` / `email` updates onto the rep's `users` row,
 * dedupe `email` against existing logins, and validate format (see
 * docs/backend-acp-update-member-profile.md).
 */
export interface UpdateAcpMemberInput {
  name?: string;
  email?: string;
  phone?: string;
  sprint_target?: number;
  revenue_target?: number;
}

export interface AcpSprint {
  id: string;
  hospital_name: string;
  amount: number;
  status: "active" | "confirmed" | "converted" | "refunded";
  started_at: string;
  refund_deadline?: string;
  confirmed_at?: string | null;
  plan_name?: string | null;
  plan_value?: number | null;
  /**
   * The pipeline lead this sprint originated from, when it was created by
   * moving a lead into the "Sprint started" stage. Lets the sprint card link
   * to the lead's detail sheet. Null for manually-created sprints.
   */
  lead_id?: string | null;
  /** Basic lead details for the sprint card (present when lead-sourced). */
  doctor_name?: string | null;
  phone?: string | null;
  city?: string | null;
}

export interface AcpSprintList {
  sprints: AcpSprint[];
  sprint_rev: number;
  sub_rev: number;
}

export interface AcpMessage {
  id: string;
  member_id: string;
  sent_by: string;
  message: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Wire shapes + normalization
// ---------------------------------------------------------------------------

const REVIEW_SET = new Set<AcpReview>([
  "working_fine",
  "observation",
  "retrain",
]);
const TAG_SET = new Set<AcpTag>([
  "active",
  "close_monitoring",
  "at_risk",
  "firing_zone",
  "fired",
  "converted",
]);
const ACTIVITY_SET = new Set<AcpActivity>([
  "training",
  "field",
  "observation",
  "retrain",
  "absent",
]);

function normReview(v: unknown): AcpReview | null {
  return typeof v === "string" && REVIEW_SET.has(v as AcpReview)
    ? (v as AcpReview)
    : null;
}
function normTag(v: unknown): AcpTag {
  return typeof v === "string" && TAG_SET.has(v as AcpTag)
    ? (v as AcpTag)
    : "active";
}
/**
 * Normalize the backend's login status. The server may send "ACTIVE"/"INACTIVE"
 * (tag-sync response) or "active"/"inactive". Returns null for anything else so
 * callers can fall back to deriving status from the tag.
 */
function normStatus(v: unknown): "active" | "inactive" | null {
  if (typeof v !== "string") return null;
  const s = v.toLowerCase();
  return s === "active" || s === "inactive" ? s : null;
}
function normActivity(v: unknown): AcpActivity {
  return typeof v === "string" && ACTIVITY_SET.has(v as AcpActivity)
    ? (v as AcpActivity)
    : "field";
}
function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function basename(url: string | null | undefined): string | null {
  if (!url) return null;
  const path = url.split("?")[0] ?? url;
  const seg = path.split("/").pop();
  return seg && seg.length > 0 ? decodeURIComponent(seg) : null;
}

function normalizeOverview(raw: Record<string, unknown>): AcpOverview {
  const tp = raw.top_performer as Record<string, unknown> | null | undefined;
  return {
    active_members: num(raw.active_members),
    total_members: num(raw.total_members),
    total_sprints: num(raw.total_sprints),
    sprint_revenue: num(raw.sprint_revenue),
    subscription_revenue: num(raw.subscription_revenue),
    conversion_rate: num(raw.conversion_rate),
    refund_rate: num(raw.refund_rate),
    top_performer: tp
      ? {
          id: typeof tp.id === "string" ? tp.id : undefined,
          name: String(tp.name ?? "—"),
          total_revenue: num(tp.total_revenue),
        }
      : null,
  };
}

function normalizeBatch(raw: Record<string, unknown>): AcpBatch {
  return {
    id: String(raw.id ?? ""),
    name: String(raw.name ?? "Batch"),
    location: String(raw.location ?? ""),
    active_members: num(raw.active_count ?? raw.active_members),
    total_members: num(raw.member_count ?? raw.total_members),
    total_revenue:
      raw.total_revenue != null
        ? num(raw.total_revenue)
        : num(raw.total_sprint_rev) + num(raw.total_sub_rev),
    sprint_revenue: num(raw.total_sprint_rev ?? raw.sprint_revenue),
    at_risk_count: num(raw.at_risk_count),
    created_at:
      typeof raw.created_at === "string" ? raw.created_at : undefined,
  };
}

function normalizeMember(
  raw: Record<string, unknown>,
  batchId?: string,
): AcpMember {
  const sprintTarget = raw.sprint_target != null ? num(raw.sprint_target) : 10000;
  const sprintRev = num(raw.sprint_rev ?? raw.sprint_revenue);
  const tag = normTag(raw.tag);
  return {
    id: String(raw.id ?? ""),
    name: String(raw.name ?? "—"),
    email: String(raw.email ?? ""),
    phone: raw.phone != null ? String(raw.phone) : undefined,
    joined_at: String(raw.joined_at ?? new Date().toISOString()),
    ending_at: typeof raw.ending_at === "string" ? raw.ending_at : undefined,
    tag,
    sprint_revenue: sprintRev,
    subscription_revenue: num(raw.sub_rev ?? raw.subscription_revenue),
    sprint_target: sprintTarget,
    revenue_target: raw.revenue_target != null ? num(raw.revenue_target) : 110000,
    month1_pct:
      sprintTarget > 0
        ? Math.min(100, Math.round((sprintRev / sprintTarget) * 100))
        : 0,
    // Total leads owned by the rep — only set when the backend sends it, so the
    // UI can tell "0 leads" apart from "field not implemented yet".
    lead_count:
      raw.lead_count != null
        ? num(raw.lead_count)
        : raw.leads_count != null
          ? num(raw.leads_count)
          : raw.total_leads != null
            ? num(raw.total_leads)
            : undefined,
    current_review: normReview(raw.latest_review ?? raw.current_review),
    current_week:
      raw.current_week != null ? num(raw.current_week) : undefined,
    current_day: raw.current_day != null ? num(raw.current_day) : undefined,
    current_month:
      raw.current_month != null ? num(raw.current_month) : undefined,
    batch_id: String(raw.batch_id ?? batchId ?? ""),
    batch_name:
      typeof raw.batch_name === "string" ? raw.batch_name : undefined,
    // Prefer the server's authoritative login status; fall back to deriving it
    // from the tag for older payloads that don't include `status`.
    status: normStatus(raw.status) ?? (tag === "fired" ? "inactive" : "active"),
    note: typeof raw.note === "string" ? raw.note : undefined,
    note_updated_at:
      typeof raw.note_updated_at === "string" ? raw.note_updated_at : undefined,
  };
}

function normalizeDailyLog(raw: Record<string, unknown>): AcpDailyLog {
  const audioUrl =
    typeof raw.audio_url === "string" && raw.audio_url ? raw.audio_url : null;
  return {
    id: String(raw.id ?? ""),
    member_id: typeof raw.member_id === "string" ? raw.member_id : undefined,
    date: String(raw.date ?? "").slice(0, 10),
    week: num(raw.week_number ?? raw.week),
    day_in_week: num(raw.day_in_week ?? raw.day),
    activity_type: normActivity(raw.type ?? raw.activity_type),
    note: String(raw.note ?? ""),
    visited: Array.isArray(raw.visited) ? (raw.visited as string[]) : [],
    sprint_accepted: Array.isArray(raw.sprint_accepted)
      ? (raw.sprint_accepted as string[])
      : [],
    sprint_revenue:
      raw.sprint_rev != null
        ? num(raw.sprint_rev)
        : raw.sprint_revenue != null
          ? num(raw.sprint_revenue)
          : undefined,
    audio_url: audioUrl,
    audio_filename:
      typeof raw.audio_filename === "string"
        ? raw.audio_filename
        : basename(audioUrl),
    audio_duration:
      typeof raw.audio_duration === "string" ? raw.audio_duration : null,
    admin_review: normReview(raw.admin_review),
  };
}

function normalizeProgramConfig(raw: Record<string, unknown>): AcpProgramConfig {
  const titles = Array.isArray(raw.week_titles) ? raw.week_titles : [];
  const schedule = Array.isArray(raw.day_schedule) ? raw.day_schedule : [];
  return {
    weeks: num(raw.weeks),
    days_per_week: num(raw.days_per_week),
    rest_days: Array.isArray(raw.rest_days)
      ? (raw.rest_days as unknown[]).map((x) => String(x).toLowerCase())
      : [],
    duration_months: num(raw.duration_months),
    default_sprint_target: num(raw.default_sprint_target),
    default_revenue_target: num(raw.default_revenue_target),
    week_titles: titles
      .filter((t): t is Record<string, unknown> => !!t && typeof t === "object")
      .map((t) => ({
        week: num(t.week),
        title: String(t.title ?? ""),
        subtitle: typeof t.subtitle === "string" ? t.subtitle : undefined,
      })),
    day_schedule: schedule
      .filter((d): d is Record<string, unknown> => !!d && typeof d === "object")
      .map((d) => ({
        week: num(d.week),
        day: num(d.day),
        activity_type: normActivity(d.activity_type),
      })),
  };
}

function emptyReviewCounts(): Record<AcpReview, number> {
  return { working_fine: 0, observation: 0, retrain: 0 };
}

function normalizeReviewCounts(v: unknown): Record<AcpReview, number> {
  const counts = emptyReviewCounts();
  if (v && typeof v === "object") {
    for (const key of REVIEW_SET) {
      counts[key] = num((v as Record<string, unknown>)[key]);
    }
  }
  return counts;
}

function normalizeBatchStats(raw: Record<string, unknown>): AcpBatchStats {
  const members = (raw.members ?? {}) as Record<string, unknown>;
  const top = Array.isArray(raw.top_performers) ? raw.top_performers : [];
  const fire = Array.isArray(raw.fire_list) ? raw.fire_list : [];
  return {
    active_members: num(members.active ?? raw.active_members),
    total_members: num(members.total ?? raw.total_members),
    total_sprints: num(raw.sprints ?? raw.total_sprints),
    sprint_revenue: num(raw.sprint_revenue),
    subscription_revenue: num(raw.subscription_revenue),
    top_performers: top.map((p) => {
      const o = p as Record<string, unknown>;
      return {
        id: String(o.id ?? ""),
        name: String(o.name ?? "—"),
        total_revenue: num(o.total_revenue),
      };
    }),
    fire_list: fire.map((f) => {
      const o = f as Record<string, unknown>;
      return {
        id: String(o.id ?? ""),
        name: String(o.name ?? "—"),
        tag: normTag(o.tag),
      };
    }),
    review_counts: normalizeReviewCounts(raw.review_counts),
  };
}

function normalizeWeekRep(raw: Record<string, unknown>): AcpWeekDayRep {
  return {
    member_id: String(raw.id ?? raw.member_id ?? ""),
    name: String(raw.name ?? "—"),
    initials: typeof raw.initials === "string" ? raw.initials : undefined,
    tag: normTag(raw.tag),
    review: normReview(raw.latest_review ?? raw.review),
    sprint_revenue: num(raw.sprint_rev ?? raw.sprint_revenue),
    has_audio: Boolean(raw.has_audio),
    visited_count: num(raw.visited_count),
    sprint_accepted_count: num(raw.sprint_accepted_count),
  };
}

function normalizeWeekView(raw: Record<string, unknown>): AcpWeekView {
  // Accept both shapes:
  //   - array of `{ day, activity_type, is_training_day, reps, ... }` (current)
  //   - legacy object keyed by "1".."5" with day data as values
  // so a brief deploy skew between FE/BE never breaks the Weekly board.
  let dayEntries: Record<string, unknown>[] = [];
  const rawDays = raw.days;
  if (Array.isArray(rawDays)) {
    dayEntries = rawDays.map((d) => (d ?? {}) as Record<string, unknown>);
  } else if (rawDays && typeof rawDays === "object") {
    const obj = rawDays as Record<string, unknown>;
    dayEntries = Object.keys(obj).map((k) => ({
      day: Number(k),
      ...((obj[k] ?? {}) as Record<string, unknown>),
    }));
  }
  const days: AcpWeekDay[] = dayEntries
    .filter((d) => Number.isFinite(Number(d.day)))
    .sort((a, b) => Number(a.day) - Number(b.day))
    .map((d) => {
      const reps = Array.isArray(d.reps) ? d.reps : [];
      return {
        day: Number(d.day),
        activity_type: normActivity(d.type ?? d.activity_type),
        is_training_day: Boolean(d.is_training_day),
        reps: reps.map((r) => normalizeWeekRep(r as Record<string, unknown>)),
      };
    });
  return {
    week: num(raw.week),
    title: typeof raw.title === "string" ? raw.title : undefined,
    description:
      typeof raw.subtitle === "string"
        ? raw.subtitle
        : typeof raw.description === "string"
          ? raw.description
          : undefined,
    days,
  };
}

// ---------------------------------------------------------------------------
// Fallback plumbing
// ---------------------------------------------------------------------------

const ACP_MOCK_FALLBACK = false;
const BASE = "/api/v1/sales/acp";

/** Server genuinely doesn't have these routes (vs. a real validation error). */
function isNotLive(err: unknown): boolean {
  if (!(err instanceof ApiError)) return false;
  return err.status === 404 || err.status === 501 || err.status === 0;
}

async function withFallback<T>(
  run: () => Promise<T>,
  fallback: () => T,
): Promise<T> {
  if (!ACP_MOCK_FALLBACK) return run();
  try {
    return await run();
  } catch (err) {
    if (isNotLive(err)) return fallback();
    throw err;
  }
}

type Raw = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

export function getAcpOverview(signal?: AbortSignal): Promise<AcpOverview> {
  return withFallback(
    () =>
      apiData<Raw>(`${BASE}/overview`, { signal }).then(normalizeOverview),
    () => mock.overview(),
  );
}

export function listAcpBatches(signal?: AbortSignal): Promise<AcpBatch[]> {
  return withFallback(
    () =>
      apiData<Raw[]>(`${BASE}/batches`, { signal }).then((rows) =>
        (rows ?? []).map(normalizeBatch),
      ),
    () => mock.batches(),
  );
}

export function createAcpBatch(input: CreateBatchInput): Promise<AcpBatch> {
  return withFallback(
    () =>
      apiData<Raw>(`${BASE}/batches`, { method: "POST", body: input }).then(
        normalizeBatch,
      ),
    () => mock.createBatch(input),
  );
}

export function getAcpBatch(
  batchId: string,
  signal?: AbortSignal,
): Promise<AcpBatch> {
  return withFallback(
    () =>
      apiData<Raw>(`${BASE}/batches/${batchId}`, { signal }).then(
        normalizeBatch,
      ),
    () => mock.batch(batchId),
  );
}

export function deleteAcpBatch(batchId: string): Promise<void> {
  return withFallback(
    () =>
      apiData<void>(`${BASE}/batches/${batchId}`, { method: "DELETE" })
        .then(() => undefined)
        .catch((err) => {
          // Idempotent: a 404 means the batch is already gone (repeat click,
          // flapping network, stale tab). Treat as success so admins don't
          // see a spurious error toast. Matches the backend contract in
          // docs/backend-acp-delete-batch.md §Idempotency.
          if (err instanceof ApiError && err.status === 404) return undefined;
          throw err;
        }),
    () => undefined,
  );
}

/**
 * Remove a rep from the Accelerator program (admin-only).
 * `DELETE /acp/members/:memberId` — un-enrolls the rep: their ACP membership,
 * daily logs, sprints and coaching messages are removed, but their sales
 * `users` login and pipeline leads are kept intact (they stay a normal sales
 * rep). This is distinct from "Fire" (`setAcpMemberTag(id, "fired")`), which
 * only disables login but keeps them in the batch. A second delete of the same
 * id returns 404, which the caller treats as success (idempotent). See
 * docs/backend-acp-delete-rep-and-lead.md.
 */
export function deleteAcpMember(memberId: string): Promise<void> {
  return withFallback(
    () =>
      apiData<void>(`${BASE}/members/${memberId}`, { method: "DELETE" })
        .then(() => undefined)
        .catch((err) => {
          // Idempotent: a 404 means the member is already un-enrolled — treat
          // as success so a repeat click / network retry isn't an error.
          if (err instanceof ApiError && err.status === 404) return undefined;
          throw err;
        }),
    () => undefined,
  );
}

export function getAcpBatchStats(
  batchId: string,
  signal?: AbortSignal,
): Promise<AcpBatchStats> {
  return withFallback(
    () =>
      apiData<Raw>(`${BASE}/batches/${batchId}/stats`, { signal }).then(
        normalizeBatchStats,
      ),
    () => mock.batchStats(batchId),
  );
}

export function listAcpMembers(
  batchId: string,
  signal?: AbortSignal,
): Promise<AcpMember[]> {
  return withFallback(
    () =>
      apiData<Raw[]>(`${BASE}/batches/${batchId}/members`, { signal }).then(
        (rows) => (rows ?? []).map((r) => normalizeMember(r, batchId)),
      ),
    () => mock.members(batchId),
  );
}

export function addAcpMember(
  batchId: string,
  input: AddMemberInput,
): Promise<AcpMember> {
  return withFallback(
    () =>
      apiData<Raw>(`${BASE}/batches/${batchId}/members`, {
        method: "POST",
        body: input,
      }).then((r) => normalizeMember(r, batchId)),
    () => mock.addMember(batchId, input),
  );
}

export function getAcpWeekView(
  batchId: string,
  week: number,
  signal?: AbortSignal,
): Promise<AcpWeekView> {
  return withFallback(
    () =>
      apiData<Raw>(`${BASE}/batches/${batchId}/week-view`, {
        query: { week },
        signal,
      }).then(normalizeWeekView),
    () => mock.weekView(batchId, week),
  );
}

/**
 * Program-level constants (week titles, default targets, duration, day-type
 * schedule). Lets the FE drop the hardcoded "₹10K / ₹1.1L / 2 months" values
 * sprinkled across the add-member + create-batch modals. Admin-only.
 */
export function getAcpProgramConfig(
  signal?: AbortSignal,
): Promise<AcpProgramConfig> {
  return apiData<Raw>(`${BASE}/program/config`, { signal }).then(
    normalizeProgramConfig,
  );
}

export function getAcpMember(
  memberId: string,
  signal?: AbortSignal,
): Promise<AcpMember> {
  return withFallback(
    () =>
      apiData<Raw>(`${BASE}/members/${memberId}`, { signal }).then((r) =>
        normalizeMember(r),
      ),
    () => mock.member(memberId),
  );
}

export function getAcpMemberDailyLogs(
  memberId: string,
  signal?: AbortSignal,
): Promise<AcpDailyLog[]> {
  return withFallback(
    () =>
      apiData<Raw[]>(`${BASE}/members/${memberId}/daily-logs`, {
        signal,
      }).then((rows) => (rows ?? []).map(normalizeDailyLog)),
    () => mock.memberLogs(memberId),
  );
}

export function setAcpReview(
  logId: string,
  review: AcpReview,
): Promise<{ success: true }> {
  return withFallback(
    () =>
      apiData<Raw>(`${BASE}/daily-logs/${logId}/review`, {
        method: "PATCH",
        body: { admin_review: review },
      }).then(() => ({ success: true as const })),
    () => mock.setReview(logId, review),
  );
}

export interface AcpTagResult {
  success: true;
  tag: AcpTag;
  /** Login status the backend set as a result of the tag (only `fired` → inactive). */
  status: "active" | "inactive";
}

/**
 * Set a member's tag. The backend keeps `users.status` in sync with the tag
 * (only `fired` deactivates the login) and echoes the resulting `status`, so
 * the UI can reflect login state immediately. We fall back to deriving status
 * from the tag if an older backend omits it.
 */
export function setAcpMemberTag(
  memberId: string,
  tag: AcpTag,
): Promise<AcpTagResult> {
  return withFallback(
    () =>
      apiData<Raw>(`${BASE}/members/${memberId}/tag`, {
        method: "PATCH",
        body: { tag },
      }).then((r) => {
        const resolvedTag = normTag(r.tag ?? tag);
        return {
          success: true as const,
          tag: resolvedTag,
          status:
            normStatus(r.status) ??
            (resolvedTag === "fired" ? "inactive" : "active"),
        };
      }),
    () => mock.setTag(memberId, tag),
  );
}

/**
 * Edit a member's profile (admin-only) — `PATCH /acp/members/:memberId` with
 * any subset of `name` / `phone` / `sprint_target` / `revenue_target`. The
 * server should also sync `name`/`phone` to the underlying `users` row so the
 * Teams / Performance / target-board views stay consistent. See
 * docs/backend-acp-update-member-profile.md for the contract.
 */
export function updateAcpMember(
  memberId: string,
  input: UpdateAcpMemberInput,
): Promise<AcpMember> {
  return withFallback(
    () =>
      apiData<Raw>(`${BASE}/members/${memberId}`, {
        method: "PATCH",
        body: input,
      }).then((r) => normalizeMember(r)),
    () => mock.updateMember(memberId, input),
  );
}

export interface AcpNoteResult {
  note: string;
  note_updated_at?: string;
}

/**
 * Save (or clear, with `""`) the private admin note on a member.
 * `PATCH /acp/members/:memberId/note` — admin-only. Returns the persisted
 * value + edit timestamp so the UI can confirm and show "last saved".
 */
export function setAcpMemberNote(
  memberId: string,
  note: string,
): Promise<AcpNoteResult> {
  return withFallback(
    () =>
      apiData<Raw>(`${BASE}/members/${memberId}/note`, {
        method: "PATCH",
        body: { note },
      }).then((r) => ({
        note: typeof r.note === "string" ? r.note : note,
        note_updated_at:
          typeof r.note_updated_at === "string" ? r.note_updated_at : undefined,
      })),
    () => mock.setNote(memberId, note),
  );
}

/**
 * Admin-set a new password for a rep's login — no current password required
 * (the admin is resetting it on the rep's behalf). `PATCH
 * /acp/members/:memberId/password`, admin-only. The backend resolves the
 * `acp_member` → its `users` row and stores the new hash; the response never
 * echoes the password back. See docs/backend-fix-acp-member-password.md.
 */
export function setAcpMemberPassword(
  memberId: string,
  password: string,
): Promise<{ success: true }> {
  return withFallback(
    () =>
      apiData<Raw>(`${BASE}/members/${memberId}/password`, {
        method: "PATCH",
        body: { new_password: password },
      }).then(() => ({ success: true as const })),
    () => mock.setPassword(),
  );
}

export function sendAcpMessage(
  memberId: string,
  message: string,
): Promise<{ success: true }> {
  return withFallback(
    () =>
      apiData<Raw>(`${BASE}/members/${memberId}/messages`, {
        method: "POST",
        body: { message },
      }).then(() => ({ success: true as const })),
    () => mock.message(),
  );
}

const SPRINT_STATUS_SET = new Set<AcpSprint["status"]>([
  "active",
  "confirmed",
  "converted",
  "refunded",
]);

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

function normalizeSprint(raw: Raw): AcpSprint {
  // The backend may inline lead fields or nest them under `lead: { … }`.
  const lead = (raw.lead ?? null) as Raw | null;
  const leadId =
    str(raw.source_lead_id) ??
    str(raw.lead_id) ??
    (lead ? str(lead.id) : undefined) ??
    null;
  const statusRaw = String(raw.status ?? "active");
  const status = SPRINT_STATUS_SET.has(statusRaw as AcpSprint["status"])
    ? (statusRaw as AcpSprint["status"])
    : "active";
  return {
    id: String(raw.id ?? ""),
    hospital_name: String(
      raw.hospital_name ?? raw.clinic_name ?? lead?.clinic_name ?? "—",
    ),
    amount: num(raw.amount ?? raw.estimated_value),
    status,
    started_at: String(raw.started_at ?? raw.sprint_started_at ?? ""),
    refund_deadline: str(raw.refund_deadline),
    confirmed_at: str(raw.confirmed_at) ?? null,
    plan_name: str(raw.plan_name) ?? null,
    plan_value: raw.plan_value != null ? num(raw.plan_value) : null,
    lead_id: leadId,
    doctor_name: str(raw.doctor_name) ?? (lead ? str(lead.doctor_name) : undefined) ?? null,
    phone: str(raw.phone) ?? (lead ? str(lead.phone) : undefined) ?? null,
    city: str(raw.city) ?? (lead ? str(lead.city) : undefined) ?? null,
  };
}

function normalizeSprintList(raw: Raw): AcpSprintList {
  const sprints = Array.isArray(raw.sprints) ? raw.sprints : [];
  return {
    sprints: sprints.map((s) => normalizeSprint(s as Raw)),
    sprint_rev: num(raw.sprint_rev),
    sub_rev: num(raw.sub_rev),
  };
}

export function getAcpMemberSprints(
  memberId: string,
  signal?: AbortSignal,
): Promise<AcpSprintList> {
  return withFallback(
    () =>
      apiData<Raw>(`${BASE}/members/${memberId}/sprints`, { signal }).then(
        normalizeSprintList,
      ),
    () => mock.sprints(memberId),
  );
}

function normalizeMessage(r: Raw): AcpMessage {
  return {
    id: String(r.id ?? ""),
    member_id: String(r.member_id ?? ""),
    sent_by: String(r.sent_by ?? ""),
    message: String(r.message ?? ""),
    created_at: String(r.created_at ?? ""),
  };
}

/**
 * A specific member's thread, newest first — the admin read route
 * (`GET /acp/members/:memberId/messages`), keyed by the `acp_members` UUID.
 * Reps can't use this: they don't know their `acp_member` id and the route is
 * admin-only (it 403s for them). A rep reads their own inbox via
 * `getMyAcpMessages` instead.
 */
export function getAcpMemberMessages(
  memberId: string,
  signal?: AbortSignal,
): Promise<AcpMessage[]> {
  return withFallback(
    () =>
      apiData<Raw[]>(`${BASE}/members/${memberId}/messages`, { signal }).then(
        (rows) => (rows ?? []).map(normalizeMessage),
      ),
    () => mock.messages(),
  );
}

/**
 * The logged-in rep's own Accelerator coaching inbox, newest first
 * (`GET /acp/me/messages`). The backend resolves the rep → `acp_member` from the
 * JWT, so no id is needed — this replaces the old `/members/:id/messages` call,
 * which 403'd because a rep can't know their `acp_member` id. A 404 means the
 * caller isn't enrolled in the Accelerator program; the inbox should be hidden
 * in that case, so we let the error surface (no `withFallback`) rather than
 * masking a real "not a member" 404 as an empty thread.
 */
export function getMyAcpMessages(signal?: AbortSignal): Promise<AcpMessage[]> {
  return apiData<Raw[]>(`${BASE}/me/messages`, { signal }).then((rows) =>
    (rows ?? []).map(normalizeMessage),
  );
}

/**
 * The logged-in rep's own Accelerator daily logs (`GET /acp/me/daily-logs`),
 * newest first. The backend resolves the rep → `acp_member` from the JWT, so no
 * id is needed — a rep can't use the admin `/members/:id/daily-logs` route. Like
 * `getMyAcpMessages`, a 404 means "not enrolled in the Accelerator": we let it
 * surface (no `withFallback`) so the rep's pitch-upload control hides instead of
 * masking a real 404 as an empty list.
 */
export function getMyAcpDailyLogs(signal?: AbortSignal): Promise<AcpDailyLog[]> {
  return apiData<Raw[]>(`${BASE}/me/daily-logs`, { signal }).then((rows) =>
    (rows ?? []).map(normalizeDailyLog),
  );
}

/**
 * Upload a pre-recorded pitch recording to one of the rep's own daily logs
 * (`POST /acp/me/daily-logs/audio`, multipart/form-data). Fields: `date`
 * (YYYY-MM-DD — which day's log to attach to) and `audio` (the file). The rep is
 * resolved from the JWT; the backend attaches the recording to that date's log,
 * creating the log if none exists, and returns the updated log with a presigned,
 * directly-playable `audio_url` so the daily work log shows it immediately. No
 * mock fallback — a real upload must reach the server.
 */
export function uploadMyAcpDayAudio(
  date: string,
  file: File,
): Promise<AcpDailyLog> {
  const form = new FormData();
  form.append("date", date);
  form.append("audio", file);
  return apiData<Raw>(`${BASE}/me/daily-logs/audio`, {
    method: "POST",
    body: form,
  }).then(normalizeDailyLog);
}

// ---------------------------------------------------------------------------
// Mock store — emits internal shapes directly (no normalization needed).
// Built once at module load, relative to "now". Replaced wholesale once the
// backend is live everywhere.
// ---------------------------------------------------------------------------

const HOSPITALS = [
  "Apollo Clinic",
  "Care Hospital",
  "City Clinic",
  "Max Lab",
  "Sunshine",
  "Global Hospital",
  "Medicover",
];

interface MemberSeed {
  id: string;
  name: string;
  email: string;
  phone: string;
  joinedDaysAgo: number;
  tag: AcpTag;
  sprint: number;
  sub: number;
  note: string;
  review: AcpReview;
}

interface BatchSeed {
  id: string;
  name: string;
  location: string;
  members: MemberSeed[];
}

const BATCH_SEEDS: BatchSeed[] = [
  {
    id: "acp-hyd",
    name: "Hyderabad Batch",
    location: "Hyderabad",
    members: [
      {
        id: "acp-arjun",
        name: "Arjun Kapoor",
        email: "arjun@nyra.ai",
        phone: "+91 90000 00001",
        joinedDaysAgo: 13,
        tag: "active",
        sprint: 10000,
        sub: 60000,
        note: "Top performer.",
        review: "working_fine",
      },
      {
        id: "acp-priya",
        name: "Priya Menon",
        email: "priya@nyra.ai",
        phone: "+91 90000 00002",
        joinedDaysAgo: 12,
        tag: "active",
        sprint: 7500,
        sub: 34500,
        note: "Reviewed recordings. Passed.",
        review: "working_fine",
      },
      {
        id: "acp-swathi",
        name: "Swathi Iyer",
        email: "swathi@nyra.ai",
        phone: "+91 90000 00003",
        joinedDaysAgo: 10,
        tag: "close_monitoring",
        sprint: 5000,
        sub: 0,
        note: "Under observation.",
        review: "observation",
      },
      {
        id: "acp-neha",
        name: "Neha Reddy",
        email: "neha@nyra.ai",
        phone: "+91 90000 00004",
        joinedDaysAgo: 11,
        tag: "close_monitoring",
        sprint: 0,
        sub: 0,
        note: "Close monitoring set.",
        review: "retrain",
      },
      {
        id: "acp-vikram",
        name: "Vikram Das",
        email: "vikram@nyra.ai",
        phone: "+91 90000 00005",
        joinedDaysAgo: 18,
        tag: "fired",
        sprint: 0,
        sub: 0,
        note: "Removed from program.",
        review: "retrain",
      },
    ],
  },
  {
    id: "acp-blr",
    name: "Bangalore Batch",
    location: "Bangalore",
    members: [
      {
        id: "acp-ravi",
        name: "Ravi Kumar",
        email: "ravi@nyra.ai",
        phone: "+91 90000 00010",
        joinedDaysAgo: 16,
        tag: "active",
        sprint: 7500,
        sub: 66000,
        note: "Top performer.",
        review: "working_fine",
      },
      {
        id: "acp-meera",
        name: "Meera Nair",
        email: "meera@nyra.ai",
        phone: "+91 90000 00011",
        joinedDaysAgo: 9,
        tag: "active",
        sprint: 0,
        sub: 0,
        note: "Ramping up.",
        review: "observation",
      },
    ],
  },
];

const DAY_MS = 24 * 60 * 60 * 1000;

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function activityFor(week: number, dayInWeek: number): AcpActivity {
  if (week === 1 && dayInWeek <= 2) return "training";
  if (dayInWeek === 5 && week <= 2) return "observation";
  return "field";
}

function firstName(name: string): string {
  return name.split(/\s+/)[0]?.toLowerCase() ?? "rep";
}

interface MockMemberRecord {
  member: AcpMember;
  logs: AcpDailyLog[];
}

interface MockStore {
  batches: AcpBatch[];
  membersByBatch: Map<string, AcpMember[]>;
  records: Map<string, MockMemberRecord>;
  overview: AcpOverview;
}

function buildLogs(seed: MemberSeed): AcpDailyLog[] {
  const logs: AcpDailyLog[] = [];
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const isPerformer = seed.sprint > 0 || seed.sub > 0;

  for (let d = seed.joinedDaysAgo; d >= 0; d--) {
    const dayIndex = seed.joinedDaysAgo - d;
    const week = Math.min(8, Math.floor(dayIndex / 7) + 1);
    const dayInWeek = (dayIndex % 7) + 1;
    if (dayInWeek > 5) continue;

    const date = new Date(todayStart.getTime() - d * DAY_MS);
    const activity = activityFor(week, dayInWeek);
    const fn = firstName(seed.name);

    if (activity === "training") {
      logs.push({
        id: `${seed.id}-w${week}d${dayInWeek}`,
        member_id: seed.id,
        date: ymd(date),
        week,
        day_in_week: dayInWeek,
        activity_type: "training",
        note:
          dayInWeek === 1
            ? "Onboarding + product training"
            : "Sales pitch workshop",
        visited: [],
        sprint_accepted: [],
        audio_url: null,
        audio_filename: null,
        audio_duration: null,
        admin_review: null,
      });
      continue;
    }

    const h0 = HOSPITALS[(dayIndex * 2) % HOSPITALS.length] ?? "Apollo Clinic";
    const h1 =
      HOSPITALS[(dayIndex * 2 + 1) % HOSPITALS.length] ?? "Care Hospital";
    const visited = activity === "observation" ? [] : [h0, h1];
    const accepts =
      isPerformer && activity === "field" && dayIndex % 2 === 1 ? [h0] : [];
    const note =
      activity === "observation"
        ? "Reviewed recordings. Passed."
        : accepts.length > 0
          ? `${h0} accepted sprint.`
          : dayIndex <= 2
            ? `First field day. Pitched ${h0}.`
            : `${h0} follow-up.`;
    const hasAudio = activity === "field";

    logs.push({
      id: `${seed.id}-w${week}d${dayInWeek}`,
      member_id: seed.id,
      date: ymd(date),
      week,
      day_in_week: dayInWeek,
      activity_type: activity,
      note,
      visited,
      sprint_accepted: accepts,
      sprint_revenue: accepts.length > 0 ? Math.round(seed.sprint / 2) : undefined,
      audio_url: null,
      audio_filename: hasAudio ? `${fn}_w${week}d${dayInWeek}.mp3` : null,
      audio_duration: hasAudio ? "3:00" : null,
      admin_review: "working_fine",
    });
  }

  const latest = [...logs]
    .reverse()
    .find((l) => l.activity_type !== "training");
  if (latest) latest.admin_review = seed.review;

  return logs;
}

function buildStore(): MockStore {
  const batches: AcpBatch[] = [];
  const membersByBatch = new Map<string, AcpMember[]>();
  const records = new Map<string, MockMemberRecord>();
  const todayStart = new Date();
  todayStart.setHours(9, 0, 0, 0);

  let ovActive = 0;
  let ovTotal = 0;
  let ovSprintRev = 0;
  let ovSubRev = 0;
  let ovSprints = 0;
  let topPerformer: AcpTopPerformer | null = null;

  for (const bs of BATCH_SEEDS) {
    const members: AcpMember[] = [];
    let activeCount = 0;
    let batchRevenue = 0;
    let batchSprintRev = 0;
    let atRisk = 0;

    for (const seed of bs.members) {
      const joined = new Date(
        todayStart.getTime() - seed.joinedDaysAgo * DAY_MS,
      );
      const ending = new Date(joined.getTime());
      ending.setMonth(ending.getMonth() + 2);
      const logs = buildLogs(seed);
      const total = seed.sprint + seed.sub;
      const isActive = seed.tag !== "fired";
      const latestReviewed = [...logs]
        .reverse()
        .find((l) => l.admin_review !== null);
      const elapsed = Math.floor(
        (Date.now() - joined.getTime()) / DAY_MS,
      );
      const week = Math.min(8, Math.floor(elapsed / 7) + 1);

      const member: AcpMember = {
        id: seed.id,
        name: seed.name,
        email: seed.email,
        phone: seed.phone,
        joined_at: joined.toISOString(),
        ending_at: ending.toISOString(),
        tag: seed.tag,
        sprint_revenue: seed.sprint,
        subscription_revenue: seed.sub,
        sprint_target: 10000,
        revenue_target: 110000,
        month1_pct: Math.min(100, Math.round((seed.sprint / 10000) * 100)),
        current_review: latestReviewed?.admin_review ?? null,
        current_week: week,
        current_day: Math.min(5, (elapsed % 7) + 1),
        current_month: week <= 4 ? 1 : 2,
        batch_id: bs.id,
        batch_name: bs.name,
        status: isActive ? "active" : "inactive",
        note: seed.note,
      };

      members.push(member);
      records.set(seed.id, { member, logs });

      if (isActive) {
        activeCount += 1;
        batchRevenue += total;
        batchSprintRev += seed.sprint;
        ovSprintRev += seed.sprint;
        ovSubRev += seed.sub;
      }
      if (
        seed.tag === "at_risk" ||
        seed.tag === "firing_zone" ||
        seed.tag === "close_monitoring"
      ) {
        atRisk += 1;
      }
      ovSprints += logs.reduce((n, l) => n + l.sprint_accepted.length, 0);

      if (isActive && (!topPerformer || total > topPerformer.total_revenue)) {
        topPerformer = { id: seed.id, name: seed.name, total_revenue: total };
      }
    }

    membersByBatch.set(bs.id, members);
    batches.push({
      id: bs.id,
      name: bs.name,
      location: bs.location,
      active_members: activeCount,
      total_members: bs.members.length,
      total_revenue: batchRevenue,
      sprint_revenue: batchSprintRev,
      at_risk_count: atRisk,
    });

    ovActive += activeCount;
    ovTotal += bs.members.length;
  }

  const overview: AcpOverview = {
    active_members: ovActive,
    total_members: ovTotal,
    total_sprints: ovSprints,
    sprint_revenue: ovSprintRev,
    subscription_revenue: ovSubRev,
    conversion_rate: 34,
    refund_rate: 6,
    top_performer: topPerformer,
  };

  return { batches, membersByBatch, records, overview };
}

const store = buildStore();

const REVIEW_KEYS: AcpReview[] = ["working_fine", "observation", "retrain"];

const mock = {
  overview(): AcpOverview {
    return { ...store.overview };
  },

  batches(): AcpBatch[] {
    return store.batches.map((b) => ({ ...b }));
  },

  batch(batchId: string): AcpBatch {
    const b = store.batches.find((x) => x.id === batchId);
    if (b) return { ...b };
    return {
      id: batchId,
      name: "New Batch",
      location: "—",
      active_members: 0,
      total_members: 0,
      total_revenue: 0,
      sprint_revenue: 0,
      at_risk_count: 0,
    };
  },

  members(batchId: string): AcpMember[] {
    return (store.membersByBatch.get(batchId) ?? []).map((m) => ({ ...m }));
  },

  member(memberId: string): AcpMember {
    const rec = store.records.get(memberId);
    if (!rec) throw new ApiError(404, "Member not found", null);
    return { ...rec.member };
  },

  memberLogs(memberId: string): AcpDailyLog[] {
    const rec = store.records.get(memberId);
    if (!rec) return [];
    return rec.logs.map((l) => ({ ...l })).reverse();
  },

  sprints(memberId: string): AcpSprintList {
    const rec = store.records.get(memberId);
    const sprints: AcpSprint[] = [];
    if (rec) {
      for (const log of rec.logs) {
        for (const h of log.sprint_accepted) {
          const started = new Date(log.date + "T00:00:00Z");
          const deadline = new Date(started.getTime() + 14 * DAY_MS);
          sprints.push({
            id: `${log.id}-${h}`,
            hospital_name: h,
            amount: 2500,
            status: Date.now() > deadline.getTime() ? "confirmed" : "active",
            started_at: log.date,
            refund_deadline: ymd(deadline),
            confirmed_at:
              Date.now() > deadline.getTime() ? deadline.toISOString() : null,
            plan_name: null,
            plan_value: null,
          });
        }
      }
    }
    return {
      sprints,
      sprint_rev: rec?.member.sprint_revenue ?? 0,
      sub_rev: rec?.member.subscription_revenue ?? 0,
    };
  },

  batchStats(batchId: string): AcpBatchStats {
    const members = store.membersByBatch.get(batchId) ?? [];
    const batch = store.batches.find((b) => b.id === batchId);
    const active = members.filter((m) => m.status === "active");

    let sprintRev = 0;
    let subRev = 0;
    let sprints = 0;
    const counts = emptyReviewCounts();
    for (const m of active) {
      sprintRev += m.sprint_revenue;
      subRev += m.subscription_revenue;
      const rec = store.records.get(m.id);
      if (rec) {
        sprints += rec.logs.reduce((n, l) => n + l.sprint_accepted.length, 0);
      }
      if (m.current_review) counts[m.current_review] += 1;
    }

    return {
      active_members: batch?.active_members ?? active.length,
      total_members: batch?.total_members ?? members.length,
      total_sprints: sprints,
      sprint_revenue: sprintRev,
      subscription_revenue: subRev,
      top_performers: [...active]
        .map((m) => ({
          id: m.id,
          name: m.name,
          total_revenue: m.sprint_revenue + m.subscription_revenue,
        }))
        .sort((a, b) => b.total_revenue - a.total_revenue),
      fire_list: members
        .filter(
          (m) =>
            m.tag === "fired" ||
            m.tag === "firing_zone" ||
            m.tag === "close_monitoring" ||
            m.tag === "at_risk",
        )
        .map((m) => ({ id: m.id, name: m.name, tag: m.tag })),
      review_counts: counts,
    };
  },

  weekView(batchId: string, week: number): AcpWeekView {
    const members = store.membersByBatch.get(batchId) ?? [];
    const days: AcpWeekDay[] = [];

    for (let day = 1; day <= 5; day++) {
      const activity = activityFor(week, day);
      const reps: AcpWeekDayRep[] = [];

      for (const m of members) {
        if (m.status !== "active") continue;
        const rec = store.records.get(m.id);
        const log = rec?.logs.find(
          (l) => l.week === week && l.day_in_week === day,
        );
        if (!log) continue;
        reps.push({
          member_id: m.id,
          name: m.name,
          tag: m.tag,
          review: log.admin_review ?? m.current_review,
          sprint_revenue: m.sprint_revenue,
          has_audio: Boolean(log.audio_filename),
          visited_count: log.visited.length,
          sprint_accepted_count: log.sprint_accepted.length,
        });
      }

      days.push({
        day,
        activity_type: activity,
        is_training_day: activity === "training",
        reps,
      });
    }

    return { week, days };
  },

  createBatch(input: CreateBatchInput): AcpBatch {
    const batch: AcpBatch = {
      id: `acp-${Date.now()}`,
      name: input.name,
      location: input.location,
      active_members: 0,
      total_members: 0,
      total_revenue: 0,
      sprint_revenue: 0,
      at_risk_count: 0,
    };
    store.batches.push(batch);
    store.membersByBatch.set(batch.id, []);
    return { ...batch };
  },

  addMember(batchId: string, input: AddMemberInput): AcpMember {
    const now = new Date();
    const ending = new Date(now.getTime());
    ending.setMonth(ending.getMonth() + 2);
    const member: AcpMember = {
      id: `acp-m-${Date.now()}`,
      name: input.name,
      email: input.email,
      phone: input.phone,
      joined_at: input.joined_at ?? now.toISOString(),
      ending_at: ending.toISOString(),
      tag: "active",
      sprint_revenue: 0,
      subscription_revenue: 0,
      sprint_target: input.sprint_target ?? 10000,
      revenue_target: input.revenue_target ?? 110000,
      month1_pct: 0,
      current_review: null,
      current_week: 1,
      current_day: 1,
      current_month: 1,
      batch_id: batchId,
      status: "active",
      note: "Just added.",
    };
    const list = store.membersByBatch.get(batchId) ?? [];
    list.push(member);
    store.membersByBatch.set(batchId, list);
    store.records.set(member.id, { member, logs: [] });
    return { ...member };
  },

  setReview(logId: string, review: AcpReview): { success: true } {
    for (const rec of store.records.values()) {
      const log = rec.logs.find((l) => l.id === logId);
      if (log) {
        log.admin_review = review;
        rec.member.current_review = review;
        break;
      }
    }
    return { success: true };
  },

  setTag(memberId: string, tag: AcpTag): AcpTagResult {
    const status: "active" | "inactive" =
      tag === "fired" ? "inactive" : "active";
    const rec = store.records.get(memberId);
    if (rec) {
      rec.member.tag = tag;
      rec.member.status = status;
    }
    return { success: true, tag, status };
  },

  setNote(memberId: string, note: string): AcpNoteResult {
    const now = new Date().toISOString();
    const rec = store.records.get(memberId);
    if (rec) {
      rec.member.note = note;
      rec.member.note_updated_at = now;
    }
    return { note, note_updated_at: now };
  },

  updateMember(memberId: string, input: UpdateAcpMemberInput): AcpMember {
    const rec = store.records.get(memberId);
    if (!rec) throw new ApiError(404, "Member not found", null);
    if (input.name !== undefined) rec.member.name = input.name;
    if (input.email !== undefined) rec.member.email = input.email;
    if (input.phone !== undefined) rec.member.phone = input.phone;
    if (input.sprint_target !== undefined) {
      rec.member.sprint_target = input.sprint_target;
      rec.member.month1_pct =
        input.sprint_target > 0
          ? Math.min(
              100,
              Math.round((rec.member.sprint_revenue / input.sprint_target) * 100),
            )
          : 0;
    }
    if (input.revenue_target !== undefined) {
      rec.member.revenue_target = input.revenue_target;
    }
    return { ...rec.member };
  },

  message(): { success: true } {
    return { success: true };
  },

  // No mock user store — admin password resets are a no-op offline.
  setPassword(): { success: true } {
    return { success: true };
  },

  // The mock store doesn't track admin messages; an empty inbox is the
  // honest offline fallback (vs. inventing fake coaching messages).
  messages(): AcpMessage[] {
    return [];
  },
};

export { REVIEW_KEYS };
