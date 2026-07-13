/**
 * Sales core routes: /api/v1/sales/{teams,users,subadmins,groups,territories,
 * location,distance,field-pins}.
 */
const express = require("express");
const { store, uid, nowIso, daysAgo, todayStr, initials } = require("../data");
const { authUserFrom } = require("./auth-hcs");

const router = express.Router();
const ok = (res, data) => res.json({ success: true, data });

// ---------------------------------------------------------------------------
// Team config + sales users
// ---------------------------------------------------------------------------

router.get("/api/v1/sales/teams/config", (req, res) =>
  ok(res, {
    id: "sales",
    name: "Sales Team",
    color: "#7C6CF6",
    description: "NYRA field sales team",
    metrics: [
      { key: "revenue", label: "Revenue", unit: "currency", format: "integer", aggregation: "sum", betterWhen: "higher", currency: "INR" },
      { key: "leads", label: "Leads Added", unit: "count", format: "integer", aggregation: "sum", betterWhen: "higher" },
      { key: "sprints_done", label: "Sprints Done", unit: "count", format: "integer", aggregation: "sum", betterWhen: "higher" },
      { key: "sprint_amount", label: "Sprint Amount", unit: "currency", format: "integer", aggregation: "sum", betterWhen: "higher", currency: "INR" },
    ],
  }),
);

router.post("/api/v1/sales/teams/invites", (req, res) => {
  const b = req.body ?? {};
  const id = uid("u-rep");
  store.accounts.push({
    id,
    name: b.name,
    email: b.email,
    password: "password",
    apiRole: "SALES_SUBADMIN",
    surfaceRole: "member",
    teamId: b.team_id ?? "sales",
    phone: "",
    status: "active",
    joinedAt: nowIso(),
    lastActiveAt: null,
  });
  return ok(res, { userId: id, inviteId: uid("inv"), inviteUrl: `http://localhost:3000/invite/${id}` });
});

function toApiUser(a) {
  return { id: a.id, name: a.name, email: a.email, role: a.surfaceRole, teamId: a.teamId, status: a.status, joinedAt: a.joinedAt, lastActiveAt: a.lastActiveAt };
}

router.get("/api/v1/sales/users", (req, res) => {
  const { status, q, role, team_id } = req.query;
  let rows = store.accounts.slice();
  if (status) rows = rows.filter((a) => a.status === status);
  if (q) rows = rows.filter((a) => (a.name + a.email).toLowerCase().includes(String(q).toLowerCase()));
  if (role) {
    const roles = String(role).split(",");
    rows = rows.filter((a) => roles.includes(a.surfaceRole));
  }
  if (team_id) rows = rows.filter((a) => a.teamId === team_id);
  return ok(res, rows.map(toApiUser));
});

router.patch("/api/v1/sales/users/me/profile", (req, res) => {
  const me = authUserFrom(req) ?? store.accounts[0];
  const b = req.body ?? {};
  if (b.name) me.name = b.name;
  if (b.phone !== undefined) me.phone = b.phone;
  return ok(res, toApiUser(me));
});

router.patch("/api/v1/sales/users/me/password", (req, res) => ok(res, { updated: true }));

router.get("/api/v1/sales/users/me/streak", (req, res) =>
  ok(res, { streak_days: 6, last_active_date: todayStr(), best_streak: 14 }),
);

router.patch("/api/v1/sales/users/:userId/role", (req, res) => {
  const account = store.accounts.find((a) => a.id === req.params.userId);
  const role = (req.body ?? {}).role ?? "member";
  if (account) {
    account.surfaceRole = role;
    account.apiRole = role === "super_admin" ? "SUPER_ADMIN" : role === "admin" ? "SALES_ADMIN" : "SALES_SUBADMIN";
  }
  return ok(res, { userId: req.params.userId, role, updated: true });
});

router.patch("/api/v1/sales/users/:userId/status", (req, res) => {
  const account = store.accounts.find((a) => a.id === req.params.userId);
  const status = (req.body ?? {}).status ?? "active";
  if (account) account.status = status;
  return ok(res, { userId: req.params.userId, status, updated: true });
});

// ---------------------------------------------------------------------------
// Subadmins
// ---------------------------------------------------------------------------

