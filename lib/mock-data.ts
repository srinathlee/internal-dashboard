import type {
  ActivityEntry,
  AuditLogEntry,
  DailyMetric,
  Hospital,
  MetricDefinition,
  Target,
  Team,
  TeamId,
  User,
} from "./types";

// ---------- Reference clock ----------
//
// The mock data covers a fixed 30-day window ending on REFERENCE_DATE so values
// are stable across reloads. Replace this and the generators with real queries
// when wiring a backend; nothing else in the app should hard-code "today".

export const REFERENCE_DATE = "2026-05-05";

// ---------- Deterministic RNG ----------
// mulberry32 — small, fast, and gives us reproducible mock numbers.

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(...parts: (string | number)[]): number {
  let h = 2166136261;
  for (const part of parts) {
    const s = String(part);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
  }
  return h >>> 0;
}

function randRange(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min);
}

function randInt(rng: () => number, min: number, max: number): number {
  return Math.floor(randRange(rng, min, max + 1));
}

// ---------- Date helpers ----------

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00.000Z");
  d.setUTCDate(d.getUTCDate() + days);
  return toISODate(d);
}

/** Returns the last `n` ISO dates ending at REFERENCE_DATE (inclusive), oldest first. */
export function lastNDates(n: number, end: string = REFERENCE_DATE): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(addDays(end, -i));
  return out;
}

// ---------- Teams ----------

const SALES_METRICS: MetricDefinition[] = [
  {
    key: "revenue",
    label: "Revenue",
    unit: "currency",
    format: "integer",
    aggregation: "sum",
    betterWhen: "higher",
    currency: "INR",
  },
  {
    key: "dealsClosed",
    label: "Deals Closed",
    unit: "count",
    format: "integer",
    aggregation: "sum",
    betterWhen: "higher",
  },
  {
    key: "avgDealSize",
    label: "Avg Deal Size",
    unit: "currency",
    format: "integer",
    aggregation: "avg",
    betterWhen: "higher",
    currency: "INR",
  },
  {
    key: "conversionRate",
    label: "Conversion %",
    unit: "percent",
    format: "decimal",
    aggregation: "avg",
    betterWhen: "higher",
  },
];

const ONBOARDING_METRICS: MetricDefinition[] = [
  {
    key: "clientsOnboarded",
    label: "Clients Onboarded",
    unit: "count",
    format: "integer",
    aggregation: "sum",
    betterWhen: "higher",
  },
  {
    key: "avgTimeToActivate",
    label: "Avg Time to Activate",
    unit: "days",
    format: "decimal",
    aggregation: "avg",
    betterWhen: "lower",
  },
  {
    key: "csatScore",
    label: "CSAT Score",
    unit: "rating",
    format: "decimal",
    aggregation: "avg",
    betterWhen: "higher",
  },
  {
    key: "activeOnboardings",
    label: "Active Onboardings",
    unit: "count",
    format: "integer",
    aggregation: "last",
    betterWhen: "higher",
  },
];

export const teams: Team[] = [
  {
    id: "sales",
    name: "Sales",
    color: "blue",
    description: "Inbound and outbound revenue motion.",
    metrics: SALES_METRICS,
  },
  {
    id: "onboarding",
    name: "Onboarding",
    color: "teal",
    description: "Activating new customers from sign-up to first value.",
    metrics: ONBOARDING_METRICS,
  },
];

export function getTeam(id: TeamId): Team {
  const team = teams.find((t) => t.id === id);
  if (!team) throw new Error(`Unknown team id: ${id}`);
  return team;
}

// ---------- Users ----------

