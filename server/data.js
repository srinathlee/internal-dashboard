/**
 * In-memory dummy data store for the MyTeamFlow mock backend.
 * Everything lives in `store`; restarting the server resets all data.
 */

let counter = 1000;
function uid(prefix) {
  counter += 1;
  return `${prefix}-${counter}`;
}

const now = () => new Date();
const iso = (d) => d.toISOString();
const nowIso = () => iso(now());
const daysAgo = (n) => iso(new Date(Date.now() - n * 86400000));
const daysFromNow = (n) => iso(new Date(Date.now() + n * 86400000));
const dateOnly = (isoStr) => isoStr.slice(0, 10);
const todayStr = () => dateOnly(nowIso());

function b64url(obj) {
  return Buffer.from(JSON.stringify(obj))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Fake-but-JWT-shaped token so the frontend's decoder fallback works. */
function makeJwt(user) {
  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    sub: user.id,
    name: user.name,
    email: user.email,
    role: user.apiRole,
    teamId: user.teamId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30,
  };
  return `${b64url(header)}.${b64url(payload)}.mocksignature${counter}`;
}

function initials(name) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

// ---------------------------------------------------------------------------
// Accounts (auth). apiRole = SUPER_ADMIN | SALES_ADMIN | SALES_SUBADMIN
// surfaceRole = super_admin | admin | member (what /sales/users returns)
// ---------------------------------------------------------------------------

const accounts = [
  {
    id: "u-super-1",
    name: "Srinath",
    email: "ram@gmail.com",
    password: "password",
    apiRole: "SUPER_ADMIN",
    surfaceRole: "super_admin",
    teamId: "sales",
    phone: "+91 9000000001",
    status: "active",
    joinedAt: daysAgo(400),
    lastActiveAt: nowIso(),
  },
  {
    id: "u-admin-1",
    name: "Anita Rao",
    email: "anita@myteamflow.com",
    password: "password",
    apiRole: "SALES_ADMIN",
    surfaceRole: "admin",
    teamId: "sales",
    phone: "+91 9000000002",
    status: "active",
    joinedAt: daysAgo(320),
    lastActiveAt: daysAgo(0),
  },
  {
    id: "u-rep-1",
    name: "Ravi Kumar",
    email: "ravi@myteamflow.com",
    password: "password",
    apiRole: "SALES_SUBADMIN",
    surfaceRole: "member",
    teamId: "sales",
    phone: "+91 9000000011",
    status: "active",
    joinedAt: daysAgo(210),
    lastActiveAt: daysAgo(0),
  },
  {
    id: "u-rep-2",
    name: "Priya Sharma",
    email: "priya@myteamflow.com",
    password: "password",
    apiRole: "SALES_SUBADMIN",
    surfaceRole: "member",
    teamId: "sales",
    phone: "+91 9000000012",
    status: "active",
    joinedAt: daysAgo(180),
    lastActiveAt: daysAgo(1),
  },
  {
    id: "u-rep-3",
    name: "Arjun Mehta",
    email: "arjun@myteamflow.com",
    password: "password",
    apiRole: "SALES_SUBADMIN",
    surfaceRole: "member",
    teamId: "sales",
    phone: "+91 9000000013",
    status: "active",
    joinedAt: daysAgo(150),
    lastActiveAt: daysAgo(2),
  },
  {
    id: "u-rep-4",
    name: "Sneha Patil",
    email: "sneha@myteamflow.com",
    password: "password",
    apiRole: "SALES_SUBADMIN",
    surfaceRole: "member",
    teamId: "sales",
    phone: "+91 9000000014",
    status: "active",
    joinedAt: daysAgo(120),
    lastActiveAt: daysAgo(0),
  },
  {
    id: "u-rep-5",
    name: "Vikram Singh",
    email: "vikram@myteamflow.com",
    password: "password",
    apiRole: "SALES_SUBADMIN",
    surfaceRole: "member",
    teamId: "sales",
    phone: "+91 9000000015",
    status: "inactive",
    joinedAt: daysAgo(300),
    lastActiveAt: daysAgo(30),
  },
];

const reps = accounts.filter((a) => a.apiRole === "SALES_SUBADMIN");

// ---------------------------------------------------------------------------
// Pipeline stages
// ---------------------------------------------------------------------------

const pipelineStages = [
  { name: "NEW_LEADS", label: "New Leads", position: 1, color: "#3B82F6" },
  { name: "FIRST_CONTACT", label: "First Contact", position: 2, color: "#06B6D4" },
  { name: "DOCTOR_MEETING", label: "Doctor Meeting", position: 3, color: "#8B5CF6" },
  { name: "PITCH_DELIVERED", label: "Pitch Delivered", position: 4, color: "#F59E0B" },
  { name: "HOT_LEADS", label: "Hot Leads", position: 5, color: "#EF4444" },
  { name: "SPRINT_STARTED", label: "Sprint Started", position: 6, color: "#10B981" },
  { name: "SPRINT_REVIEW", label: "Sprint Review", position: 7, color: "#14B8A6" },
  { name: "SUBSCRIPTION_CLOSED", label: "Subscription Closed", position: 8, color: "#22C55E" },
  { name: "LOST", label: "Lost", position: 9, color: "#6B7280" },
].map((s) => ({
  ...s,
  id: `stage-${s.name.toLowerCase()}`,
  is_default: true,
  is_active: true,
  created_at: daysAgo(365),
}));