function toSubadmin(a) {
  const meta = store.subadminMeta[a.id] ?? { target_hospitals: 10, target_period: "MONTHLY", hospitals_added: 0, hospitals_done: 0 };
  return {
    id: a.id,
    name: a.name,
    email: a.email,
    phone: a.phone,
    role: "SALES_SUBADMIN",
    status: a.status === "inactive" ? "INACTIVE" : "ACTIVE",
    target_hospitals: meta.target_hospitals,
    target_period: meta.target_period,
    hospitals_added: meta.hospitals_added,
    hospitals_done: meta.hospitals_done,
    created_at: a.joinedAt,
    updated_at: a.lastActiveAt ?? a.joinedAt,
  };
}

const subadminAccounts = () => store.accounts.filter((a) => a.apiRole === "SALES_SUBADMIN");

router.get("/api/v1/sales/subadmins", (req, res) => {
  const { page = 1, limit = 50, q, status } = req.query;
  let rows = subadminAccounts().map(toSubadmin);
  if (q) rows = rows.filter((r) => (r.name + r.email).toLowerCase().includes(String(q).toLowerCase()));
  if (status) rows = rows.filter((r) => r.status === status);
  const p = Number(page), l = Number(limit);
  return ok(res, { total: rows.length, page: p, limit: l, total_pages: Math.max(1, Math.ceil(rows.length / l)), sales_subadmins: rows.slice((p - 1) * l, p * l) });
});

router.post("/api/v1/sales/subadmins", (req, res) => {
  const b = req.body ?? {};
  const id = uid("u-rep");
  store.accounts.push({
    id, name: b.name, email: b.email, password: b.password ?? "password",
    apiRole: "SALES_SUBADMIN", surfaceRole: "member", teamId: "sales",
    phone: b.phone ?? "", status: (b.status ?? "ACTIVE").toLowerCase(),
    joinedAt: nowIso(), lastActiveAt: null,
  });
  store.subadminMeta[id] = { target_hospitals: b.target_hospitals ?? 10, target_period: b.target_period ?? "MONTHLY", hospitals_added: 0, hospitals_done: 0 };
  store.repActuals[id] = { leads: 0, sprints_done: 0, sprint_amount: 0, revenue: 0 };
  return ok(res, toSubadmin(store.accounts[store.accounts.length - 1]));
});

router.post("/api/v1/sales/teams/:teamId/reps", (req, res) => {
  const b = req.body ?? {};
  const rep = b.rep ?? {};
  const id = uid("u-rep");
  store.accounts.push({
    id, name: rep.name, email: rep.email, password: rep.password ?? "password",
    apiRole: "SALES_SUBADMIN", surfaceRole: "member", teamId: req.params.teamId,
    phone: rep.phone ?? "", status: "active", joinedAt: nowIso(), lastActiveAt: null,
  });
  store.subadminMeta[id] = { target_hospitals: 10, target_period: "MONTHLY", hospitals_added: 0, hospitals_done: 0 };
  store.repActuals[id] = { leads: 0, sprints_done: 0, sprint_amount: 0, revenue: 0 };
  store.metricTargets[id] = {
    leads: { MONTHLY: b.targets?.leads?.monthly ?? 20, QUARTERLY: b.targets?.leads?.quarterly ?? 60, HALF_YEARLY: 120, YEARLY: b.targets?.leads?.yearly ?? 240 },
    sprints_done: { MONTHLY: b.targets?.sprints?.monthly?.count ?? 3, QUARTERLY: 9, HALF_YEARLY: 18, YEARLY: 36 },
    sprint_amount: { MONTHLY: b.targets?.sprints?.monthly?.amount ?? 30000, QUARTERLY: 90000, HALF_YEARLY: 180000, YEARLY: 360000 },
    revenue: { MONTHLY: b.targets?.revenue?.monthly ?? 110000, QUARTERLY: b.targets?.revenue?.quarterly ?? 330000, HALF_YEARLY: b.targets?.revenue?.half_yearly ?? 660000, YEARLY: b.targets?.revenue?.yearly ?? 1320000 },
  };
  return ok(res, {
    user: { id, name: rep.name, email: rep.email, phone: rep.phone ?? "", role: "SALES_SUBADMIN", team_id: req.params.teamId, status: "ACTIVE", must_change_password: true, created_at: nowIso() },
    targets: b.targets ?? {},
    email: b.send_welcome_email === false
      ? { sent: false, to: rep.email, reason: "skipped" }
      : { sent: true, to: rep.email, message_id: uid("mail"), sent_at: nowIso() },
  });
});

