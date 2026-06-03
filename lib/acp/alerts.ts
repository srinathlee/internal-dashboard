/**
 * Accelerator (ACP) alert engine — pure, frontend-computed.
 *
 * The backend exposes no stored-alert endpoints for this web dashboard (the
 * `/acp/.../alerts` routes in FRONTEND_ACP_API.md target the RN app). Per the
 * ACP spec, alerts are computed on the fly from the data we already hold:
 *
 *  - Admin side ({@link generateMemberAlerts} / {@link getBatchAlerts}) works
 *    off the batch roster (`AcpMember`). Daily logs are optional: when omitted
 *    (the dashboard loads the roster only, no N+1 per-member log fetch) the
 *    log-dependent attendance / activity / audio checks are skipped and only
 *    the target / performance / admin-action rules — all derivable from the
 *    member record — fire.
 *  - Rep side ({@link generateRepSelfAlerts}) works off the rep's own daily
 *    logs (`/acp/me/daily-logs`) plus their coach inbox, deriving program
 *    position and sprint progress from the logs themselves.
 *
 * Thresholds mirror the program: M1 = ₹10K sprint over weeks 1–4, M2 = ₹1.1L
 * subscription revenue over weeks 5–8. Each member's clock runs from their own
 * `joined_at`, so all week/day math is per-rep.
 */

import type {
  AcpDailyLog,
  AcpMember,
  AcpMessage,
  AcpReview,
} from "@/lib/api/sales-accelerator";
import { programDayActivity, programPosition } from "./program-position";

// ---------------------------------------------------------------------------
// Alert shapes
// ---------------------------------------------------------------------------

export type AcpAdminAlertSeverity = "critical" | "warning";

export type AcpAdminAlertCategory =
  | "attendance"
  | "activity"
  | "audio"
  | "performance"
  | "target"
  | "admin_action";

export interface AcpAdminAlert {
  id: string;
  severity: AcpAdminAlertSeverity;
  category: AcpAdminAlertCategory;
  /** Short headline. */
  message: string;
  /** Optional muted second line with the specifics. */
  detail?: string;
}

/** An admin alert paired with the rep it belongs to (batch-level feed). */
export interface AcpAdminAlertForRep extends AcpAdminAlert {
  rep: AcpMember;
}

export interface AcpBatchAlerts {
  all: AcpAdminAlertForRep[];
  critical: AcpAdminAlertForRep[];
  warning: AcpAdminAlertForRep[];
  /** Reps with ≥1 alert, worst (most critical, then most alerts) first. */
  byRep: { rep: AcpMember; alerts: AcpAdminAlert[] }[];
}

export type AcpRepAlertSeverity =
  | "action"
  | "warning"
  | "milestone"
  | "feedback";

export type AcpRepAlertCategory = "daily_task" | "target" | "feedback";

export interface AcpRepAlert {
  id: string;
  severity: AcpRepAlertSeverity;
  category: AcpRepAlertCategory;
  message: string;
  detail?: string;
}

// ---------------------------------------------------------------------------
// Program constants + small helpers
// ---------------------------------------------------------------------------

const DEFAULT_SPRINT_TARGET = 10000; // M1: ₹10K
const DEFAULT_REVENUE_TARGET = 110000; // M2: ₹1.1L

interface RepPosition {
  week: number;
  dayInWeek: number;
  month: 1 | 2;
}

/** Local YYYY-MM-DD (not UTC) so "today" matches the rep's calendar day. */
export function todayLocalYmd(now: Date = new Date()): string {
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);
}

/**
 * Program week/day for a date relative to the rep's join date (1–8 / 1–5),
 * counting business days only (weekends skipped). See {@link programPosition}.
 */
function positionForDate(joinedAt: string, at: Date): RepPosition {
  return programPosition(joinedAt, at);
}

/**
 * Member's position now. Computed from `joined_at` with business-day math
 * rather than the server's `current_week`/`current_day` (which count calendar
 * days incl. weekends), so alerts fire on the same day the UI shows.
 */