export const users: User[] = [
  {
    id: "u_priya",
    name: "Priya Sharma",
    email: "priya.sharma@nyra.ai",
    role: "super_admin",
    teamId: null,
    status: "active",
    joinedAt: "2024-09-01T09:00:00.000Z",
    lastActiveAt: "2026-05-05T08:14:00.000Z",
  },
  {
    id: "u_rahul",
    name: "Rahul Kumar",
    email: "rahul.kumar@nyra.ai",
    role: "admin",
    teamId: "sales",
    status: "active",
    joinedAt: "2024-10-14T09:00:00.000Z",
    lastActiveAt: "2026-05-05T07:42:00.000Z",
  },
  {
    id: "u_neha",
    name: "Neha Gupta",
    email: "neha.gupta@nyra.ai",
    role: "admin",
    teamId: "onboarding",
    status: "active",
    joinedAt: "2024-11-02T09:00:00.000Z",
    lastActiveAt: "2026-05-05T06:55:00.000Z",
  },
  // Sales members
  {
    id: "u_arjun",
    name: "Arjun Mehta",
    email: "arjun.mehta@nyra.ai",
    role: "member",
    teamId: "sales",
    status: "active",
    joinedAt: "2025-01-08T09:00:00.000Z",
    lastActiveAt: "2026-05-05T07:10:00.000Z",
  },
  {
    id: "u_kavya",
    name: "Kavya Nair",
    email: "kavya.nair@nyra.ai",
    role: "member",
    teamId: "sales",
    status: "active",
    joinedAt: "2025-02-19T09:00:00.000Z",
    lastActiveAt: "2026-05-04T18:32:00.000Z",
  },
  {
    id: "u_sanjay",
    name: "Sanjay Patel",
    email: "sanjay.patel@nyra.ai",
    role: "member",
    teamId: "sales",
    status: "active",
    joinedAt: "2025-03-03T09:00:00.000Z",
    lastActiveAt: "2026-05-05T05:48:00.000Z",
  },
  // Onboarding members
  {
    id: "u_divya",
    name: "Divya Reddy",
    email: "divya.reddy@nyra.ai",
    role: "member",
    teamId: "onboarding",
    status: "active",
    joinedAt: "2025-01-22T09:00:00.000Z",
    lastActiveAt: "2026-05-05T07:01:00.000Z",
  },
  {
    id: "u_karthik",
    name: "Karthik Iyer",
    email: "karthik.iyer@nyra.ai",
    role: "member",
    teamId: "onboarding",
    status: "active",
    joinedAt: "2025-02-04T09:00:00.000Z",
    lastActiveAt: "2026-05-04T17:09:00.000Z",
  },
  {
    id: "u_riya",
    name: "Riya Singh",
    email: "riya.singh@nyra.ai",
    role: "member",
    teamId: "onboarding",
    status: "active",
    joinedAt: "2025-03-17T09:00:00.000Z",
    lastActiveAt: "2026-05-05T06:24:00.000Z",
  },
];

export function getUser(id: string): User | undefined {
  return users.find((u) => u.id === id);
}

export function getTeamMembers(teamId: TeamId): User[] {
  return users.filter((u) => u.teamId === teamId && u.role !== "super_admin");
}

// ---------- Per-user "performance personality" ----------
//
// Each user gets a small skill multiplier so leaderboards are interesting —
// some members consistently outperform, others trail.

const USER_PERFORMANCE: Record<string, number> = {
  u_arjun: 1.18,
  u_kavya: 0.92,
  u_sanjay: 1.05,
  u_divya: 1.12,
  u_karthik: 0.95,
  u_riya: 1.08,
  u_rahul: 1.0, // admin, lighter individual contribution
  u_neha: 1.0,
};

// ---------- Daily metric generation ----------

function generateSalesDay(rng: () => number, skill: number): Record<string, number> {
  const dealsClosed = randInt(rng, 0, 3);
  const avgDealSize = Math.round(randRange(rng, 35_000, 95_000) * skill);
  const revenue = dealsClosed === 0
    ? Math.round(randRange(rng, 0, 12_000)) // pipeline activity, no closed deals
    : Math.round(dealsClosed * avgDealSize * randRange(rng, 0.85, 1.15));
  const conversionRate = Number(
    (randRange(rng, 18, 42) * skill).toFixed(1),
  );
  return { revenue, dealsClosed, avgDealSize, conversionRate };
}