router.post("/api/v1/sales/subadmins/:userId/resend-welcome-email", (req, res) =>
  ok(res, {
    user_id: req.params.userId,
    email: { sent: true, to: store.accounts.find((a) => a.id === req.params.userId)?.email ?? "unknown@nyraai.io", message_id: uid("mail"), sent_at: nowIso() },
    password_rotated: Boolean((req.body ?? {}).reset_password),
  }),
);

router.put("/api/v1/sales/subadmins/:id/target", (req, res) => {
  const meta = store.subadminMeta[req.params.id] ?? (store.subadminMeta[req.params.id] = { target_hospitals: 10, target_period: "MONTHLY", hospitals_added: 0, hospitals_done: 0 });
  const b = req.body ?? {};
  if (b.target_hospitals !== undefined) meta.target_hospitals = b.target_hospitals;
  if (b.target_period !== undefined) meta.target_period = b.target_period;
  return ok(res, { id: req.params.id, target_hospitals: meta.target_hospitals, target_period: meta.target_period });
});

router.post("/api/v1/sales/subadmins/:id/location-pin", (req, res) => {
  const b = req.body ?? {};
  const geo = store.repGeo[req.params.id] ?? { lat: 17.4, lng: 78.45 };
  const pin = {
    id: uid("lp"),
    sales_user_id: req.params.id,
    hospital_id: b.hospital_id ?? null,
    latitude: b.latitude ?? geo.lat,
    longitude: b.longitude ?? geo.lng,
    city: b.city ?? null,
    region: b.region ?? null,
    country: b.country ?? "India",
    postal_code: b.postal_code ?? null,
    timezone: b.timezone ?? "Asia/Kolkata",
    source: "admin_pin",
    captured_at: nowIso(),
    travel_from_previous: { distance_km: 2.4, minutes: 12 },
  };
  (store.locationPins[req.params.id] ??= []).unshift(pin);
  return ok(res, pin);
});

router.get("/api/v1/sales/subadmins/:id/location-history", (req, res) => {
  const rows = store.locationPins[req.params.id] ?? [];
  return ok(res, { rows, total: rows.length });
});

router.post("/api/v1/sales/subadmins/:id/coach", (req, res) => ok(res, { ok: true }));
router.post("/api/v1/sales/subadmins/:id/message", (req, res) => ok(res, { ok: true }));

router.get("/api/v1/sales/subadmins/:id", (req, res) => {
  const account = store.accounts.find((a) => a.id === req.params.id);
  if (!account) return res.status(404).json({ success: false, message: "Subadmin not found." });
  return ok(res, toSubadmin(account));
});

router.patch("/api/v1/sales/subadmins/:id", (req, res) => {
  const account = store.accounts.find((a) => a.id === req.params.id);
  if (!account) return res.status(404).json({ success: false, message: "Subadmin not found." });
  const b = req.body ?? {};
  if (b.name) account.name = b.name;
  if (b.email) account.email = b.email;
  if (b.phone) account.phone = b.phone;
  if (b.status) account.status = b.status.toLowerCase();
  const meta = store.subadminMeta[account.id];
  if (b.target_hospitals !== undefined) meta.target_hospitals = b.target_hospitals;
  if (b.target_period !== undefined) meta.target_period = b.target_period;
  return ok(res, toSubadmin(account));
});

router.delete("/api/v1/sales/subadmins/:id", (req, res) => {
  store.accounts = store.accounts.filter((a) => a.id !== req.params.id);
  return res.status(204).end();
});

// ---------------------------------------------------------------------------
// Groups
// ---------------------------------------------------------------------------

function toGroup(g) {
  return {
    id: g.id, name: g.name, description: g.description, color: g.color,
    team_id: g.team_id, is_active: g.is_active, member_count: g.member_ids.length,
    created_by: g.created_by, creator_name: g.creator_name,
    created_at: g.created_at, updated_at: g.updated_at,
  };
}

function toGroupMember(a, groupId) {
  return {
    id: a.id, name: a.name, email: a.email, phone: a.phone, role: "SALES_SUBADMIN",
    status: a.status === "inactive" ? "INACTIVE" : "ACTIVE", initials: initials(a.name),
    group_id: groupId, team_id: a.teamId, created_at: a.joinedAt,
  };
}