function memberPosition(member: AcpMember, now: Date): RepPosition {
  return positionForDate(member.joined_at, now);
}

// Day type per (week, day) lives in {@link programDayActivity} so the alerts,
// the daily-log inference, and the batch Weekly board all agree.

/** Compact ₹ for alert detail lines (₹1.1L / ₹7.5K / ₹0). */
function inr(value: number): string {
  const n = Math.round(Number(value) || 0);
  if (n >= 100000) return `₹${(n / 100000).toFixed(n % 100000 === 0 ? 0 : 1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}K`;
  return `₹${n}`;
}

// ---------------------------------------------------------------------------
// Admin alert engine
// ---------------------------------------------------------------------------

/**
 * Compute the admin-facing alerts for a single member.
 *
 * `logs` is optional — pass the member's daily logs to also evaluate the
 * attendance / activity / audio rules (§10); omit them (the default for the
 * roster-only batch panel) to evaluate the target / performance / admin-action
 * rules alone, which need only the member record.
 *
 * Fired and converted members produce no alerts (they're out of the program).
 */
export function generateMemberAlerts(
  member: AcpMember,
  logs?: AcpDailyLog[],
  now: Date = new Date(),
): AcpAdminAlert[] {
  if (member.tag === "fired" || member.tag === "converted") return [];
  if (member.status === "inactive") return [];

  const alerts: AcpAdminAlert[] = [];
  const push = (
    severity: AcpAdminAlertSeverity,
    category: AcpAdminAlertCategory,
    id: string,
    message: string,
    detail?: string,
  ) => alerts.push({ id, severity, category, message, detail });

  const { week, dayInWeek: day, month } = memberPosition(member, now);
  const sprintRev = member.sprint_revenue;
  const subRev = member.subscription_revenue;
  const sprintTarget = member.sprint_target || DEFAULT_SPRINT_TARGET;
  const revTarget = member.revenue_target || DEFAULT_REVENUE_TARGET;
  const half = sprintTarget * 0.5;
  const quarter = sprintTarget * 0.25;
  const threeQuarter = sprintTarget * 0.75;

  // --- Tag / review signals (any week) ---------------------------------
  if (member.tag === "firing_zone") {
    push(
      "critical",
      "performance",
      "tag-firing",
      "In the firing zone",
      "Tagged for removal — decide this week.",
    );
  } else if (member.tag === "at_risk") {
    push("warning", "performance", "tag-atrisk", "Flagged at risk");
  } else if (member.tag === "close_monitoring") {
    push("warning", "performance", "tag-monitor", "Under close monitoring");
  }
  if (member.current_review === "retrain") {
    push(
      "warning",
      "admin_action",
      "review-retrain",
      "Latest review: re-train",
      "Needs a re-training plan.",
    );
  }

  // --- Month 1 (weeks 1–4): sprint revenue toward ₹10K -----------------
  if (month === 1) {
    if (week === 1) {
      if (day >= 6 && sprintRev === 0) {
        push(
          "warning",
          "performance",
          "w1-no-traction",
          "No sprint traction in week 1",
          "Visiting but nothing accepted yet.",
        );
      }
    } else if (week === 2) {
      if (sprintRev === 0) {
        push(
          "warning",
          "target",
          "w2-zero",
          "₹0 sprint revenue in week 2",
          `Target ${inr(sprintTarget)} by end of month 1.`,
        );
      }
    } else if (week === 3) {
      if (sprintRev < quarter && day >= 3) {
        push(
          "critical",
          "target",
          "w3-below-25",
          "Below 25% of M1",
          `${inr(sprintRev)} of ${inr(sprintTarget)}.`,
        );
      } else if (day === 6 && sprintRev < half) {
        push(
          "critical",
          "target",
          "w3-below-50",
          "Below the 50% checkpoint",
          `${inr(sprintRev)} of ${inr(half)} expected by week 3.`,
        );
      } else if (day === 6 && sprintRev < threeQuarter) {
        push(
          "warning",
          "target",
          "w3-push",
          "Needs a push for M1",
          `${inr(sprintRev)} of ${inr(sprintTarget)}.`,
        );
      }
    } else if (week === 4) {
      if (day === 6 && sprintRev < sprintTarget) {
        push(
          "critical",
          "target",
          "w4-failed",
          "Failed month 1",
          `${inr(sprintRev)} of ${inr(sprintTarget)} at week 4 close.`,
        );
      } else if (sprintRev < sprintTarget) {
        push(
          "critical",
          "target",
          "w4-at-risk",
          "Month 1 at risk",
          `${inr(sprintRev)} of ${inr(sprintTarget)} — final week.`,
        );
      }
    }
  }

  // --- Month 2 (weeks 5–8): subscription revenue toward ₹1.1L ----------
  if (month === 2) {
    // Carry-over: M1 still not done entering M2 is the headline problem.
    if (sprintRev < sprintTarget) {
      push(
        "critical",
        "target",
        "m1-incomplete",
        "Month 1 incomplete in month 2",
        `Sprint ${inr(sprintRev)} of ${inr(sprintTarget)}.`,
      );
    }
    const halfRev = revTarget * 0.5;
    if (week === 5) {
      if (subRev === 0 && day >= 3) {
        push(
          "warning",
          "performance",
          "w5-no-sub",
          "No subscription activity",
          "No conversions started in week 5.",
        );
      }
    } else if (week === 6) {
      if (subRev === 0) {
        push(
          "critical",
          "target",
          "w6-zero",
          "₹0 subscription revenue in week 6",
          `Target ${inr(revTarget)} by program end.`,
        );
      } else if (subRev < halfRev) {
        push(
          "warning",
          "target",
          "w6-below-pace",
          "Below the month 2 pace",
          `${inr(subRev)} of ${inr(revTarget)}.`,
        );
      }
    } else if (week === 7) {
      if (subRev < halfRev) {
        push(
          "critical",
          "target",
          "w7-behind",
          "Severely behind on month 2",
          `${inr(subRev)} of ${inr(revTarget)}.`,
        );
      } else if (subRev < revTarget) {
        push(
          "warning",
          "target",
          "w7-at-risk",
          "Month 2 at risk",
          `${inr(subRev)} of ${inr(revTarget)}.`,
        );
      }
    } else if (week === 8) {
      if (subRev < revTarget) {
        push(
          "critical",
          "target",
          "w8-not-met",
          "Program ending — M2 not met",
          `${inr(subRev)} of ${inr(revTarget)}.`,
        );
      } else if (member.tag === "active") {
        push(
          "warning",
          "admin_action",
          "w8-convert",
          "Met M2 — conversion pending",
          "Eligible for a full-time offer.",
        );
      }
    }
  }

  // --- Log-dependent checks (only when logs are supplied) --------------
  if (logs) {
    evaluateLogAlerts(member, logs, { week, day, month }, now, push);
  }

  return alerts;
}

