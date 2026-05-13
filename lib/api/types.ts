/**
 * Shared API types matching the Sales API documentation.
 *
 * These mirror the JSON shapes the backend returns — keep in sync when
 * the API changes. Names use the API's own snake_case where it's faithful
 * to the wire format, and camelCase for fields the API itself camelCases.
 */

// ---------- Roles ----------

export type ApiRole = "SUPER_ADMIN" | "SALES_ADMIN" | "SALES_SUBADMIN";

/** Surface-level user role string returned by /sales/users. */
export type ApiUserRole = "member" | "admin" | "super_admin";

// ---------- Pagination envelope ----------

export interface Paginated<T> {
  total: number;
  page: number;
  limit: number;
  total_pages: number;
  // Single-key collection. Endpoint modules narrow this with a real key.
  [k: string]: T[] | number;
}

// ---------- Lead stages ----------

export type DefaultApiLeadStage =
  | "NEW_LEADS"
  | "FIRST_CONTACT"
  | "DOCTOR_MEETING"
  | "PITCH_DELIVERED"
  | "HOT_LEADS"
  | "SPRINT_STARTED"
  | "SPRINT_REVIEW"
  | "SUBSCRIPTION_CLOSED"
  | "LOST";

/**
 * Stage value the API accepts. Defaults are the built-in funnel stages;
 * admins can create custom stages whose name is an arbitrary uppercase
 * string. `string & {}` keeps autocomplete for the known defaults while
 * still accepting custom values.
 */
export type ApiLeadStage = DefaultApiLeadStage | (string & {});

export type ApiLostReason =
  | "budget_cut"
  | "no_response"
  | "competitor_chosen"
  | "not_interested"
  | "bad_fit"
  | "timing"
  | "other";

export type ApiLeadActivityKind = "call" | "meeting" | "note" | "stage_change";

// ---------- Overview ----------

export interface OverviewUser {
  id: string;
  name: string;
  initials: string;
  timezone: string;
}

export interface OverviewQuota {
  period: "monthly" | "quarterly" | "half_yearly" | "yearly";
  period_start: string;
  period_end: string;
  day_of_period: number;
  days_total: number;
  days_remaining: number;
  target_hospitals: number;
  hospitals_done: number;
  hospitals_added: number;
  completion_pct: number;
  pace_status: "on" | "behind" | "ahead";
}

export interface DueTodayItem {
  lead_id: string;
  clinic_name: string;
  next_action_title: string;
  next_action_due: string;
}

export interface StaleLeadItem {
  lead_id: string;
  clinic_name: string;
  stage: ApiLeadStage;
  last_activity_days: number;
}

export interface HotToAdvanceItem {
  lead_id: string;
  clinic_name: string;
  estimated_value: number;
}

export interface OverviewTodayPanel {
  due_today: { count: number; items: DueTodayItem[] };
  stale_leads: { count: number; items: StaleLeadItem[] };
  hot_to_advance: { count: number; value: number; items: HotToAdvanceItem[] };
}

export interface OverviewKpis {
  total_leads: { value: number };
  open_pipeline: { value: number };
  active_sprints: { value: number };
  mrr: { value: number };
}

export interface FunnelStage {
  key: string;
  label: string;
  count: number;
}

export interface FunnelConversion {
  from: string;
  to: string;
  pct: number;
}

export interface OverviewFunnel {
  stages: FunnelStage[];
  conversions: FunnelConversion[];
  bottleneck: string;
}

export interface MyOverview {
  user: OverviewUser;
  quota: OverviewQuota;
  today_panel: OverviewTodayPanel;
  kpis: OverviewKpis;
  funnel: OverviewFunnel;
}

// ---------- Activity feed ----------

export interface ActivityItem {
  id: string;
  kind: ApiLeadActivityKind;
  lead_id: string | null;
  lead_clinic_name: string | null;
  city: string | null;
  actor_id: string;
  actor_name: string;
  body: string;
  occurred_at: string;
}