router.get("/api/v1/sales/groups", (req, res) => {
  let rows = store.groups.slice();
  const { q, is_active } = req.query;
  if (q) rows = rows.filter((g) => g.name.toLowerCase().includes(String(q).toLowerCase()));
  if (is_active !== undefined) rows = rows.filter((g) => String(g.is_active) === String(is_active));
  return ok(res, rows.map(toGroup));
});

router.post("/api/v1/sales/groups", (req, res) => {
  const b = req.body ?? {};
  const group = {
    id: uid("grp"), name: b.name, description: b.description ?? null,
    color: b.color ?? "blue", team_id: b.team_id ?? "sales", is_active: true,
    member_ids: b.member_ids ?? [], created_by: "u-admin-1", creator_name: "Anita Rao",
    created_at: nowIso(), updated_at: nowIso(),
  };
  store.groups.push(group);
  return ok(res, toGroup(group));
});

router.get("/api/v1/sales/groups/:groupId/analytics", (req, res) => {
  const group = store.groups.find((g) => g.id === req.params.groupId);
  if (!group) return res.status(404).json({ success: false, message: "Group not found." });
  const members = store.accounts.filter((a) => group.member_ids.includes(a.id));
  const period = req.query.period ?? "MONTHLY";
  const memberPerformance = members.map((m) => {
    const act = store.repActuals[m.id] ?? { leads: 0, sprints_done: 0, sprint_amount: 0, revenue: 0 };
    const tgt = store.metricTargets[m.id] ?? {};
    const metrics = {};
    for (const key of ["leads", "sprints_done", "sprint_amount", "revenue"]) {
      const target = tgt[key]?.[period] ?? 0;
      metrics[key] = { target, actual: act[key], progress_pct: target ? Math.round((act[key] / target) * 100) : null };
    }
    return {
      id: m.id, name: m.name, email: m.email, initials: initials(m.name),
      status: m.status === "inactive" ? "INACTIVE" : "ACTIVE",
      total_leads: act.leads, overall_pace: Math.min(150, Math.round((act.leads / 20) * 100)),
      metrics,
    };
  });
  const totalLeads = memberPerformance.reduce((s, m) => s + m.total_leads, 0);
  const top = memberPerformance.slice().sort((a, b) => b.overall_pace - a.overall_pace)[0] ?? null;
  const targets = {};
  for (const key of ["leads", "sprints_done", "sprint_amount", "revenue"]) {
    const target = memberPerformance.reduce((s, m) => s + (m.metrics[key]?.target ?? 0), 0);
    const actual = memberPerformance.reduce((s, m) => s + (m.metrics[key]?.actual ?? 0), 0);
    const pct = target ? Math.round((actual / target) * 100) : null;
    targets[key] = {
      target, actual, progress_pct: pct,
      members_with_target: memberPerformance.length,
      status: pct === null ? "UNSET" : pct >= 100 ? "ACHIEVED" : pct >= 70 ? "ON_TRACK" : pct >= 40 ? "AT_RISK" : "BEHIND",
    };
  }
  return ok(res, {
    group: { id: group.id, name: group.name, color: group.color, member_count: members.length },
    period,
    as_of: nowIso(),
    summary: {
      total_members: members.length,
      active_members: members.filter((m) => m.status === "active").length,
      total_leads: totalLeads,
      top_performer: top ? { id: top.id, name: top.name, overall_pace: top.overall_pace } : null,
    },
    lead_pipeline: store.leads
      .filter((l) => group.member_ids.includes(l.sales_user_id))
      .reduce((acc, l) => ((acc[l.stage] = (acc[l.stage] ?? 0) + 1), acc), {}),
    targets,
    follow_ups: { total: 6, pending: 3, completed: 2, overdue: 1 },
    member_performance: memberPerformance,
  });
});

router.post("/api/v1/sales/groups/:groupId/members", (req, res) => {
  const group = store.groups.find((g) => g.id === req.params.groupId);
  if (!group) return res.status(404).json({ success: false, message: "Group not found." });
  const ids = (req.body ?? {}).user_ids ?? [];
  for (const id of ids) if (!group.member_ids.includes(id)) group.member_ids.push(id);
  const members = store.accounts.filter((a) => group.member_ids.includes(a.id)).map((a) => toGroupMember(a, group.id));
  return ok(res, { group_id: group.id, added: ids.length, members });
});