/**
 * Attendance / activity / audio checks that need the member's daily logs.
 * Split out so {@link generateMemberAlerts} stays readable and the roster-only
 * panel can skip it entirely.
 */
function evaluateLogAlerts(
  member: AcpMember,
  logs: AcpDailyLog[],
  pos: { week: number; day: number; month: 1 | 2 },
  now: Date,
  push: (
    severity: AcpAdminAlertSeverity,
    category: AcpAdminAlertCategory,
    id: string,
    message: string,
    detail?: string,
  ) => void,
): void {
  const todayStr = todayLocalYmd(now);
  const logByDate = new Map(logs.map((l) => [l.date, l] as const));
  const expected = programDayActivity(pos.week, pos.day);
  const today = logByDate.get(todayStr);

  // Universal: no log on a working day that's already underway.
  if (expected !== "training" && !today && pos.day >= 1) {
    push(
      "warning",
      "attendance",
      "no-log-today",
      "No log submitted today",
      "Expected a field log for today.",
    );
  }

  // A field log with no recording / no visits is incomplete coaching data.
  if (today && expected === "field") {
    if (!today.audio_url && !today.audio_filename) {
      push(
        "critical",
        "audio",
        "today-no-audio",
        "No pitch recording today",
        "Field day logged without audio to review.",
      );
    }
    if (today.visited.length === 0) {
      push(
        "critical",
        "activity",
        "today-no-visits",
        "0 hospital visits today",
        "Field day logged with no visits.",
      );
    }
  }

  // Week 1: by day 6 there should be at least one recording to review.
  if (pos.week === 1 && pos.day >= 6) {
    const anyAudio = logs.some(
      (l) => l.week === 1 && (l.audio_url || l.audio_filename),
    );
    if (!anyAudio) {
      push(
        "critical",
        "audio",
        "w1-no-audio",
        "No audio to review in week 1",
        "Pitch recordings missing for the whole week.",
      );
    }
  }
}