function generateOnboardingDay(
  rng: () => number,
  skill: number,
  prevActive: number,
): Record<string, number> {
  const clientsOnboarded = randInt(rng, 0, 2);
  const avgTimeToActivate = Number(
    (randRange(rng, 3, 9) / Math.max(skill, 0.5)).toFixed(1),
  );
  const csatScore = Number(
    Math.min(5, randRange(rng, 3.8, 5.0) * Math.min(skill, 1.05)).toFixed(2),
  );
  // Active onboardings drift up/down day to day
  const drift = randInt(rng, -1, 1);
  const activeOnboardings = Math.max(
    3,
    Math.min(18, prevActive + clientsOnboarded - drift),
  );
  return { clientsOnboarded, avgTimeToActivate, csatScore, activeOnboardings };
}

function generateMetricsForUser(user: User): DailyMetric[] {
  if (!user.teamId) return [];
  const dates = lastNDates(30);
  const skill = USER_PERFORMANCE[user.id] ?? 1.0;
  const out: DailyMetric[] = [];

  let prevActiveOnboardings = randInt(mulberry32(hashSeed(user.id, "init")), 6, 12);

  for (const date of dates) {
    const rng = mulberry32(hashSeed(user.id, date));
    const values =
      user.teamId === "sales"
        ? generateSalesDay(rng, skill)
        : generateOnboardingDay(rng, skill, prevActiveOnboardings);

    if (user.teamId === "onboarding" && typeof values.activeOnboardings === "number") {
      prevActiveOnboardings = values.activeOnboardings;
    }

    out.push({ userId: user.id, teamId: user.teamId, date, values });
  }
  return out;
}

export const dailyMetrics: DailyMetric[] = users.flatMap(generateMetricsForUser);

export function getMetricsForUser(
  userId: string,
  options: { from?: string; to?: string } = {},
): DailyMetric[] {
  const { from, to } = options;
  return dailyMetrics.filter((m) => {
    if (m.userId !== userId) return false;
    if (from && m.date < from) return false;
    if (to && m.date > to) return false;
    return true;
  });
}

export function getMetricsForTeam(
  teamId: TeamId,
  options: { from?: string; to?: string } = {},
): DailyMetric[] {
  const { from, to } = options;
  return dailyMetrics.filter((m) => {
    if (m.teamId !== teamId) return false;
    if (from && m.date < from) return false;
    if (to && m.date > to) return false;
    return true;
  });
}

// ---------- Targets ----------

const SALES_MEMBER_TARGET: Record<string, number> = {
  revenue: 1_200_000,
  dealsClosed: 20,
  avgDealSize: 60_000,
  conversionRate: 32,
};

const ONBOARDING_MEMBER_TARGET: Record<string, number> = {
  clientsOnboarded: 14,
  avgTimeToActivate: 5,
  csatScore: 4.5,
  activeOnboardings: 12,
};

export const targets: Target[] = users
  .filter((u) => u.teamId !== null)
  .map((u) => ({
    userId: u.id,
    teamId: u.teamId as TeamId,
    period: "monthly" as const,
    values:
      u.teamId === "sales" ? { ...SALES_MEMBER_TARGET } : { ...ONBOARDING_MEMBER_TARGET },
  }));

export function getTargetForUser(userId: string): Target | undefined {
  return targets.find((t) => t.userId === userId);
}

// ---------- Audit log ----------