router.delete("/api/v1/sales/groups/:groupId/members/:userId", (req, res) => {
  const group = store.groups.find((g) => g.id === req.params.groupId);
  if (group) group.member_ids = group.member_ids.filter((id) => id !== req.params.userId);
  return res.status(204).end();
});

router.get("/api/v1/sales/groups/:id", (req, res) => {
  const group = store.groups.find((g) => g.id === req.params.id);
  if (!group) return res.status(404).json({ success: false, message: "Group not found." });
  const members = store.accounts.filter((a) => group.member_ids.includes(a.id)).map((a) => toGroupMember(a, group.id));
  return ok(res, { ...toGroup(group), members });
});

router.patch("/api/v1/sales/groups/:id", (req, res) => {
  const group = store.groups.find((g) => g.id === req.params.id);
  if (!group) return res.status(404).json({ success: false, message: "Group not found." });
  Object.assign(group, req.body ?? {}, { updated_at: nowIso() });
  return ok(res, toGroup(group));
});

router.delete("/api/v1/sales/groups/:id", (req, res) => {
  const group = store.groups.find((g) => g.id === req.params.id);
  const unassigned = group ? group.member_ids.length : 0;
  store.groups = store.groups.filter((g) => g.id !== req.params.id);
  return ok(res, { id: req.params.id, members_unassigned: unassigned });
});

// ---------------------------------------------------------------------------
// Territories
// ---------------------------------------------------------------------------

router.get("/api/v1/sales/territories", (req, res) => ok(res, store.territories));

router.post("/api/v1/sales/territories", (req, res) => {
  const b = req.body ?? {};
  const assigned = store.accounts.find((a) => a.id === b.assigned_user_id);
  const group = store.groups.find((g) => g.id === b.group_id);
  const territory = {
    id: uid("ter"), name: b.name, color: b.color ?? "#276EF1", polygon: b.polygon ?? [],
    assigned_user_id: assigned?.id ?? null, assigned_user_name: assigned?.name ?? null,
    group_id: group?.id ?? null, group_name: group?.name ?? null,
  };
  store.territories.push(territory);
  return ok(res, territory);
});

router.patch("/api/v1/sales/territories/:id/assign", (req, res) => {
  const t = store.territories.find((x) => x.id === req.params.id);
  if (!t) return res.status(404).json({ success: false, message: "Territory not found." });
  const b = req.body ?? {};
  if ("rep_id" in b) {
    const rep = store.accounts.find((a) => a.id === b.rep_id);
    t.assigned_user_id = rep?.id ?? null;
    t.assigned_user_name = rep?.name ?? null;
  }
  if ("group_id" in b) {
    const group = store.groups.find((g) => g.id === b.group_id);
    t.group_id = group?.id ?? null;
    t.group_name = group?.name ?? null;
  }
  return ok(res, t);
});

router.get("/api/v1/sales/territories/:id", (req, res) => {
  const t = store.territories.find((x) => x.id === req.params.id);
  if (!t) return res.status(404).json({ success: false, message: "Territory not found." });
  return ok(res, t);
});

router.patch("/api/v1/sales/territories/:id", (req, res) => {
  const t = store.territories.find((x) => x.id === req.params.id);
  if (!t) return res.status(404).json({ success: false, message: "Territory not found." });
  Object.assign(t, req.body ?? {});
  return ok(res, t);
});

router.delete("/api/v1/sales/territories/:id", (req, res) => {
  store.territories = store.territories.filter((t) => t.id !== req.params.id);
  return res.status(204).end();
});

// ---------------------------------------------------------------------------
// Location
// ---------------------------------------------------------------------------

router.post("/api/v1/sales/location/sessions/start", (req, res) => {
  const me = authUserFrom(req) ?? store.accounts[0];
  const session = { session_id: uid("sess"), user_id: me.id, user_name: me.name, started_at: nowIso(), ended_at: null, last_update_at: nowIso() };
  store.locationSessions.unshift(session);
  return ok(res, { sessionId: session.session_id, startedAt: session.started_at });
});

