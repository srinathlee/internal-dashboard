/**
 * Domain types for the internal dashboard.
 *
 * Design intent: the team config (Team + MetricDefinition[]) drives what
 * the UI renders. Adding a new team (e.g. Tech, Marketing) should be a
 * pure data change — no component code changes required.
 */

// ---------- Roles & permissions ----------

export type Role = "member" | "admin" | "super_admin";

export type Permission =
  | "performance:read:self"
  | "performance:read:team"
  | "performance:read:all"
  | "performance:export:team"
  | "performance:export:all"
  | "team:add_member"
  | "team:remove_member"
  | "user:invite"
  | "targets:set"
  | "audit_log:read"
  | "user:assign_role";

/**
 * Optional context narrowing a permission check to a specific scope.
 * Without it, `can` only verifies the role grants the permission in principle.
 */
export interface ResourceContext {
  teamId?: TeamId;
  userId?: string;
}

// ---------- Teams & metrics ----------

/**
 * v1 ships with two teams. New IDs are added here when a team is onboarded.
 * Keeping this as a string-literal union (rather than `string`) keeps team
 * lookups exhaustive at the type level.
 */
export type TeamId = "sales" | "onboarding";

export type MetricUnit = "currency" | "count" | "percent" | "days" | "rating";
export type MetricFormat = "integer" | "decimal";
export type MetricAggregation = "sum" | "avg" | "last";

export interface MetricDefinition {
  /** Stable key used in DailyMetric.values and Target.values */
  key: string;
  label: string;
  unit: MetricUnit;
  format: MetricFormat;
  /** How a per-day series collapses to a KPI card number */
  aggregation: MetricAggregation;
  /** Direction of "good" — drives arrow + color in trend indicators */
  betterWhen: "higher" | "lower";
  /** Optional currency code, only meaningful when unit === "currency" */
  currency?: "INR" | "USD";
}

export interface Team {
  id: TeamId;
  name: string;
  /** Tailwind color name (e.g. "blue", "teal"). Rendered as small dot/badge only. */
  color: string;
  description: string;
  /** Exactly four metrics — these become the four KPI cards on the dashboard. */
  metrics: MetricDefinition[];
}

// ---------- Users ----------

export type UserStatus = "active" | "inactive";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  /** null for super_admin (no specific team) */
  teamId: TeamId | null;
  status: UserStatus;
  /** ISO timestamp */
  joinedAt: string;
  /** ISO timestamp */
  lastActiveAt: string;
}

// ---------- Metrics & targets ----------

export interface DailyMetric {
  userId: string;
  teamId: TeamId;
  /** YYYY-MM-DD */
  date: string;
  /** Keyed by MetricDefinition.key for the user's team */
  values: Record<string, number>;
}

export interface Target {
  userId: string;
  teamId: TeamId;
  period: "monthly";
  /** Keyed by MetricDefinition.key for the user's team */
  values: Record<string, number>;
}

// ---------- Audit log ----------

export type AuditAction =
  | "user.login"
  | "user.logout"
  | "user.invite"
  | "user.role_change"
  | "user.deactivate"
  | "team.member_add"
  | "team.member_remove"
  | "targets.update"
  | "performance.export";

export interface AuditLogEntry {
  id: string;
  /** ISO timestamp */
  timestamp: string;
  /** The user who performed the action */
  actorId: string;
  action: AuditAction;
  /** Free-form resource label, e.g. "Sales / Arjun Mehta" */
  resource: string;
  resourceId?: string;
  ip: string;
  /** Optional human-readable detail, e.g. "role changed: member → admin" */
  details?: string;
}

// ---------- Activity feed (member view) ----------

export interface ActivityEntry {
  id: string;
  timestamp: string;
  userId: string;
  /** Display string, e.g. "Closed deal with Acme Corp — ₹2.4L" */
  text: string;
}

// ---------- Sales leads ----------

export type DefaultLeadStage =
  | "cold-lead"
  | "first-contact"
  | "doctor-meeting"
  | "pitch-delivered"
  | "hot-lead"
  | "sprint-started"
  | "sprint-review"
  | "subscription-closed"
  | "lost";

/**
 * Stage value attached to a lead. Defaults are the nine built-in funnel
 * stages; admins can also create custom stages whose name is an arbitrary
 * uppercase string (e.g. "NEGOTIATION"). The `string & {}` pattern keeps
 * autocomplete for the known defaults while still accepting custom values.
 */
export type LeadStage = DefaultLeadStage | (string & {});

/** Structured reasons collected when a lead is moved to the "lost" stage. */
export type LeadLostReason =
  | "pricing"
  | "timing"
  | "competitor"
  | "no-budget"
  | "lost-contact"
  | "wrong-fit"
  | "other";

export type LeadSource =
  | "cold"
  | "referral"
  | "inbound"
  | "event"
  | "website";

export type LeadActivityType =
  | "stage-change"
  | "note"
  | "call"
  | "meeting";

export interface LeadTimelineEvent {
  id: string;
  /** ID of the user who logged the event. */
  actorId: string;
  /** Display name of the user who logged the event, when supplied by the API. */
  actorName?: string;
  /** ISO timestamp. */
  timestamp: string;
  type: LeadActivityType;
  /** Stage transition: from → to. Only set when type === "stage-change". */
  fromStage?: LeadStage;
  toStage?: LeadStage;
  /** Free-form text for note / call summary / meeting notes. */
  content?: string;
  /** Call duration in seconds. Only set when type === "call". */
  durationSec?: number;
}

export interface Lead {
  id: string;
  clinicName: string;
  doctorName: string;
  /** Doctor's medical specialization, e.g. "Dental", "Pediatrics". */
  specialization: string;
  phone: string;
  city: string;
  /** Locality / neighborhood within the city. May be empty. */
  area: string;
  /** Street-level address. May be empty. */
  address: string;
  stage: LeadStage;
  source: LeadSource;
  /**
   * Monthly subscription value in INR. May be 0 when no quote has been
   * delivered yet — the UI shows "—" in that case.
   */
  value: number;
  /** Estimated patient appointments per month. May be 0 if unknown. */
  monthlyAppointments: number;
  /** Number of clinic branches. Defaults to 1. */
  branches: number;
  /** Free-form notes from the rep. May be empty. */
  notes: string;
  /** ID of the sales rep responsible for this lead. */
  ownerId: string;
  /** Display name of the sales rep, when supplied by the API. */
  ownerName?: string;
  /** ISO timestamp of the most recent activity on this lead. */
  lastActivityAt: string;
  /** Free-form description of the next planned action, or null. */
  nextAction: string | null;
  /** Activity history, oldest-first. */
  timeline: LeadTimelineEvent[];
  /** Set when the lead was moved to the "lost" stage. */
  lostReason?: LeadLostReason;
  /** Optional free-form note captured alongside the lost reason. */
  lostNotes?: string;
}

// ---------- Hospitals (Sales) ----------

export interface Hospital {
  id: string;
  name: string;
  /** Full address line shown directly under the name. */
  address: string;
  city: string;
  adminCount: number;
  userCount: number;
  branchCount: number;
  /** ID of the user who onboarded the hospital, or null if unattributed. */
  createdById: string | null;
  /** Display name of the user who onboarded the hospital (as returned by the API). */
  created_by?: string | null;
  /** Identifier shown on each card — phone-shaped 10 digit number. */
  nyraAiNumber: string;
}