export interface ActivityFeed {
  activities: ActivityItem[];
  next_cursor: string | null;
}

// ---------- Team overview ----------

export interface TeamKpis {
  team_leads: { value: number };
  open_pipeline: { value: number };
  active_sprints: { value: number };
  team_mrr: { value: number };
  active_reps: { active: number; total: number };
  quota_attainment: { on_track: number; with_quota: number; pct: number };
}

export interface RepAtRisk {
  user_id: string;
  name: string;
  pace_status: "behind" | "on" | "ahead";
  deficit: number;
  done: number;
  target: number;
}

export interface RepStaleByRep {
  user_id: string;
  name: string;
  count: number;
}

export interface HotOpportunityTop {
  lead_id: string;
  clinic_name: string;
  estimated_value: number;
  rep_name: string;
}

export interface TeamHealth {
  reps_at_risk: { count: number; items: RepAtRisk[] };
  stale_team_leads: { count: number; by_rep: RepStaleByRep[] };
  hot_opportunities: { count: number; value_total: number; top: HotOpportunityTop[] };
}

export interface LeaderboardRow {
  rank: number;
  user_id: string;
  name: string;
  done: number;
  target: number;
  completion_pct: number;
  pace_status: "on" | "behind" | "ahead";
  pipeline_value: number;
  mrr_contribution: number;
}

export interface ConversionByRepRow {
  user_id: string;
  name: string;
  lead_to_meeting_pct: number;
  meeting_to_sprint_pct: number;
  sprint_to_subscription_pct: number;
}

export interface ConversionByRep {
  rows: ConversionByRepRow[];
  thresholds: { strong: number; review: number };
}

export interface TeamOverview {
  as_of: string;
  team_kpis: TeamKpis;
  team_health: TeamHealth;
  leaderboard: LeaderboardRow[];
  conversion_by_rep: ConversionByRep;
}

// ---------- Roster ----------

export interface RosterRow {
  user_id: string;
  name: string;
  initials: string;
  email: string;
  status: "ACTIVE" | "INACTIVE";
  is_active_24h: boolean;
  todays_actions: number;
  hospitals_added: number;
  hospitals_done: number;
  target: number;
  pipeline_value: number;
}

export interface RosterResponse {
  rows: RosterRow[];
  page: number;
  limit: number;
  total: number;
}

// ---------- Team config ----------

export interface ApiMetricDefinition {
  key: string;
  label: string;
  unit: "currency" | "count" | "percent" | "days" | "rating";
  format: "integer" | "decimal";
  aggregation: "sum" | "avg" | "last" | "max" | "min";
  betterWhen: "higher" | "lower";
  currency?: "INR" | "USD";
}

export interface TeamConfig {
  id: string;
  name: string;
  color: string;
  description: string;
  metrics: ApiMetricDefinition[];
}

// ---------- Users ----------

export interface ApiUser {
  id: string;
  name: string;
  email: string;
  role: ApiUserRole;
  teamId: string;
  status: "active" | "inactive";
  joinedAt: string;
  lastActiveAt: string | null;
}

export interface InviteResponse {
  userId: string;
  inviteId: string;
  inviteUrl: string;
}

// ---------- Leads ----------

export interface ApiLeadOwner {
  id: string;
  name: string;
  initials: string;
}