// ---------------------------------------------------------------------------
// Leads
// ---------------------------------------------------------------------------

function makeLead(o) {
  const ownerAcc = accounts.find((a) => a.id === o.sales_user_id);
  return {
    id: uid("lead"),
    sales_user_id: o.sales_user_id,
    sales_user_name: ownerAcc.name,
    clinic_name: o.clinic_name,
    doctor_name: o.doctor_name,
    specialization: o.specialization ?? "General Medicine",
    phone: o.phone ?? "+91 9876500000",
    monthly_appointments: o.monthly_appointments ?? 120,
    number_of_branches: o.number_of_branches ?? 1,
    address: o.address ?? "Road No 4, Banjara Hills",
    area: o.area ?? "Banjara Hills",
    city: o.city ?? "Hyderabad",
    lead_source: o.lead_source ?? "field_visit",
    lead_source_label: o.lead_source_label ?? null,
    notes: o.notes ?? "",
    stage: o.stage,
    estimated_value: o.estimated_value ?? 50000,
    priority: o.priority ?? "Medium",
    email: o.email ?? null,
    sprint_started_at: o.sprint_started_at ?? null,
    subscription_closed_at: o.subscription_closed_at ?? null,
    lost_reason: o.lost_reason ?? null,
    lost_note: o.lost_note ?? null,
    stage_changed_at: o.stage_changed_at ?? daysAgo(3),
    last_activity_at: o.last_activity_at ?? daysAgo(1),
    next_action_title: o.next_action_title ?? null,
    next_action_due: o.next_action_due ?? null,
    owner: { id: ownerAcc.id, name: ownerAcc.name, initials: initials(ownerAcc.name) },
    metadata: {},
    created_at: o.created_at ?? daysAgo(20),
    updated_at: daysAgo(1),
    timeline: [],
  };
}

const leads = [
  makeLead({ sales_user_id: "u-rep-1", clinic_name: "Sunrise Multispeciality Clinic", doctor_name: "Dr. Ramesh Gupta", stage: "NEW_LEADS", estimated_value: 45000, city: "Hyderabad", next_action_title: "Intro call", next_action_due: daysFromNow(0) }),
  makeLead({ sales_user_id: "u-rep-1", clinic_name: "CarePoint Clinic", doctor_name: "Dr. Meena Joshi", stage: "FIRST_CONTACT", estimated_value: 60000, city: "Hyderabad" }),
  makeLead({ sales_user_id: "u-rep-1", clinic_name: "Lotus Dental Care", doctor_name: "Dr. Kiran Reddy", stage: "HOT_LEADS", estimated_value: 90000, priority: "Hot", city: "Secunderabad", next_action_title: "Send proposal", next_action_due: daysFromNow(1) }),
  makeLead({ sales_user_id: "u-rep-2", clinic_name: "GreenLeaf Hospital", doctor_name: "Dr. Anjali Verma", stage: "DOCTOR_MEETING", estimated_value: 120000, city: "Bengaluru" }),
  makeLead({ sales_user_id: "u-rep-2", clinic_name: "Wellness First Clinic", doctor_name: "Dr. Sanjay Rao", stage: "SPRINT_STARTED", estimated_value: 110000, sprint_started_at: daysAgo(6), city: "Bengaluru" }),
  makeLead({ sales_user_id: "u-rep-2", clinic_name: "City Ortho Centre", doctor_name: "Dr. Farhan Ali", stage: "SUBSCRIPTION_CLOSED", estimated_value: 150000, subscription_closed_at: daysAgo(10), city: "Bengaluru" }),
  makeLead({ sales_user_id: "u-rep-3", clinic_name: "Apollo Kids Clinic", doctor_name: "Dr. Swati Kulkarni", stage: "PITCH_DELIVERED", estimated_value: 70000, city: "Pune" }),
  makeLead({ sales_user_id: "u-rep-3", clinic_name: "Nova Skin & Hair", doctor_name: "Dr. Rohit Malhotra", stage: "LOST", estimated_value: 40000, lost_reason: "competitor_chosen", lost_note: "Went with a cheaper local vendor", city: "Pune" }),
  makeLead({ sales_user_id: "u-rep-4", clinic_name: "Harmony Womens Clinic", doctor_name: "Dr. Kavita Nair", stage: "SPRINT_REVIEW", estimated_value: 95000, sprint_started_at: daysAgo(20), city: "Chennai" }),
  makeLead({ sales_user_id: "u-rep-4", clinic_name: "Metro Heart Institute", doctor_name: "Dr. Ashok Menon", stage: "HOT_LEADS", estimated_value: 200000, priority: "Hot", city: "Chennai", next_action_title: "Demo with cardiology team", next_action_due: daysFromNow(2) }),
  makeLead({ sales_user_id: "u-rep-5", clinic_name: "Riverside Family Clinic", doctor_name: "Dr. Nisha Thomas", stage: "NEW_LEADS", estimated_value: 35000, city: "Kochi", last_activity_at: daysAgo(12) }),
  makeLead({ sales_user_id: "u-rep-5", clinic_name: "Prime Care Diagnostics", doctor_name: "Dr. Suresh Babu", stage: "SUBSCRIPTION_CLOSED", estimated_value: 130000, subscription_closed_at: daysAgo(25), city: "Kochi" }),
];