/**
 * Aggregate alerts for a whole batch from the loaded roster.
 *
 * Fired/converted members are excluded (handled in {@link generateMemberAlerts}).
 * The `byRep` grouping orders reps worst-first: any rep with a critical alert
 * sorts above warning-only reps, then by alert count.
 */
export function getBatchAlerts(
  members: AcpMember[],
  logsByMember?: Map<string, AcpDailyLog[]>,
  now: Date = new Date(),
): AcpBatchAlerts {
  const all: AcpAdminAlertForRep[] = [];
  const byRep: { rep: AcpMember; alerts: AcpAdminAlert[] }[] = [];

  for (const rep of members) {
    const alerts = generateMemberAlerts(rep, logsByMember?.get(rep.id), now);
    if (alerts.length === 0) continue;
    byRep.push({ rep, alerts });
    for (const a of alerts) all.push({ ...a, rep });
  }

  byRep.sort((a, b) => {
    const aCrit = a.alerts.some((x) => x.severity === "critical") ? 1 : 0;
    const bCrit = b.alerts.some((x) => x.severity === "critical") ? 1 : 0;
    if (aCrit !== bCrit) return bCrit - aCrit;
    return b.alerts.length - a.alerts.length;
  });

  return {
    all,
    critical: all.filter((a) => a.severity === "critical"),
    warning: all.filter((a) => a.severity === "warning"),
    byRep,
  };
}

// ---------------------------------------------------------------------------
// Rep self-alert engine
// ---------------------------------------------------------------------------

export interface RepSelfInput {
  /** The rep's own daily logs, newest-first (`/acp/me/daily-logs`). */
  logs: AcpDailyLog[];
  /** Coach messages newer than the rep last opened their inbox. */
  unreadMessageCount?: number;
  /** Most recent coach message, for the feedback alert detail. */
  latestMessage?: AcpMessage | null;
}

const REVIEW_FEEDBACK: Record<AcpReview, { message: string; detail: string }> = {
  working_fine: {
    message: "Working fine — keep it up",
    detail: "Your coach is happy with your progress.",
  },
  observation: {
    message: "Under observation",
    detail: "Your coach is watching this week closely.",
  },
  retrain: {
    message: "Re-training required",
    detail: "Your coach wants to revisit the fundamentals.",
  },
};

/**
 * Compute the rep's own alerts from their daily logs + coach inbox.
 *
 * Program position and sprint progress are derived from the logs themselves
 * (earliest log = program start; summed per-day sprint revenue = M1 progress),
 * so no separate member fetch is needed. Subscription/deadline alerts are
 * omitted on purpose — the rep side has no reliable source for them.
 */
