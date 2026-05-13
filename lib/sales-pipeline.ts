import type { DefaultLeadStage, Lead, LeadLostReason, LeadStage } from "./types";

/**
 * Pipeline-specific labels and metadata.
 *
 * The Kanban view re-labels two stages compared to the Leads table — "Cold
 * lead" reads as "New leads" and "Subscription closed" reads as "Closed won"
 * because reps think about the funnel that way. The underlying stage values
 * stay the same so leads can flow between the table view and Kanban without
 * a translation layer.
 */
export const KANBAN_STAGE_LABEL: Record<DefaultLeadStage, string> = {
  "cold-lead": "New leads",
  "first-contact": "First contact",
  "doctor-meeting": "Doctor meeting",
  "pitch-delivered": "Pitch delivered",
  "hot-lead": "Hot leads",
  "sprint-started": "Sprint started",
  "sprint-review": "Sprint review",
  "subscription-closed": "Closed won",
  lost: "Lost",
};

/**
 * Render-friendly label for any stage value, including custom stages
 * (e.g. "NEGOTIATION_ROUND_2" → "Negotiation Round 2"). Falls through to
 * the built-in label map for default stages.
 */
export function stageLabel(stage: LeadStage): string {
  const known = (KANBAN_STAGE_LABEL as Record<string, string>)[stage];
  if (known) return known;
  return stage
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Left-to-right column order on the Kanban. Lost is rightmost so cards
 * dragged there fall off the active funnel visually.
 */
export const KANBAN_STAGE_ORDER: DefaultLeadStage[] = [
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

/**
 * Probability the lead actually closes given its stage. Drives the
 * "Weighted forecast" tile and the per-card Forecast-mode rendering.
 */
export const STAGE_PROBABILITY: Record<DefaultLeadStage, number> = {
  "cold-lead": 0.05,
  "first-contact": 0.1,
  "doctor-meeting": 0.25,
  "pitch-delivered": 0.5,
  "hot-lead": 0.75,
  "sprint-started": 0.85,
  "sprint-review": 0.95,
  "subscription-closed": 1,
  lost: 0,
};

/** Probability lookup that returns a sensible fallback for custom stages. */
export function stageProbability(stage: LeadStage): number {
  const known = (STAGE_PROBABILITY as Record<string, number>)[stage];
  return known ?? 0.4;
}

/** Stages that are still in the active funnel (not closed-won, not lost). */
const CLOSED_STAGES = new Set<string>(["subscription-closed", "lost"]);

export function isOpenStage(stage: LeadStage): boolean {
  return !CLOSED_STAGES.has(stage);
}

/** Per-stage column accent — used on the column header dot. */
export const STAGE_DOT_CLASS: Record<DefaultLeadStage, string> = {
  "cold-lead": "bg-zinc-400",
  "first-contact": "bg-sky-500",
  "doctor-meeting": "bg-violet-500",
  "pitch-delivered": "bg-indigo-500",
  "hot-lead": "bg-rose-500",
  "sprint-started": "bg-amber-500",
  "sprint-review": "bg-orange-500",
  "subscription-closed": "bg-emerald-500",
  lost: "bg-zinc-300",
};

/** Returns the dot class for a stage, or a neutral default for custom stages. */
export function stageDotClass(stage: LeadStage): string {
  return (
    (STAGE_DOT_CLASS as Record<string, string>)[stage] ?? "bg-amber-500"
  );
}

export const LOST_REASON_LABEL: Record<LeadLostReason, string> = {
  pricing: "Pricing",
  timing: "Timing",
  competitor: "Competitor",
  "no-budget": "No budget",
  "lost-contact": "Lost contact",
  "wrong-fit": "Wrong fit",
  other: "Other",
};

export const LOST_REASON_ORDER: LeadLostReason[] = [
  "pricing",
  "timing",
  "competitor",
  "no-budget",
  "lost-contact",
  "wrong-fit",
  "other",
];

export interface PipelineSummary {
  openValue: number;
  openCount: number;
  weightedForecast: number;
  closedWonValue: number;
  closedWonCount: number;
  lostCount: number;
  /** 0–100, or null when there are no resolved deals to compute from. */
  winRatePct: number | null;
}

export function summarizePipeline(leads: Lead[]): PipelineSummary {
  let openValue = 0;
  let openCount = 0;
  let weightedForecast = 0;
  let closedWonValue = 0;
  let closedWonCount = 0;
  let lostCount = 0;

  for (const lead of leads) {
    if (lead.stage === "subscription-closed") {
      closedWonValue += lead.value;
      closedWonCount += 1;
      continue;
    }
    if (lead.stage === "lost") {
      lostCount += 1;
      continue;
    }
    openValue += lead.value;
    openCount += 1;
    weightedForecast += lead.value * stageProbability(lead.stage);
  }

  const resolved = closedWonCount + lostCount;
  const winRatePct = resolved === 0 ? null : (closedWonCount / resolved) * 100;

  return {
    openValue,
    openCount,
    weightedForecast: Math.round(weightedForecast),
    closedWonValue,
    closedWonCount,
    lostCount,
    winRatePct,
  };
}