export const auditLog: AuditLogEntry[] = [
  {
    id: "a_001",
    timestamp: "2026-05-05T08:14:12.000Z",
    actorId: "u_priya",
    action: "user.login",
    resource: "Priya Sharma",
    resourceId: "u_priya",
    ip: "203.0.113.21",
  },
  {
    id: "a_002",
    timestamp: "2026-05-05T07:42:08.000Z",
    actorId: "u_rahul",
    action: "user.login",
    resource: "Rahul Kumar",
    resourceId: "u_rahul",
    ip: "203.0.113.42",
  },
  {
    id: "a_003",
    timestamp: "2026-05-04T16:08:55.000Z",
    actorId: "u_priya",
    action: "performance.export",
    resource: "Org-wide / 30d",
    ip: "203.0.113.21",
    details: "CSV, 270 rows",
  },
  {
    id: "a_004",
    timestamp: "2026-05-04T11:30:42.000Z",
    actorId: "u_rahul",
    action: "targets.update",
    resource: "Sales / Arjun Mehta",
    resourceId: "u_arjun",
    ip: "203.0.113.42",
    details: "revenue: ₹10L → ₹12L",
  },
  {
    id: "a_005",
    timestamp: "2026-05-03T18:45:01.000Z",
    actorId: "u_neha",
    action: "user.invite",
    resource: "Onboarding / external@partner.co",
    ip: "198.51.100.7",
    details: "role: member (pending)",
  },
  {
    id: "a_006",
    timestamp: "2026-05-03T14:22:19.000Z",
    actorId: "u_priya",
    action: "user.role_change",
    resource: "Onboarding / Neha Gupta",
    resourceId: "u_neha",
    ip: "203.0.113.21",
    details: "member → admin",
  },
  {
    id: "a_007",
    timestamp: "2026-05-03T09:11:04.000Z",
    actorId: "u_rahul",
    action: "performance.export",
    resource: "Sales / 7d",
    ip: "203.0.113.42",
    details: "CSV, 21 rows",
  },
  {
    id: "a_008",
    timestamp: "2026-05-02T17:55:33.000Z",
    actorId: "u_neha",
    action: "team.member_add",
    resource: "Onboarding / Riya Singh",
    resourceId: "u_riya",
    ip: "198.51.100.7",
  },
  {
    id: "a_009",
    timestamp: "2026-05-02T12:38:50.000Z",
    actorId: "u_priya",
    action: "user.login",
    resource: "Priya Sharma",
    resourceId: "u_priya",
    ip: "203.0.113.21",
  },
  {
    id: "a_010",
    timestamp: "2026-05-01T15:21:09.000Z",
    actorId: "u_rahul",
    action: "user.invite",
    resource: "Sales / lead@growthco.in",
    ip: "203.0.113.42",
    details: "role: member (accepted)",
  },
  {
    id: "a_011",
    timestamp: "2026-05-01T10:04:27.000Z",
    actorId: "u_priya",
    action: "user.role_change",
    resource: "Sales / Sanjay Patel",
    resourceId: "u_sanjay",
    ip: "203.0.113.21",
    details: "member (re-confirmed)",
  },
  {
    id: "a_012",
    timestamp: "2026-04-30T19:12:44.000Z",
    actorId: "u_neha",
    action: "targets.update",
    resource: "Onboarding / Divya Reddy",
    resourceId: "u_divya",
    ip: "198.51.100.7",
    details: "csatScore: 4.3 → 4.5",
  },
  {
    id: "a_013",
    timestamp: "2026-04-30T08:50:12.000Z",
    actorId: "u_arjun",
    action: "user.login",
    resource: "Arjun Mehta",
    resourceId: "u_arjun",
    ip: "203.0.113.55",
  },
  {
    id: "a_014",
    timestamp: "2026-04-29T16:33:20.000Z",
    actorId: "u_priya",
    action: "performance.export",
    resource: "Org-wide / Quarter",
    ip: "203.0.113.21",
    details: "CSV, 720 rows",
  },
  {
    id: "a_015",
    timestamp: "2026-04-29T11:08:55.000Z",
    actorId: "u_rahul",
    action: "team.member_remove",
    resource: "Sales / former.intern@nyra.ai",
    ip: "203.0.113.42",
    details: "offboarded",
  },
  {
    id: "a_016",
    timestamp: "2026-04-28T14:47:01.000Z",
    actorId: "u_neha",
    action: "user.login",
    resource: "Neha Gupta",
    resourceId: "u_neha",
    ip: "198.51.100.7",
  },
  {
    id: "a_017",
    timestamp: "2026-04-28T09:22:18.000Z",
    actorId: "u_priya",
    action: "user.deactivate",
    resource: "Sales / contractor@nyra.ai",
    ip: "203.0.113.21",
    details: "contract ended",
  },
  {
    id: "a_018",
    timestamp: "2026-04-27T17:11:39.000Z",
    actorId: "u_kavya",
    action: "user.login",
    resource: "Kavya Nair",
    resourceId: "u_kavya",
    ip: "203.0.113.62",
  },
  {
    id: "a_019",
    timestamp: "2026-04-27T10:55:24.000Z",
    actorId: "u_rahul",
    action: "targets.update",
    resource: "Sales / Kavya Nair",
    resourceId: "u_kavya",
    ip: "203.0.113.42",
    details: "dealsClosed: 25 → 30",
  },
  {
    id: "a_020",
    timestamp: "2026-04-26T13:42:08.000Z",
    actorId: "u_priya",
    action: "user.logout",
    resource: "Priya Sharma",
    resourceId: "u_priya",
    ip: "203.0.113.21",
  },
];