// seed a little timeline on every lead
for (const lead of leads) {
  lead.timeline = [
    {
      id: uid("act"),
      lead_id: lead.id,
      kind: "note",
      body: `Initial research on ${lead.clinic_name}.`,
      author: { id: lead.owner.id, name: lead.owner.name, initials: lead.owner.initials },
      from_stage: null,
      to_stage: null,
      duration_label: null,
      tags: [],
      meta: null,
      created_at: daysAgo(5),
    },
    {
      id: uid("act"),
      lead_id: lead.id,
      kind: "call",
      body: `Spoke with ${lead.doctor_name} about MyTeamFlow onboarding.`,
      author: { id: lead.owner.id, name: lead.owner.name, initials: lead.owner.initials },
      from_stage: null,
      to_stage: null,
      duration_label: "12m",
      tags: ["intro"],
      meta: null,
      created_at: daysAgo(2),
    },
  ];
}

// ---------------------------------------------------------------------------
// Follow-ups + notifications
// ---------------------------------------------------------------------------

function makeFollowUp(o) {
  return {
    id: uid("fu"),
    sales_user_id: o.sales_user_id,
    lead_id: o.lead_id ?? null,
    title: o.title,
    description: o.description ?? null,
    follow_up_at: o.follow_up_at,
    type: o.type ?? "CALL",
    status: o.status ?? "PENDING",
    reminder_sent: false,
    completed_at: o.completed_at ?? null,
    created_by: o.sales_user_id,
    created_at: daysAgo(4),
    updated_at: daysAgo(1),
  };
}

const followUps = [
  makeFollowUp({ sales_user_id: "u-rep-1", lead_id: leads[0].id, title: "Intro call with Dr. Gupta", type: "CALL", follow_up_at: daysFromNow(0) }),
  makeFollowUp({ sales_user_id: "u-rep-1", lead_id: leads[2].id, title: "Share pricing deck", type: "EMAIL", follow_up_at: daysFromNow(1) }),
  makeFollowUp({ sales_user_id: "u-rep-2", lead_id: leads[4].id, title: "Sprint check-in visit", type: "VISIT", follow_up_at: daysFromNow(2) }),
  makeFollowUp({ sales_user_id: "u-rep-3", lead_id: leads[6].id, title: "Pitch follow-up meeting", type: "MEETING", follow_up_at: daysFromNow(3) }),
  makeFollowUp({ sales_user_id: "u-rep-4", lead_id: leads[9].id, title: "Cardiology demo", type: "MEETING", follow_up_at: daysAgo(1), status: "MISSED" }),
  makeFollowUp({ sales_user_id: "u-rep-2", lead_id: leads[5].id, title: "Onboarding kickoff", type: "CALL", follow_up_at: daysAgo(3), status: "COMPLETED", completed_at: daysAgo(3) }),
];

const notifications = accounts.slice(0, 6).flatMap((acc, i) => [
  {
    id: uid("ntf"),
    sales_user_id: acc.id,
    follow_up_id: followUps[i % followUps.length].id,
    type: "FOLLOW_UP_REMINDER",
    title: "Follow-up due soon",
    body: `${followUps[i % followUps.length].title} is due soon.`,
    is_read: i % 2 === 0,
    read_at: i % 2 === 0 ? daysAgo(0) : null,
    meta: { follow_up_at: followUps[i % followUps.length].follow_up_at, lead_id: followUps[i % followUps.length].lead_id, follow_up_type: followUps[i % followUps.length].type },
    created_at: daysAgo(i % 3),
  },
]);

const broadcasts = [
  { id: uid("bc"), type: "ANNOUNCEMENT", message: "Monthly review call on Friday at 4 PM.", recipients_count: 5, read_count: 3, sent_at: daysAgo(1), sender_id: "u-admin-1", sender_name: "Anita Rao" },
  { id: uid("bc"), type: "KUDOS", message: "Big congrats to Priya for closing City Ortho Centre!", recipients_count: 5, read_count: 5, sent_at: daysAgo(3), sender_id: "u-admin-1", sender_name: "Anita Rao" },
  { id: uid("bc"), type: "MOTIVATION", message: "Last week of the quarter — push those hot leads over the line!", recipients_count: 5, read_count: 4, sent_at: daysAgo(6), sender_id: "u-super-1", sender_name: "Srinath" },
];

// ---------------------------------------------------------------------------
// Groups + territories
// ---------------------------------------------------------------------------

const groups = [
  {
    id: "grp-1",
    name: "Hyderabad Squad",
    description: "Reps covering Hyderabad & Secunderabad",
    color: "blue",
    team_id: "sales",
    is_active: true,
    member_ids: ["u-rep-1", "u-rep-4"],
    created_by: "u-admin-1",
    creator_name: "Anita Rao",
    created_at: daysAgo(90),
    updated_at: daysAgo(10),
  },
  {
    id: "grp-2",
    name: "South Zone",
    description: "Bengaluru, Chennai and Kochi coverage",
    color: "green",
    team_id: "sales",
    is_active: true,
    member_ids: ["u-rep-2", "u-rep-3", "u-rep-5"],
    created_by: "u-admin-1",
    creator_name: "Anita Rao",
    created_at: daysAgo(80),
    updated_at: daysAgo(5),
  },
];