export function generateRepSelfAlerts(
  input: RepSelfInput,
  now: Date = new Date(),
): AcpRepAlert[] {
  const { logs, unreadMessageCount = 0, latestMessage = null } = input;
  const alerts: AcpRepAlert[] = [];
  const push = (
    severity: AcpRepAlertSeverity,
    category: AcpRepAlertCategory,
    id: string,
    message: string,
    detail?: string,
  ) => alerts.push({ id, severity, category, message, detail });

  // Program start ≈ earliest log date; fall back to "today" (week 1) if empty.
  const dates = logs.map((l) => l.date).filter(Boolean).sort();
  const start = dates[0] ?? todayLocalYmd(now);
  const { week, dayInWeek: day, month } = positionForDate(start, now);
  const expected = programDayActivity(week, day);
  const todayStr = todayLocalYmd(now);
  const todayLog = logs.find((l) => l.date === todayStr) ?? null;
  const sprintRev = logs.reduce((n, l) => n + (l.sprint_revenue ?? 0), 0);
  const sprintTarget = DEFAULT_SPRINT_TARGET;

  // --- Daily tasks ------------------------------------------------------
  if (!todayLog) {
    push(
      "action",
      "daily_task",
      "submit-log",
      expected === "training"
        ? "Submit your training log"
        : "Submit today's daily log",
      "Log your day before end of day.",
    );
  } else if (expected === "field") {
    if (!todayLog.audio_url && !todayLog.audio_filename) {
      push(
        "action",
        "daily_task",
        "upload-audio",
        "Upload your pitch recording",
        "Your coach needs today's recording to review.",
      );
    }
    if (todayLog.visited.length === 0) {
      push(
        "action",
        "daily_task",
        "log-visits",
        "Log your hospital visits",
        "Add the hospitals you visited today.",
      );
    }
  }
  if (week === 1 && day >= 6) {
    const anyAudio = logs.some(
      (l) => l.week === 1 && (l.audio_url || l.audio_filename),
    );
    if (!anyAudio) {
      push(
        "action",
        "daily_task",
        "w1-audio",
        "Upload your week-1 recordings",
        "Days 3–5 pitch audio are still missing.",
      );
    }
  }

  // --- Sprint target progress (month 1) --------------------------------
  if (month === 1) {
    const remaining = Math.max(0, sprintTarget - sprintRev);
    if (week === 2 && sprintRev === 0) {
      push(
        "warning",
        "target",
        "t-w2",
        "No sprints accepted yet",
        `Aim for ${inr(sprintTarget)} by end of month 1.`,
      );
    } else if (week === 3) {
      if (sprintRev < sprintTarget * 0.5) {
        push(
          "warning",
          "target",
          "t-w3-behind",
          "Below the week-3 checkpoint",
          `${inr(remaining)} to reach 50%.`,
        );
      } else {
        push(
          "milestone",
          "target",
          "t-w3-50",
          "50% of month 1 cleared!",
          `${inr(sprintRev)} of ${inr(sprintTarget)}.`,
        );
      }
    } else if (week === 4) {
      if (sprintRev < sprintTarget) {
        push(
          "warning",
          "target",
          "t-w4",
          "Final week of month 1",
          `${inr(remaining)} to go to hit ${inr(sprintTarget)}.`,
        );
      } else {
        push(
          "milestone",
          "target",
          "t-w4-done",
          "Month 1 target achieved!",
          `${inr(sprintRev)} sprint revenue.`,
        );
      }
    }
  }

  // --- Coach feedback ---------------------------------------------------
  const latestReviewed = logs.find((l) => l.admin_review !== null);
  if (latestReviewed?.admin_review) {
    const f = REVIEW_FEEDBACK[latestReviewed.admin_review];
    push("feedback", "feedback", "review", f.message, f.detail);
  }
  if (unreadMessageCount > 0) {
    push(
      "feedback",
      "feedback",
      "coach-message",
      unreadMessageCount === 1
        ? "New message from your coach"
        : `${unreadMessageCount} new messages from your coach`,
      latestMessage?.message
        ? latestMessage.message.length > 80
          ? `${latestMessage.message.slice(0, 80)}…`
          : latestMessage.message
        : undefined,
    );
  }

  return alerts;
}