// ---------- Activity feed (member dashboard) ----------

const ACTIVITY_TEMPLATES_SALES = [
  "Closed deal with {co} — ₹{amt}L",
  "Logged 3 outbound calls to {co}",
  "Sent proposal to {co}",
  "Demo booked: {co}",
  "Follow-up scheduled with {co}",
];

const ACTIVITY_TEMPLATES_ONBOARDING = [
  "Activated {co} — {days}d to first value",
  "Kickoff call completed: {co}",
  "Migration milestone reached for {co}",
  "Training session delivered to {co}",
  "CSAT survey returned by {co} — {csat}/5",
];

const COMPANIES = [
  "Acme Corp",
  "Lumen Labs",
  "Northwind Retail",
  "Zenith Foods",
  "Vertex Health",
  "Indigo Bank",
  "Tessa Logistics",
  "Polaris Tech",
];

function pick<T>(rng: () => number, arr: readonly T[]): T {
  // arr has length > 0 by construction at every call site; assert non-undefined.
  return arr[Math.floor(rng() * arr.length)] as T;
}

function generateActivityForUser(user: User): ActivityEntry[] {
  if (!user.teamId) return [];
  const out: ActivityEntry[] = [];
  const dates = lastNDates(7); // last week of activity
  const templates =
    user.teamId === "sales" ? ACTIVITY_TEMPLATES_SALES : ACTIVITY_TEMPLATES_ONBOARDING;

  for (const date of dates) {
    const rng = mulberry32(hashSeed(user.id, "activity", date));
    const count = randInt(rng, 0, 2);
    for (let i = 0; i < count; i++) {
      const template = pick(rng, templates);
      const co = pick(rng, COMPANIES);
      const amt = (randInt(rng, 1, 8) + randInt(rng, 0, 9) / 10).toFixed(1);
      const days = randInt(rng, 3, 9);
      const csat = (randRange(rng, 4.0, 5.0)).toFixed(1);
      const text = template
        .replace("{co}", co)
        .replace("{amt}", amt)
        .replace("{days}", String(days))
        .replace("{csat}", csat);

      const hour = randInt(rng, 9, 18);
      const minute = randInt(rng, 0, 59);
      const ts = `${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00.000Z`;
      out.push({
        id: `act_${user.id}_${date}_${i}`,
        timestamp: ts,
        userId: user.id,
        text,
      });
    }
  }
  return out.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
}

export const activity: ActivityEntry[] = users.flatMap(generateActivityForUser);

export function getActivityForUser(userId: string, limit = 10): ActivityEntry[] {
  return activity.filter((a) => a.userId === userId).slice(0, limit);
}

// ---------- Hospitals ----------

