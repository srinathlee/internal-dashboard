/**
 * Adapters between the Sales API wire format and the legacy local types
 * the existing UI was built around. Keeping the adapter layer thin lets
 * us swap data sources without touching every screen.
 */

import type {
  ApiLead,
  ApiLeadDetail,
  ApiLeadStage,
  ApiLeadTimelineEntry,
  ApiLostReason,
} from "./types";
import type {
  Lead,
  LeadLostReason,
  LeadSource,
  LeadStage,
  LeadTimelineEvent,
} from "@/lib/types";

// ---------- Stage mapping ----------
//
// Default stages have hand-coded kebab-case local values; custom stages
// don't, so they pass through unchanged on both sides. Looking up an
// unknown key in the maps below returns undefined, and we fall back to
// returning the input verbatim.

const API_TO_LOCAL_STAGE: Record<string, LeadStage> = {
  NEW_LEADS: "cold-lead",
  FIRST_CONTACT: "first-contact",
  DOCTOR_MEETING: "doctor-meeting",
  PITCH_DELIVERED: "pitch-delivered",
  HOT_LEADS: "hot-lead",
  SPRINT_STARTED: "sprint-started",
  SPRINT_REVIEW: "sprint-review",
  SUBSCRIPTION_CLOSED: "subscription-closed",
  LOST: "lost",
};

const LOCAL_TO_API_STAGE: Record<string, ApiLeadStage> = {
  "cold-lead": "NEW_LEADS",
  "first-contact": "FIRST_CONTACT",
  "doctor-meeting": "DOCTOR_MEETING",
  "pitch-delivered": "PITCH_DELIVERED",
  "hot-lead": "HOT_LEADS",
  "sprint-started": "SPRINT_STARTED",
  "sprint-review": "SPRINT_REVIEW",
  "subscription-closed": "SUBSCRIPTION_CLOSED",
  lost: "LOST",
};

export function toLocalStage(stage: ApiLeadStage): LeadStage {
  return API_TO_LOCAL_STAGE[stage] ?? stage;
}

export function toApiStage(stage: LeadStage): ApiLeadStage {
  return LOCAL_TO_API_STAGE[stage] ?? stage;
}

// ---------- Lost reason mapping ----------
//
// Local has finer-grained reasons than the API. We map both directions and
// pick the closest semantic equivalent when there's no 1:1 match.

const API_TO_LOCAL_REASON: Record<ApiLostReason, LeadLostReason> = {
  budget_cut: "no-budget",
  no_response: "lost-contact",
  competitor_chosen: "competitor",
  not_interested: "wrong-fit",
  bad_fit: "wrong-fit",
  timing: "timing",
  other: "other",
};

const LOCAL_TO_API_REASON: Record<LeadLostReason, ApiLostReason> = {
  pricing: "budget_cut",
  timing: "timing",
  competitor: "competitor_chosen",
  "no-budget": "budget_cut",
  "lost-contact": "no_response",
  "wrong-fit": "bad_fit",
  other: "other",
};

export function toLocalReason(reason: ApiLostReason): LeadLostReason {
  return API_TO_LOCAL_REASON[reason];
}

export function toApiReason(reason: LeadLostReason): ApiLostReason {
  return LOCAL_TO_API_REASON[reason];
}

// ---------- Lead source ----------

const KNOWN_SOURCES: LeadSource[] = [
  "cold",
  "referral",
  "inbound",
  "event",
  "website",
];

function toLocalSource(value: string | null | undefined): LeadSource {
  const v = (value ?? "").toLowerCase();
  return (KNOWN_SOURCES.includes(v as LeadSource)
    ? (v as LeadSource)
    : "cold") as LeadSource;
}

// ---------- Timeline ----------

function timelineKindToType(
  kind: ApiLeadTimelineEntry["kind"],
): LeadTimelineEvent["type"] {
  switch (kind) {
    case "stage_change":
      return "stage-change";
    case "call":
      return "call";
    case "meeting":
      return "meeting";
    case "note":
    default:
      return "note";
  }
}

function durationLabelToSeconds(label?: string | null): number | undefined {
  if (!label) return undefined;
  // Accept "15m", "1h 20m", "45s" — best-effort parse.
  const re = /(\d+)\s*(h|m|s)/g;
  let m: RegExpExecArray | null;
  let total = 0;
  let matched = false;
  while ((m = re.exec(label)) !== null) {
    matched = true;
    const n = Number(m[1]);
    const unit = m[2];
    if (unit === "h") total += n * 3600;
    else if (unit === "m") total += n * 60;
    else total += n;
  }
  return matched ? total : undefined;
}

export function adaptTimelineEntry(
  entry: ApiLeadTimelineEntry,
): LeadTimelineEvent {
  return {
    id: entry.id,
    actorId: entry.author?.id ?? "",
    actorName: entry.author?.name,
    timestamp: entry.created_at,
    type: timelineKindToType(entry.kind),
    fromStage: entry.from_stage ? toLocalStage(entry.from_stage) : undefined,
    toStage: entry.to_stage ? toLocalStage(entry.to_stage) : undefined,
    content: entry.body || undefined,
    durationSec: durationLabelToSeconds(entry.duration_label),
  };
}

// ---------- Lead ----------

export function adaptLead(api: ApiLead, timeline: LeadTimelineEvent[] = []): Lead {
  return {
    id: api.id,
    clinicName: api.clinic_name,
    doctorName: api.doctor_name,
    specialization: api.specialization ?? "",
    phone: api.phone ?? "",
    city: api.city ?? "",
    area: api.area ?? "",
    address: api.address ?? "",
    stage: toLocalStage(api.stage),
    source: toLocalSource(api.lead_source),
    value: api.estimated_value ?? 0,
    monthlyAppointments: api.monthly_appointments ?? 0,
    branches: api.number_of_branches ?? 1,
    notes: api.notes ?? "",
    ownerId: api.sales_user_id ?? api.owner?.id ?? "",
    ownerName: api.owner?.name,
    lastActivityAt: api.last_activity_at,
    nextAction: api.next_action_title,
    timeline,
    lostReason: api.lost_reason ? toLocalReason(api.lost_reason) : undefined,
  };
}

export function adaptLeadDetail(api: ApiLeadDetail): Lead {
  const timeline = (api.timeline ?? []).map(adaptTimelineEntry);
  return adaptLead(api, timeline);
}