router.post("/api/v1/sales/location/sessions/stop", (req, res) => {
  const me = authUserFrom(req) ?? store.accounts[0];
  const session = store.locationSessions.find((s) => s.user_id === me.id && !s.ended_at);
  if (session) session.ended_at = nowIso();
  return ok(res, { stoppedAt: nowIso() });
});

router.post("/api/v1/sales/location/update", (req, res) => ok(res, { accepted: true }));

router.get("/api/v1/sales/location/team-status", (req, res) => {
  const groupId = req.query.group_id;
  let members = store.reps;
  if (groupId) {
    const group = store.groups.find((g) => g.id === groupId);
    if (group) members = members.filter((m) => group.member_ids.includes(m.id));
  }
  const rows = members.map((m, i) => {
    const geo = store.repGeo[m.id];
    const live = i < 3 && m.status === "active";
    const session = store.locationSessions.find((s) => s.user_id === m.id && !s.ended_at);
    return {
      user_id: m.id,
      user_name: m.name,
      tracking_status: live ? "LIVE" : m.status === "active" ? "ACTIVE_NO_LOCATION" : "NOT_STARTED",
      is_live: live,
      lat: live ? geo.lat : null,
      lng: live ? geo.lng : null,
      accuracy: live ? 12 : null,
      battery_level: live ? 78 - i * 10 : null,
      last_updated_at: live ? nowIso() : null,
      session_id: session?.session_id ?? null,
      started_at: session?.started_at ?? null,
    };
  });
  return ok(res, {
    members: rows,
    live_count: rows.filter((r) => r.is_live).length,
    active_no_location_count: rows.filter((r) => r.tracking_status === "ACTIVE_NO_LOCATION").length,
    not_started_count: rows.filter((r) => r.tracking_status === "NOT_STARTED").length,
    total_count: rows.length,
  });
});

router.get("/api/v1/sales/location/live", (req, res) => {
  const live = store.reps.slice(0, 3).map((m) => ({
    userId: m.id,
    lat: store.repGeo[m.id].lat,
    lng: store.repGeo[m.id].lng,
    updatedAt: nowIso(),
    source: "rest",
  }));
  return ok(res, { live, total_active: live.length });
});

router.get("/api/v1/sales/location/sessions", (req, res) => ok(res, { sessions: store.locationSessions }));

router.get("/api/v1/sales/location/history/:userId", (req, res) => {
  const geo = store.repGeo[req.params.userId] ?? { lat: 17.4, lng: 78.45 };
  const entries = Array.from({ length: 6 }, (_, i) => ({
    id: uid("lh"),
    user_id: req.params.userId,
    hospital_id: null,
    lat: geo.lat + i * 0.003,
    lng: geo.lng + i * 0.002,
    recorded_at: daysAgo(i * 0.1),
    source: i % 2 === 0 ? "session" : "field_pin",
  }));
  return ok(res, { entries });
});

router.get("/api/v1/sales/location/track/range", (req, res) => {
  const userId = req.query.user_id ?? store.reps[0].id;
  const { trackFor } = require("../track-helper");
  return ok(res, trackFor(userId, req.query.from ? String(req.query.from) : undefined));
});

router.get("/api/v1/sales/location/track", (req, res) => {
  const userId = req.query.user_id ?? store.reps[0].id;
  const { trackFor } = require("../track-helper");
  return ok(res, trackFor(userId, req.query.date ? String(req.query.date) : undefined));
});

// ---------------------------------------------------------------------------
// Distance
// ---------------------------------------------------------------------------

function distanceDay(km, offsetDays = 0) {
  return {
    date: daysAgo(offsetDays).slice(0, 10),
    meters: Math.round(km * 1000),
    km,
    sessions: km > 0 ? 1 + (offsetDays % 2) : 0,
    visits: Math.round(km / 3),
  };
}

router.get("/api/v1/sales/distance/today", (req, res) => {
  const me = authUserFrom(req) ?? store.reps[0];
  const km = store.distanceByRep[me.id] ?? 8.2;
  return ok(res, distanceDay(km));
});

router.get("/api/v1/sales/distance/history", (req, res) => {
  const me = authUserFrom(req) ?? store.reps[0];
  const base = store.distanceByRep[me.id] ?? 8.2;
  const days = Number(req.query.days ?? 7);
  return ok(res, { history: Array.from({ length: days }, (_, i) => distanceDay(Math.max(0, base - i * 1.3 + (i % 3)), i)) });
});