export const hospitals: Hospital[] = [
  {
    id: "hosp_001",
    name: "32 Pearly White Dental Clinic",
    address:
      "Garg's Vivanta, Plot No.4, Telecom Nagar, Gachibowli, Hyderabad, 500032",
    city: "Hyderabad",
    adminCount: 1,
    userCount: 1,
    branchCount: 1,
    createdById: null,
    nyraAiNumber: "9240214452",
  },
  {
    id: "hosp_002",
    name: "Arcus Clinic",
    address:
      "1st floor, LIG 61/8, Kukatpally Housing Board Colony, 4th phase, KPHB Phase 4, Kukatpally, Hyderabad, 500072",
    city: "Hyderabad",
    adminCount: 0,
    userCount: 3,
    branchCount: 1,
    createdById: "u_arjun",
    nyraAiNumber: "9240216457",
  },
  {
    id: "hosp_003",
    name: "Be Skin Hair Clinic",
    address:
      "S8, 2nd floor, Bizness Square, Hitech City Main Rd, Jubilee Enclave, Hyderabad, Telangana 500081",
    city: "Hyderabad",
    adminCount: 1,
    userCount: 2,
    branchCount: 1,
    createdById: "u_arjun",
    nyraAiNumber: "9240218861",
  },
  {
    id: "hosp_004",
    name: "Apollo Family Medical Center",
    address:
      "Plot 23, Road No. 12, Banjara Hills, Hyderabad, Telangana 500034",
    city: "Hyderabad",
    adminCount: 2,
    userCount: 6,
    branchCount: 3,
    createdById: "u_kavya",
    nyraAiNumber: "9240219102",
  },
  {
    id: "hosp_005",
    name: "Sai Krishna Dental Hospital",
    address:
      "5-9-22, Secretariat Rd, Saifabad, Khairatabad, Hyderabad, Telangana 500004",
    city: "Hyderabad",
    adminCount: 1,
    userCount: 4,
    branchCount: 2,
    createdById: "u_sanjay",
    nyraAiNumber: "9240221344",
  },
  {
    id: "hosp_006",
    name: "Yashoda Multispecialty",
    address:
      "Indiranagar 2nd Stage, HAL 2nd Stage, Indiranagar, Bengaluru, Karnataka 560038",
    city: "Bengaluru",
    adminCount: 3,
    userCount: 12,
    branchCount: 4,
    createdById: "u_kavya",
    nyraAiNumber: "9824012783",
  },
  {
    id: "hosp_007",
    name: "Sunshine Children's Clinic",
    address:
      "742, 11th Main Rd, 4th Block, Jayanagar, Bengaluru, Karnataka 560011",
    city: "Bengaluru",
    adminCount: 1,
    userCount: 2,
    branchCount: 1,
    createdById: null,
    nyraAiNumber: "9824018990",
  },
  {
    id: "hosp_008",
    name: "Lotus Ayurveda",
    address:
      "Survey No. 14, Baner Rd, near Chandani Chowk, Baner, Pune, Maharashtra 411045",
    city: "Pune",
    adminCount: 1,
    userCount: 5,
    branchCount: 2,
    createdById: "u_sanjay",
    nyraAiNumber: "9819220067",
  },
  {
    id: "hosp_009",
    name: "Vasant ENT Care",
    address:
      "Shop 4, Manish Nagar, J.P. Road, Andheri (West), Mumbai, Maharashtra 400053",
    city: "Mumbai",
    adminCount: 2,
    userCount: 3,
    branchCount: 1,
    createdById: "u_arjun",
    nyraAiNumber: "9819228812",
  },
  {
    id: "hosp_010",
    name: "Rainbow Pediatrics",
    address:
      "31 Cathedral Rd, Sterling Rd, Nungambakkam, Chennai, Tamil Nadu 600086",
    city: "Chennai",
    adminCount: 1,
    userCount: 4,
    branchCount: 2,
    createdById: "u_rahul",
    nyraAiNumber: "9787019456",
  },
];

export function getHospital(id: string): Hospital | undefined {
  return hospitals.find((h) => h.id === id);
}
