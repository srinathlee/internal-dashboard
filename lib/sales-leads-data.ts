import type { DefaultLeadStage, Lead } from "./types";

/**
 * Render-friendly metadata for sales lead stages and sources.
 *
 * Kept as a static module (not API-driven) because these labels and the
 * stage order are part of the UI contract — adding or renaming a stage is
 * a schema change that needs a migration on both sides. The seed `leads`
 * array that used to live alongside these constants has been removed; lead
 * data now comes exclusively from `/api/v1/sales/leads`.
 */

export const LEAD_STAGE_LABEL: Record<DefaultLeadStage, string> = {
  "cold-lead": "Cold lead",
  "first-contact": "First contact",
  "doctor-meeting": "Doctor meeting",
  "pitch-delivered": "Pitch delivered",
  "hot-lead": "Hot lead",
  "sprint-started": "Sprint started",
  "sprint-review": "Sprint review",
  "subscription-closed": "Subscription closed",
  lost: "Lost",
};

/** Stages in workflow order — used by the stage-change Select. */
export const LEAD_STAGE_ORDER: DefaultLeadStage[] = [
  "cold-lead",
  "first-contact",
  "doctor-meeting",
  "pitch-delivered",
  "hot-lead",
  "sprint-started",
  "sprint-review",
  "subscription-closed",
  "lost",
];

export const LEAD_SOURCE_LABEL: Record<Lead["source"], string> = {
  cold: "Cold",
  referral: "Referral",
  inbound: "Inbound",
  event: "Event",
  website: "Website",
};