router.get("/api/v1/sales/distance/team", (req, res) => {
  const members = store.reps.map((m) => {
    const km = store.distanceByRep[m.id] ?? 0;
    return { user_id: m.id, user_name: m.name, meters: Math.round(km * 1000), km, sessions: km > 0 ? 2 : 0, visits_today: Math.round(km / 3) };
  });
  const totalKm = members.reduce((s, m) => s + m.km, 0);
  return ok(res, {
    date: todayStr(),
    total_meters: Math.round(totalKm * 1000),
    total_km: Math.round(totalKm * 10) / 10,
    average_meters: Math.round((totalKm / members.length) * 1000),
    average_km: Math.round((totalKm / members.length) * 10) / 10,
    members,
  });
});

router.get("/api/v1/sales/distance/org/summary", (req, res) => {
  const groups = store.groups.map((g) => {
    const groupReps = store.reps.filter((r) => g.member_ids.includes(r.id));
    const repsRows = groupReps.map((r) => ({ user_id: r.id, user_name: r.name, km: store.distanceByRep[r.id] ?? 0 }));
    const totalKm = repsRows.reduce((s, r) => s + r.km, 0);
    return {
      group_id: g.id, group_name: g.name, color: null,
      total_meters: Math.round(totalKm * 1000), total_km: Math.round(totalKm * 10) / 10,
      active_reps: repsRows.filter((r) => r.km > 0).length, reps: repsRows,
    };
  });
  const totalKm = groups.reduce((s, g) => s + g.total_km, 0);
  return ok(res, {
    from: daysAgo(Number(req.query.days ?? 7)).slice(0, 10),
    to: todayStr(),
    total_km: Math.round(totalKm * 10) / 10,
    active_reps: store.reps.filter((r) => (store.distanceByRep[r.id] ?? 0) > 0).length,
    groups,
  });
});

router.get("/api/v1/sales/distance/users/:userId", (req, res) => {
  const base = store.distanceByRep[req.params.userId] ?? 5;
  const days = Number(req.query.days ?? 7);
  return ok(res, { history: Array.from({ length: days }, (_, i) => distanceDay(Math.max(0, base - i + (i % 2) * 2), i)) });
});

// ---------------------------------------------------------------------------
// Field pins
// ---------------------------------------------------------------------------

router.get("/api/v1/sales/field-pins", (req, res) => {
  let rows = store.fieldPins.slice();
  const { user_id, include_hidden } = req.query;
  if (user_id) rows = rows.filter((p) => p.sales_user_id === user_id);
  if (!include_hidden) rows = rows.filter((p) => p.visible_on_map !== false);
  return ok(res, rows);
});

router.post("/api/v1/sales/field-pins", (req, res) => {
  const me = authUserFrom(req) ?? store.reps[0];
  const b = req.body ?? {};
  const pin = {
    id: uid("pin"), sales_user_id: me.id, latitude: b.lat, longitude: b.lng,
    city: null, source: "client", captured_at: nowIso(),
    name: b.name ?? null, note: b.note ?? null, visible_on_map: b.visible_on_map ?? true,
  };
  store.fieldPins.unshift(pin);
  return ok(res, pin);
});

router.patch("/api/v1/sales/field-pins/:pinId", (req, res) => {
  const pin = store.fieldPins.find((p) => p.id === req.params.pinId);
  if (!pin) return res.status(404).json({ success: false, message: "Pin not found." });
  const b = req.body ?? {};
  if (b.name !== undefined) pin.name = b.name;
  if (b.note !== undefined) pin.note = b.note;
  if (b.visible_on_map !== undefined) pin.visible_on_map = b.visible_on_map;
  return ok(res, pin);
});

router.delete("/api/v1/sales/field-pins/:pinId", (req, res) => {
  store.fieldPins = store.fieldPins.filter((p) => p.id !== req.params.pinId);
  return res.status(204).end();
});

router.delete("/api/v1/sales/field-pins", (req, res) => {
  const userId = (req.body ?? {}).userId;
  const before = store.fieldPins.length;
  store.fieldPins = userId ? store.fieldPins.filter((p) => p.sales_user_id !== userId) : [];
  return ok(res, { cleared: before - store.fieldPins.length, userId: userId ?? "all" });
});

module.exports = { router };