const territories = [
  {
    id: "ter-1",
    name: "Banjara Hills",
    color: "#276EF1",
    polygon: [
      { lat: 17.41, lng: 78.43 },
      { lat: 17.42, lng: 78.46 },
      { lat: 17.4, lng: 78.47 },
      { lat: 17.39, lng: 78.44 },
    ],
    assigned_user_id: "u-rep-1",
    assigned_user_name: "Ravi Kumar",
    group_id: null,
    group_name: null,
  },
  {
    id: "ter-2",
    name: "Hitech City",
    color: "#10B981",
    polygon: [
      { lat: 17.44, lng: 78.37 },
      { lat: 17.46, lng: 78.39 },
      { lat: 17.44, lng: 78.41 },
      { lat: 17.42, lng: 78.39 },
    ],
    assigned_user_id: null,
    assigned_user_name: null,
    group_id: "grp-1",
    group_name: "Hyderabad Squad",
  },
];

// ---------------------------------------------------------------------------
// Locations / distance / field pins
// ---------------------------------------------------------------------------

const repGeo = {
  "u-rep-1": { lat: 17.412, lng: 78.448 },
  "u-rep-2": { lat: 12.972, lng: 77.594 },
  "u-rep-3": { lat: 18.52, lng: 73.856 },
  "u-rep-4": { lat: 13.083, lng: 80.27 },
  "u-rep-5": { lat: 9.931, lng: 76.267 },
};

const locationSessions = reps.slice(0, 3).map((r, i) => ({
  session_id: uid("sess"),
  user_id: r.id,
  user_name: r.name,
  started_at: daysAgo(0.3 + i * 0.1),
  ended_at: null,
  last_update_at: nowIso(),
}));

function trackFor(userId, dateStr) {
  const base = repGeo[userId] ?? { lat: 17.4, lng: 78.45 };
  const points = Array.from({ length: 8 }, (_, i) => ({
    t: iso(new Date(Date.now() - (8 - i) * 900000)),
    lat: base.lat + i * 0.002,
    lng: base.lng + i * 0.0015,
    acc: 10,
  }));
  return {
    user_id: userId,
    date: dateStr ?? todayStr(),
    session_count: 1,
    total_meters: 5200,
    tracks: [
      {
        session_id: `sess-track-${userId}`,
        started_at: points[0].t,
        ended_at: null,
        meters: 5200,
        date: dateStr ?? todayStr(),
        points,
      },
    ],
  };
}

const fieldPins = reps.slice(0, 4).map((r, i) => ({
  id: uid("pin"),
  sales_user_id: r.id,
  latitude: (repGeo[r.id] ?? { lat: 17.4 }).lat + 0.005,
  longitude: (repGeo[r.id] ?? { lng: 78.45 }).lng + 0.004,
  city: ["Hyderabad", "Bengaluru", "Pune", "Chennai"][i],
  source: "client",
  captured_at: daysAgo(i * 0.2),
  name: `Clinic visit ${i + 1}`,
  note: "Met the front desk, doctor available after 5 PM.",
  visible_on_map: true,
}));

const distanceByRep = {
  "u-rep-1": 12.4,
  "u-rep-2": 9.1,
  "u-rep-3": 15.8,
  "u-rep-4": 7.6,
  "u-rep-5": 0,
};

// ---------------------------------------------------------------------------
// Hospitals (HCS side)
// ---------------------------------------------------------------------------

const hospitals = [
  {
    id: "hosp-1",
    name: "MyTeamFlow Demo Hospital",
    email: "admin@demohospital.in",
    phone: "+91 4023456789",
    emergency_phone: "+91 4023456790",
    location: ["Hyderabad"],
    address: "Plot 12, Jubilee Hills, Hyderabad",
    timezone: "Asia/Kolkata",
    currency: "INR",
    hospital_image_url: null,
    hospital_type: ["Multispeciality"],
    status: "ACTIVE",
    created_at: daysAgo(200),
  },
  {
    id: "hosp-2",
    name: "GreenLeaf Hospital",
    email: "contact@greenleaf.in",
    phone: "+91 8023456789",
    emergency_phone: null,
    location: ["Bengaluru"],
    address: "MG Road, Bengaluru",
    timezone: "Asia/Kolkata",
    currency: "INR",
    hospital_image_url: null,
    hospital_type: ["General"],
    status: "ACTIVE",
    created_at: daysAgo(120),
  },
  {
    id: "hosp-3",
    name: "Metro Heart Institute",
    email: "info@metroheart.in",
    phone: "+91 4423456789",
    emergency_phone: null,
    location: ["Chennai"],
    address: "Anna Salai, Chennai",
    timezone: "Asia/Kolkata",
    currency: "INR",
    hospital_image_url: null,
    hospital_type: ["Cardiology"],
    status: "INACTIVE",
    created_at: daysAgo(60),
  },
];