export interface ApiLead {
  id: string;
  sales_user_id: string;
  sales_user_name: string;
  clinic_name: string;
  doctor_name: string;
  specialization: string;
  phone: string;
  monthly_appointments: number;
  number_of_branches: number;
  address: string;
  area: string;
  city: string;
  lead_source: string;
  notes: string;
  stage: ApiLeadStage;
  estimated_value: number;
  sprint_started_at: string | null;
  subscription_closed_at: string | null;
  lost_reason: ApiLostReason | null;
  stage_changed_at: string;
  last_activity_at: string;
  next_action_title: string | null;
  next_action_due: string | null;
  owner: ApiLeadOwner;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ApiLeadTimelineEntry {
  id: string;
  lead_id?: string;
  kind: ApiLeadActivityKind;
  body: string;
  author: { id: string; name: string; initials: string };
  from_stage: ApiLeadStage | null;
  to_stage: ApiLeadStage | null;
  duration_label?: string | null;
  tags?: string[];
  meta?: Record<string, unknown> | null;
  created_at: string;
}

export interface ApiLeadDetail extends ApiLead {
  timeline: ApiLeadTimelineEntry[];
}

export interface ListLeadsResponse {
  total: number;
  page: number;
  limit: number;
  total_pages: number;
  leads: ApiLead[];
}

export interface PipelineStageBucket {
  stage: ApiLeadStage;
  count: number;
  total_estimated_value: number;
  leads: ApiLead[];
  /** True when this column is a SALES_ADMIN-created custom stage. */
  is_custom?: boolean;
  /** Hex color provided by the backend for custom stages; null for defaults. */
  color?: string | null;
}

export interface PipelineMetrics {
  open_pipeline_value: number;
  weighted_forecast_value: number;
  closed_won_value: number;
  active_lead_count: number;
  won_count: number;
  lost_count: number;
}

export interface PipelineResponse {
  total: number;
  stages: PipelineStageBucket[];
  metrics: PipelineMetrics;
}

export interface LeadStats {
  total_leads: number;
  pipeline_value: number;
  active_sprints: number;
  mrr: number;
  sales_funnel: {
    total_leads: number;
    meetings: number;
    sprints: number;
    subscriptions: number;
  };
  conversion_metrics: {
    sprint_conversion_percent: number;
    sprints_to_subscriptions_percent: number;
  };
  top_performers: {
    sales_user_id: string;
    sales_user_name: string;
    total_leads: number;
    subscriptions_closed: number;
    pipeline_value: number;
  }[];
}

export interface LeadPerson {
  id: string;
  name: string;
  initials: string;
  active_lead_count: number;
}

// ---------- Subadmins ----------

export interface ApiSubadmin {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: "SALES_SUBADMIN";
  status: "ACTIVE" | "INACTIVE";
  target_hospitals: number;
  target_period: "MONTHLY" | "QUARTERLY" | "HALF_YEARLY" | "YEARLY";
  hospitals_added: number;
  hospitals_done: number;
  created_at: string;
  updated_at: string;
}

export interface ListSubadminsResponse {
  total: number;
  page: number;
  limit: number;
  total_pages: number;
  sales_subadmins: ApiSubadmin[];
}

export interface LocationPin {
  id: string;
  sales_user_id: string;
  hospital_id?: string | null;
  latitude: number;
  longitude: number;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  postal_code?: string | null;
  timezone?: string | null;
  source?: string;
  captured_at: string;
  travel_from_previous?: {
    distance_km: number;
    minutes: number;
  } | null;
}

// ---------- Field pins ----------

export interface FieldPin {
  id: string;
  sales_user_id: string;
  latitude: number;
  longitude: number;
  city: string | null;
  source: "client" | "ip";
  captured_at: string;
}

// ---------- Scoring rules ----------

export interface ScoringRule {
  id: string;
  metric_id: string;
  rule_set_version: number;
  points_per_unit: number;
  cap_per_period: number | null;
  bonus_points: number;
  bonus_on_target_pct: number;
  weight_pct: number;
  min_floor: number | null;
  stretch_target: number | null;
  effective_from: string;
  effective_to: string | null;
}

export interface ScoringRuleSet {
  id: string;
  teamId: string;
  version: number;
  isLive: boolean;
  appliedAt: string;
  rules: ScoringRule[];
  restoredFrom?: number;
}

export interface PublishRuleInput {
  systemId: string;
  label?: string;
  description?: string;
  unit?: string;
  active?: boolean;
  sortOrder?: number;
  pointsPerUnit?: number;
  weight?: number;
  bonusPoints?: number;
  bonusAtTargetPct?: number;
  cap?: number | null;
  floor?: number | null;
  stretch?: number | null;
}

// ---------- Targets ----------

export interface ApiTarget {
  id: string;
  userId: string;
  metricId: string;
  metricKey: string;
  periodType: "MONTHLY" | "QUARTERLY" | "HALF_YEARLY" | "YEARLY";
  targetValue: number;
  isDefault: boolean;
  periodKey: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---------- Manual points ----------

export interface ManualPointEntry {
  id: string;
  userId: string;
  metricId: string;
  metricKey: string;
  points: number;
  reason: string;
  refType: string | null;
  refId: string | null;
  createdBy: { id: string; name: string };
  occurredAt: string;
  createdAt: string;
}

// ---------- Audit log ----------

export interface AuditLogRow {
  id: string;
  timestamp: string;
  actorId: string;
  action: "CREATE" | "UPDATE" | "DELETE" | string;
  resource: string;
  resourceId: string;
  ip: string;
  details: Record<string, unknown>;
}

export interface AuditLogResponse {
  data: AuditLogRow[];
  meta: {
    total: number;
    nextCursor: number | null;
  };
}

// ---------- Scorecard ----------

export type ScorecardStatus =
  | "ON_TRACK"
  | "IN_PROGRESS"
  | "AT_RISK"
  | "STRETCH"
  | "NO_TARGET";

export interface ScorecardPeriod {
  period_type: "MONTHLY" | "QUARTERLY" | "HALF_YEARLY" | "YEARLY" | "CUSTOM";
  period_key: string;
  period_start: string;
  period_end: string;
}

export interface ScorecardSummary {
  total_points: number;
  total_weighted_score: number;
  on_track_metrics: number;
  at_risk_metrics: number;
}

export interface ScorecardRow {
  metric: {
    id: string;
    key: string;
    label: string;
    unit: string;
    is_active: boolean;
  };
  rule: {
    points_per_unit: number;
    weight_pct: number;
    bonus_points: number;
  };
  target: {
    target_value: number | null;
    period_type: string;
  } | null;
  actual_value: number;
  target_value: number | null;
  progress_percent: number;
  status: ScorecardStatus;
  points: {
    base_points: number;
    bonus_points: number;
    manual_adjustment_points: number;
    total_points: number;
    cap_applied: boolean;
  };
  weighted_score: number;
}

export interface ScorecardBoard {
  user: {
    id: string;
    name: string;
    email: string;
    status: "ACTIVE" | "INACTIVE";
  };
  period: ScorecardPeriod;
  summary: ScorecardSummary;
  rows: ScorecardRow[];
}

export interface LeaderboardEntry {
  rank: number;
  user_id: string;
  name: string;
  total_points: number;
  total_weighted_score: number;
  on_track_metrics: number;
  at_risk_metrics: number;
}

export interface ScorecardLeaderboard {
  period: ScorecardPeriod;
  total_users: number;
  leaderboard: LeaderboardEntry[];
}

export interface TeamScorecardEntry {
  user_id: string;
  name: string;
  total_points: number;
  total_weighted_score: number;
  metrics: ScorecardRow[];
}

export interface TeamScorecardBoard {
  period: ScorecardPeriod;
  users: TeamScorecardEntry[];
}

export interface ScorecardConfigMetric {
  id: string;
  key: string;
  label: string;
  unit: string;
  is_active: boolean;
  display_order: number;
  rule: {
    points_per_unit: number;
    cap_per_period: number | null;
    bonus_points: number;
    bonus_on_target_pct: number;
    weight_pct: number;
    min_floor: number | null;
    stretch_target: number | null;
  };
  targets: {
    id: string;
    user_id: string | null;
    target_value: number;
    period_type: string;
    is_default: boolean;
  }[];
}

export interface ScorecardConfig {
  generated_at: string;
  rule_set_version: number;
  metrics: ScorecardConfigMetric[];
}