const branches = [
  { id: "br-1", hospital_id: "hosp-1", name: "Jubilee Hills Main", address: "Plot 12, Jubilee Hills", phone: "+91 4023456789", email: "main@demohospital.in", timezone: "Asia/Kolkata", status: "ACTIVE" },
  { id: "br-2", hospital_id: "hosp-1", name: "Kukatpally Branch", address: "KPHB Phase 3", phone: "+91 4023456791", email: "kphb@demohospital.in", timezone: "Asia/Kolkata", status: "ACTIVE" },
  { id: "br-3", hospital_id: "hosp-2", name: "MG Road Main", address: "MG Road", phone: "+91 8023456789", email: null, timezone: "Asia/Kolkata", status: "ACTIVE" },
];

const hospitalUsers = [
  { id: "hu-1", name: "Demo Admin", email: "admin@demohospital.in", phone: "+91 9877700001", role: "HOSPITAL_ADMIN", hospital_id: "hosp-1", branch_id: null, status: "active", created_at: daysAgo(200) },
  { id: "hu-2", name: "Dr. Lakshmi Devi", email: "lakshmi@demohospital.in", phone: "+91 9877700002", role: "DOCTOR", hospital_id: "hosp-1", branch_id: "br-1", status: "active", specialty: "Pediatrics", qualification: "MBBS, MD", experience_years: 12, department: "Pediatrics", op_fee: 500, currency: "INR", created_at: daysAgo(190) },
  { id: "hu-3", name: "Rekha Front Desk", email: "rekha@demohospital.in", phone: "+91 9877700003", role: "RECEPTIONIST", hospital_id: "hosp-1", branch_id: "br-1", status: "active", created_at: daysAgo(150) },
  { id: "hu-4", name: "GreenLeaf Admin", email: "contact@greenleaf.in", phone: "+91 9877700004", role: "HOSPITAL_ADMIN", hospital_id: "hosp-2", branch_id: null, status: "active", created_at: daysAgo(120) },
];

const subscriptionPlans = [
  { id: 1, name: "Starter", appointments_limit: 300, branch_limit: 1, monthly_price: 4999, quarterly_price_per_month: 4499, half_yearly_price_per_month: 4249, yearly_price_per_month: 3999, billing_cycles: ["monthly", "quarterly", "half_yearly", "yearly"], description: "For single-branch clinics getting started." },
  { id: 2, name: "Growth", appointments_limit: 1000, branch_limit: 3, monthly_price: 9999, quarterly_price_per_month: 8999, half_yearly_price_per_month: 8499, yearly_price_per_month: 7999, billing_cycles: ["monthly", "quarterly", "half_yearly", "yearly"], description: "For growing hospitals with multiple branches." },
  { id: 3, name: "Enterprise", appointments_limit: 5000, branch_limit: 10, monthly_price: 24999, quarterly_price_per_month: 22999, half_yearly_price_per_month: 21999, yearly_price_per_month: 19999, billing_cycles: ["monthly", "quarterly", "half_yearly", "yearly"], description: "Full-scale hospital networks." },
];

const hospitalSubscriptions = {
  "hosp-1": {
    id: "sub-1",
    hospital_id: "hosp-1",
    plan_id: 2,
    plan_name: "Growth",
    billing_cycle: "monthly",
    payment_mode: "online",
    status: "ACTIVE",
    is_active: true,
    start_date: daysAgo(40),
    end_date: daysFromNow(320),
    appointments_limit: 1000,
    appointments_used: 412,
    usage_percent: 41.2,
    next_billing_date: daysFromNow(20),
    days_until_renewal: 20,
    price: 9999,
  },
};

const subscriptionEvents = {
  "hosp-1": [
    { id: uid("se"), hospital_id: "hosp-1", event_type: "CREATED", occurred_at: daysAgo(40), details: { plan: "Growth" } },
    { id: uid("se"), hospital_id: "hosp-1", event_type: "PAYMENT", occurred_at: daysAgo(10), details: { amount: 9999 } },
  ],
};

const paymentGatewaySettings = {
  "hosp-1": {
    razorpay_enabled: true,
    razorpay_key_id: "rzp_test_mock123",
    razorpay_key_secret: "••••••••",
    razorpay_webhook_url: "https://demohospital.in/webhooks/razorpay",
    razorpay_webhook_secret: "••••••••",
    whatsapp_payment_links_enabled: false,
    whatsapp_provider_key: "",
  },
};

// ---------------------------------------------------------------------------
// Scorecard / scoring / targets
// ---------------------------------------------------------------------------

const metricCatalogue = [
  { key: "leads", label: "Leads Added", unit: "count", currency: null, display_order: 1, icon_hint: "users" },
  { key: "sprints_done", label: "Sprints Done", unit: "count", currency: null, display_order: 2, icon_hint: "hash" },
  { key: "sprint_amount", label: "Sprint Amount", unit: "currency", currency: "INR", display_order: 3, icon_hint: "wallet" },
  { key: "revenue", label: "Revenue", unit: "currency", currency: "INR", display_order: 4, icon_hint: "rupee" },
];

const scorecardMetrics = metricCatalogue.map((m, i) => ({
  id: `metric-${m.key}`,
  key: m.key,
  label: m.label,
  unit: m.unit === "currency" ? "currency" : "count",
  is_active: true,
  display_order: i + 1,
  rule: {
    points_per_unit: m.unit === "currency" ? 0.001 : 10,
    cap_per_period: null,
    bonus_points: 50,
    bonus_on_target_pct: 100,
    weight_pct: 25,
    min_floor: null,
    stretch_target: null,
  },
  targets: [
    { id: `tgt-${m.key}-default`, user_id: null, target_value: m.unit === "currency" ? 110000 : 20, period_type: "MONTHLY", is_default: true },
  ],
}));

const scoringRuleSets = [
  {
    id: "rs-2",
    teamId: "sales",
    version: 2,
    isLive: true,
    appliedAt: daysAgo(15),
    rules: scorecardMetrics.map((m) => ({
      id: `rule-${m.key}-v2`,
      metric_id: m.id,
      rule_set_version: 2,
      points_per_unit: m.rule.points_per_unit,
      cap_per_period: null,
      bonus_points: 50,
      bonus_on_target_pct: 100,
      weight_pct: 25,
      min_floor: null,
      stretch_target: null,
      effective_from: daysAgo(15),
      effective_to: null,
    })),
  },
  {
    id: "rs-1",
    teamId: "sales",
    version: 1,
    isLive: false,
    appliedAt: daysAgo(90),
    rules: scorecardMetrics.map((m) => ({
      id: `rule-${m.key}-v1`,
      metric_id: m.id,
      rule_set_version: 1,
      points_per_unit: m.rule.points_per_unit,
      cap_per_period: null,
      bonus_points: 25,
      bonus_on_target_pct: 100,
      weight_pct: 25,
      min_floor: null,
      stretch_target: null,
      effective_from: daysAgo(90),
      effective_to: daysAgo(15),
    })),
  },
];

const manualPoints = [
  { id: uid("mp"), userId: "u-rep-2", metricId: "metric-leads", metricKey: "leads", points: 20, reason: "Referral bonus", refType: null, refId: null, createdBy: { id: "u-admin-1", name: "Anita Rao" }, occurredAt: daysAgo(4), createdAt: daysAgo(4) },
  { id: uid("mp"), userId: "u-rep-1", metricId: "metric-revenue", metricKey: "revenue", points: -10, reason: "Duplicate lead correction", refType: null, refId: null, createdBy: { id: "u-admin-1", name: "Anita Rao" }, occurredAt: daysAgo(8), createdAt: daysAgo(8) },
];

// per-rep actuals used to build scorecards / monitor boards
const repActuals = {
  "u-rep-1": { leads: 14, sprints_done: 2, sprint_amount: 20000, revenue: 45000 },
  "u-rep-2": { leads: 18, sprints_done: 3, sprint_amount: 30000, revenue: 150000 },
  "u-rep-3": { leads: 9, sprints_done: 1, sprint_amount: 10000, revenue: 20000 },
  "u-rep-4": { leads: 16, sprints_done: 2, sprint_amount: 21000, revenue: 95000 },
  "u-rep-5": { leads: 3, sprints_done: 0, sprint_amount: 0, revenue: 0 },
};

// assignable metric targets: userId -> metricKey -> period -> number
const metricTargets = {};
for (const r of reps) {
  metricTargets[r.id] = {
    leads: { MONTHLY: 20, QUARTERLY: 60, HALF_YEARLY: 120, YEARLY: 240 },
    sprints_done: { MONTHLY: 3, QUARTERLY: 9, HALF_YEARLY: 18, YEARLY: 36 },
    sprint_amount: { MONTHLY: 30000, QUARTERLY: 90000, HALF_YEARLY: 180000, YEARLY: 360000 },
    revenue: { MONTHLY: 110000, QUARTERLY: 330000, HALF_YEARLY: 660000, YEARLY: 1320000 },
  };
}

const targetTemplates = [
  {
    id: "tpl-1",
    name: "Standard Rep",
    description: "Default targets for a new sales rep",
    icon: "target",
    color: "#3B82F6",
    is_default: true,
    targets: {
      leads: { MONTHLY: 20, QUARTERLY: 60, YEARLY: 240 },
      sprints_done: { MONTHLY: 3, QUARTERLY: 9, YEARLY: 36 },
      revenue: { MONTHLY: 110000, QUARTERLY: 330000, YEARLY: 1320000 },
    },
    created_by: "u-admin-1",
    created_at: daysAgo(60),
  },
  {
    id: "tpl-2",
    name: "Senior Closer",
    description: "Stretch targets for senior reps",
    icon: "zap",
    color: "#F59E0B",
    is_default: false,
    targets: {
      leads: { MONTHLY: 30, QUARTERLY: 90, YEARLY: 360 },
      sprints_done: { MONTHLY: 5, QUARTERLY: 15, YEARLY: 60 },
      revenue: { MONTHLY: 200000, QUARTERLY: 600000, YEARLY: 2400000 },
    },
    created_by: "u-admin-1",
    created_at: daysAgo(30),
  },
];

const revenueTargets = reps.map((r) => ({
  id: uid("rt"),
  user_id: r.id,
  user_name: r.name,
  period: "MONTHLY",
  target_amount: 110000,
  currency: "INR",
  effective_from: daysAgo(30),
  effective_to: null,
  created_by: { id: "u-admin-1", name: "Anita Rao" },
  created_at: daysAgo(30),
  updated_at: daysAgo(30),
}));

const auditLog = Array.from({ length: 18 }, (_, i) => ({
  id: uid("audit"),
  timestamp: daysAgo(i * 0.7),
  actorId: i % 3 === 0 ? "u-admin-1" : "u-super-1",
  action: ["CREATE", "UPDATE", "DELETE"][i % 3],
  resource: ["lead", "target", "user", "scoring_rule"][i % 4],
  resourceId: `res-${i + 1}`,
  ip: "203.0.113." + (10 + i),
  details: { note: "Mock audit entry" },
}));

// ---------------------------------------------------------------------------
// Subadmin extras
// ---------------------------------------------------------------------------

const subadminMeta = {};
for (const r of reps) {
  subadminMeta[r.id] = {
    target_hospitals: 10,
    target_period: "MONTHLY",
    hospitals_added: repActuals[r.id].leads,
    hospitals_done: Math.floor(repActuals[r.id].leads / 3),
  };
}

const locationPins = {}; // userId -> LocationPin[]
for (const r of reps) {
  const geo = repGeo[r.id];
  locationPins[r.id] = [
    {
      id: uid("lp"),
      sales_user_id: r.id,
      hospital_id: null,
      latitude: geo.lat,
      longitude: geo.lng,
      city: null,
      region: null,
      country: "India",
      postal_code: null,
      timezone: "Asia/Kolkata",
      source: "admin_pin",
      captured_at: daysAgo(1),
      travel_from_previous: null,
    },
  ];
}

// ---------------------------------------------------------------------------
// ACP (Accelerator)
// ---------------------------------------------------------------------------

const acpBatches = [
  { id: "batch-1", name: "Batch Alpha", location: "Hyderabad", created_at: daysAgo(45) },
  { id: "batch-2", name: "Batch Bravo", location: "Bengaluru", created_at: daysAgo(20) },
];

function makeAcpMember(o) {
  return {
    id: uid("acp-m"),
    name: o.name,
    email: o.email,
    phone: o.phone ?? "+91 9811100000",
    joined_at: o.joined_at,
    ending_at: null,
    tag: o.tag ?? "active",
    sprint_revenue: o.sprint_revenue ?? 0,
    subscription_revenue: o.subscription_revenue ?? 0,
    sprint_target: 10000,
    revenue_target: 110000,
    lead_count: o.lead_count ?? 5,
    current_review: o.current_review ?? null,
    batch_id: o.batch_id,
    batch_name: acpBatches.find((b) => b.id === o.batch_id)?.name,
    status: o.tag === "fired" ? "inactive" : "active",
    note: o.note ?? "",
    note_updated_at: o.note ? daysAgo(2) : null,
  };
}

const acpMembers = [
  makeAcpMember({ name: "Kiran Rao", email: "kiran.acp@myteamflow.com", batch_id: "batch-1", joined_at: daysAgo(40), tag: "active", sprint_revenue: 12000, subscription_revenue: 0, current_review: "working_fine", lead_count: 14 }),
  makeAcpMember({ name: "Divya Menon", email: "divya.acp@myteamflow.com", batch_id: "batch-1", joined_at: daysAgo(40), tag: "close_monitoring", sprint_revenue: 6000, subscription_revenue: 0, current_review: "observation", lead_count: 9 }),
  makeAcpMember({ name: "Rahul Jain", email: "rahul.acp@myteamflow.com", batch_id: "batch-1", joined_at: daysAgo(38), tag: "at_risk", sprint_revenue: 2000, subscription_revenue: 0, current_review: "retrain", lead_count: 4, note: "Struggles with objection handling." }),
  makeAcpMember({ name: "Sana Sheikh", email: "sana.acp@myteamflow.com", batch_id: "batch-1", joined_at: daysAgo(36), tag: "converted", sprint_revenue: 15000, subscription_revenue: 120000, current_review: "working_fine", lead_count: 20 }),
  makeAcpMember({ name: "Mohan Das", email: "mohan.acp@myteamflow.com", batch_id: "batch-2", joined_at: daysAgo(15), tag: "active", sprint_revenue: 4000, subscription_revenue: 0, current_review: null, lead_count: 6 }),
  makeAcpMember({ name: "Leela Krishnan", email: "leela.acp@myteamflow.com", batch_id: "batch-2", joined_at: daysAgo(14), tag: "firing_zone", sprint_revenue: 0, subscription_revenue: 0, current_review: "retrain", lead_count: 1 }),
];

const acpDailyLogs = {};
for (const m of acpMembers) {
  acpDailyLogs[m.id] = Array.from({ length: 5 }, (_, i) => ({
    id: uid("acp-log"),
    member_id: m.id,
    date: dateOnly(daysAgo(i + 1)),
    week_number: Math.max(1, Math.min(8, Math.ceil((Date.now() - new Date(m.joined_at).getTime()) / (7 * 86400000)) - Math.floor(i / 6))),
    day_in_week: ((5 - i) % 6) + 1,
    activity_type: ["field", "field", "training", "observation", "field"][i],
    note: ["Visited 4 clinics in the assigned zone.", "Two promising conversations.", "Classroom training on pitch flow.", "Shadowed senior rep on a demo.", "Cold visits, gathered 3 contacts."][i],
    visited: ["Sunrise Clinic", "CarePoint", "Lotus Dental"].slice(0, 3 - (i % 2)),
    sprint_accepted: i === 1 ? ["CarePoint"] : [],
    sprint_revenue: i === 1 ? 2000 : 0,
    audio_url: null,
    audio_filename: null,
    audio_duration: null,
    admin_review: i === 0 ? m.current_review : null,
  }));
}

const acpMessages = {};
for (const m of acpMembers) {
  acpMessages[m.id] = [
    { id: uid("acp-msg"), member_id: m.id, sent_by: "Anita Rao", message: `Keep pushing, ${m.name.split(" ")[0]} — focus on doctor meetings this week.`, created_at: daysAgo(2) },
  ];
}

const acpSprints = {};
for (const m of acpMembers) {
  acpSprints[m.id] = m.sprint_revenue
    ? [
        {
          id: uid("acp-sp"),
          hospital_name: "CarePoint Clinic",
          amount: m.sprint_revenue,
          status: m.subscription_revenue > 0 ? "converted" : "active",
          started_at: daysAgo(10),
          refund_deadline: daysFromNow(20),
          confirmed_at: m.subscription_revenue > 0 ? daysAgo(5) : null,
          plan_name: m.subscription_revenue > 0 ? "Growth" : null,
          plan_value: m.subscription_revenue > 0 ? m.subscription_revenue : null,
          lead_id: null,
          doctor_name: "Dr. Meena Joshi",
          phone: "+91 9876500001",
          city: "Hyderabad",
        },
      ]
    : [];
}

const acpProgramConfig = {
  weeks: 8,
  days_per_week: 6,
  rest_days: ["sunday"],
  duration_months: 2,
  default_sprint_target: 10000,
  default_revenue_target: 110000,
  week_titles: Array.from({ length: 8 }, (_, i) => ({
    week: i + 1,
    title: `Week ${i + 1}`,
    subtitle: ["Foundation", "Field basics", "Pitch mastery", "Sprint push", "Momentum", "Deep field", "Conversion", "Final sprint"][i],
  })),
  day_schedule: Array.from({ length: 8 }, (_, w) =>
    Array.from({ length: 6 }, (_, d) => ({
      week: w + 1,
      day: d + 1,
      activity_type: w === 0 && d < 3 ? "training" : d === 5 ? "observation" : "field",
    })),
  ).flat(),
};

// ---------------------------------------------------------------------------
// Brochure sends
// ---------------------------------------------------------------------------

const brochureSends = [
  {
    id: uid("brs"),
    message_id: "wamid.mock1",
    to: "+919876500001",
    lead_id: leads[1].id,
    note: "Requested pricing details",
    delivery_status: "delivered",
    provider: "whatsapp",
    sent_at: daysAgo(2),
    delivered_at: daysAgo(2),
    failed_at: null,
    failure_reason: null,
    sender: { id: "u-rep-1", name: "Ravi Kumar" },
  },
  {
    id: uid("brs"),
    message_id: "wamid.mock2",
    to: "+919876500002",
    lead_id: null,
    note: null,
    delivery_status: "read",
    provider: "whatsapp",
    sent_at: daysAgo(5),
    delivered_at: daysAgo(5),
    failed_at: null,
    failure_reason: null,
    sender: { id: "u-rep-2", name: "Priya Sharma" },
  },
];

// ---------------------------------------------------------------------------

const store = {
  accounts,
  reps,
  sessions: {}, // token -> account id
  pipelineStages,
  leads,
  followUps,
  notifications,
  broadcasts,
  groups,
  territories,
  locationSessions,
  fieldPins,
  distanceByRep,
  repGeo,
  hospitals,
  branches,
  hospitalUsers,
  subscriptionPlans,
  hospitalSubscriptions,
  subscriptionEvents,
  paymentGatewaySettings,
  metricCatalogue,
  scorecardMetrics,
  scoringRuleSets,
  manualPoints,
  repActuals,
  metricTargets,
  targetTemplates,
  revenueTargets,
  auditLog,
  subadminMeta,
  locationPins,
  acpBatches,
  acpMembers,
  acpDailyLogs,
  acpMessages,
  acpSprints,
  acpProgramConfig,
  brochureSends,
  teams: [
    {
      id: "sales",
      name: "Sales Team",
      color: "#7C6CF6",
      description: "MyTeamFlow field sales team",
      admin: { user_id: "u-admin-1", name: "Anita Rao", email: "anita@myteamflow.com", role: "SALES_ADMIN", team_id: "sales", status: "ACTIVE", created_at: daysAgo(320) },
      member_count: reps.length,
      created_at: daysAgo(365),
      updated_at: daysAgo(10),
    },
  ],
};

module.exports = {
  store,
  uid,
  iso,
  nowIso,
  daysAgo,
  daysFromNow,
  dateOnly,
  todayStr,
  makeJwt,
  initials,
};
