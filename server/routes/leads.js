/**
 * Leads, pipeline stages, follow-ups, overview/team, analytics, brochure,
 * notifications.
 */
const express = require("express");
const { store, uid, nowIso, daysAgo, daysFromNow, todayStr, initials } = require("../data");
const { authUserFrom } = require("./auth-hcs");

const router = express.Router();
const ok = (res, data) => res.json({ success: true, data });

const leadPublic = ({ timeline, ...lead }) => lead;

function findLead(id) {
  return store.leads.find((l) => l.id === id);
}

// ---------------------------------------------------------------------------
// Leads — literal routes first
// ---------------------------------------------------------------------------

router.get("/api/v1/sales/leads/pipeline", (req, res) => ok(res, buildPipeline(req.query)));

router.get("/api/v1/sales/leads/stats", (req, res) => {
  const active = store.leads.filter((l) => l.stage !== "LOST" && l.stage !== "SUBSCRIPTION_CLOSED");
  const sprints = store.leads.filter((l) => l.stage === "SPRINT_STARTED" || l.stage === "SPRINT_REVIEW");
  const subs = store.leads.filter((l) => l.stage === "SUBSCRIPTION_CLOSED");
  const meetings = store.leads.filter((l) => ["DOCTOR_MEETING", "PITCH_DELIVERED", "HOT_LEADS", "SPRINT_STARTED", "SPRINT_REVIEW", "SUBSCRIPTION_CLOSED"].includes(l.stage));
  const byRep = {};
  for (const l of store.leads) {
    byRep[l.sales_user_id] ??= { sales_user_id: l.sales_user_id, sales_user_name: l.sales_user_name, total_leads: 0, subscriptions_closed: 0, pipeline_value: 0 };
    byRep[l.sales_user_id].total_leads += 1;
    if (l.stage === "SUBSCRIPTION_CLOSED") byRep[l.sales_user_id].subscriptions_closed += 1;
    else if (l.stage !== "LOST") byRep[l.sales_user_id].pipeline_value += l.estimated_value;
  }
  return ok(res, {
    total_leads: store.leads.length,
    pipeline_value: active.reduce((s, l) => s + l.estimated_value, 0),
    active_sprints: sprints.length,
    mrr: subs.reduce((s, l) => s + Math.round(l.estimated_value / 12), 0),
    sales_funnel: { total_leads: store.leads.length, meetings: meetings.length, sprints: sprints.length + subs.length, subscriptions: subs.length },
    conversion_metrics: {
      sprint_conversion_percent: Math.round(((sprints.length + subs.length) / Math.max(1, store.leads.length)) * 100),
      sprints_to_subscriptions_percent: Math.round((subs.length / Math.max(1, sprints.length + subs.length)) * 100),
    },
    top_performers: Object.values(byRep).sort((a, b) => b.pipeline_value - a.pipeline_value).slice(0, 3),
  });
});

router.get("/api/v1/sales/leads/people", (req, res) => {
  const people = store.reps.map((r) => ({
    id: r.id,
    name: r.name,
    initials: initials(r.name),
    active_lead_count: store.leads.filter((l) => l.sales_user_id === r.id && l.stage !== "LOST" && l.stage !== "SUBSCRIPTION_CLOSED").length,
  }));
  return ok(res, { people });
});

router.post("/api/v1/sales/leads/reassign", (req, res) => {
  const { lead_ids = [], to_user_id } = req.body ?? {};
  const target = store.accounts.find((a) => a.id === to_user_id);
  let count = 0;
  for (const id of lead_ids) {
    const lead = findLead(id);
    if (lead && target) {
      lead.sales_user_id = target.id;
      lead.sales_user_name = target.name;
      lead.owner = { id: target.id, name: target.name, initials: initials(target.name) };
      count += 1;
    }
  }
  return ok(res, { reassigned_count: count, to_user_id, to_user_name: target?.name ?? "" });
});

router.post("/api/v1/sales/leads/scan", (req, res) => {
  req.resume();
  req.on("end", () =>
    res.json({ success: true, data: { clinic_name: "Scanned Clinic", doctor_name: "Dr. Scanned Card", phone: "+91 9876512345", specialization: "Dermatology", address: "12 MG Road", email: "scanned@clinic.in" } }),
  );
});

router.get("/api/v1/sales/leads", (req, res) => {
  const { q, stage, city, lead_source, sales_user_id, page = 1, limit = 50 } = req.query;
  let rows = store.leads.slice();
  if (q) rows = rows.filter((l) => (l.clinic_name + l.doctor_name + l.city).toLowerCase().includes(String(q).toLowerCase()));
  if (stage) rows = rows.filter((l) => String(stage).split(",").includes(l.stage));
  if (city) rows = rows.filter((l) => l.city.toLowerCase() === String(city).toLowerCase());
  if (lead_source) rows = rows.filter((l) => l.lead_source === lead_source);
  if (sales_user_id) rows = rows.filter((l) => String(sales_user_id).split(",").includes(l.sales_user_id));
  const p = Number(page), lim = Number(limit);
  return ok(res, {
    total: rows.length, page: p, limit: lim,
    total_pages: Math.max(1, Math.ceil(rows.length / lim)),
    leads: rows.slice((p - 1) * lim, p * lim).map(leadPublic),
  });
});

router.post("/api/v1/sales/leads", (req, res) => {
  const me = authUserFrom(req) ?? store.accounts[0];
  const b = req.body ?? {};
  const ownerId = b.sales_user_id ?? (me.apiRole === "SALES_SUBADMIN" ? me.id : store.reps[0].id);
  const owner = store.accounts.find((a) => a.id === ownerId) ?? store.reps[0];
  const lead = {
    id: uid("lead"),
    sales_user_id: owner.id,
    sales_user_name: owner.name,
    clinic_name: b.clinic_name,
    doctor_name: b.doctor_name,
    specialization: b.specialization ?? "",
    phone: b.phone ?? "",
    monthly_appointments: b.monthly_appointments ?? 0,
    number_of_branches: b.number_of_branches ?? 1,
    address: b.address ?? "",
    area: b.area ?? "",
    city: b.city ?? "",
    lead_source: b.lead_source ?? "field_visit",
    lead_source_label: b.lead_source_label ?? null,
    notes: b.notes ?? "",
    stage: b.stage ?? "NEW_LEADS",
    estimated_value: b.estimated_value ?? 0,
    priority: b.priority ?? "Medium",
    email: b.email ?? null,
    sprint_started_at: null,
    subscription_closed_at: null,
    lost_reason: null,
    lost_note: null,
    stage_changed_at: nowIso(),
    last_activity_at: nowIso(),
    next_action_title: null,
    next_action_due: null,
    owner: { id: owner.id, name: owner.name, initials: initials(owner.name) },
    metadata: {},
    created_at: nowIso(),
    updated_at: nowIso(),
    timeline: [],
  };
  store.leads.unshift(lead);
  const meta = store.subadminMeta[owner.id];
  if (meta) meta.hospitals_added += 1;
  return ok(res, leadPublic(lead));
});

router.get("/api/v1/sales/leads/:id/activities", (req, res) => {
  const lead = findLead(req.params.id);
  if (!lead) return res.status(404).json({ success: false, message: "Lead not found." });
  const activities = lead.timeline
    .slice()
    .reverse()
    .map((t) => ({
      id: t.id, kind: t.kind, lead_id: lead.id, lead_clinic_name: lead.clinic_name,
      city: lead.city, actor_id: t.author.id, actor_name: t.author.name,
      body: t.body, occurred_at: t.created_at,
    }));
  return ok(res, { activities, next_cursor: null });
});

router.post("/api/v1/sales/leads/:id/activities", (req, res) => {
  const lead = findLead(req.params.id);
  if (!lead) return res.status(404).json({ success: false, message: "Lead not found." });
  const me = authUserFrom(req) ?? store.accounts[0];
  const b = req.body ?? {};
  const entry = {
    id: uid("act"), lead_id: lead.id, kind: b.kind ?? "note", body: b.body ?? "",
    author: { id: me.id, name: me.name, initials: initials(me.name) },
    from_stage: null, to_stage: null,
    duration_label: b.duration_label ?? null, tags: b.tags ?? [], meta: null,
    created_at: nowIso(),
  };
  lead.timeline.push(entry);
  lead.last_activity_at = nowIso();
  return ok(res, entry);
});

router.post("/api/v1/sales/leads/:id/voice-note", (req, res) => {
  req.resume();
  req.on("end", () =>
    res.json({ success: true, data: { url: "https://mock-cdn.myteamflow.local/voice-notes/note.webm", duration_seconds: 34 } }),
  );
});

router.patch("/api/v1/sales/leads/:id/stage", (req, res) => {
  const lead = findLead(req.params.id);
  if (!lead) return res.status(404).json({ success: false, message: "Lead not found." });
  const from = lead.stage;
  const to = (req.body ?? {}).stage ?? from;
  lead.stage = to;
  lead.stage_changed_at = nowIso();
  lead.last_activity_at = nowIso();
  if (to === "SPRINT_STARTED" && !lead.sprint_started_at) lead.sprint_started_at = nowIso();
  if (to === "SUBSCRIPTION_CLOSED" && !lead.subscription_closed_at) {
    lead.subscription_closed_at = nowIso();
    const meta = store.subadminMeta[lead.sales_user_id];
    if (meta) meta.hospitals_done += 1;
  }
  lead.timeline.push({
    id: uid("act"), lead_id: lead.id, kind: "stage_change", body: `Moved from ${from} to ${to}`,
    author: lead.owner, from_stage: from, to_stage: to, duration_label: null, tags: [], meta: null,
    created_at: nowIso(),
  });
  return ok(res, leadPublic(lead));
});

router.post("/api/v1/sales/leads/:id/lost", (req, res) => {
  const lead = findLead(req.params.id);
  if (!lead) return res.status(404).json({ success: false, message: "Lead not found." });
  const b = req.body ?? {};
  lead.stage = "LOST";
  lead.lost_reason = b.reason ?? "other";
  lead.lost_note = b.note ?? b.notes ?? null;
  lead.stage_changed_at = nowIso();
  return ok(res, leadPublic(lead));
});

router.post("/api/v1/sales/leads/:id/restore", (req, res) => {
  const lead = findLead(req.params.id);
  if (!lead) return res.status(404).json({ success: false, message: "Lead not found." });
  lead.stage = "NEW_LEADS";
  lead.lost_reason = null;
  lead.lost_note = null;
  lead.stage_changed_at = nowIso();
  return ok(res, leadPublic(lead));
});

router.patch("/api/v1/sales/leads/:id/next-action", (req, res) => {
  const lead = findLead(req.params.id);
  if (!lead) return res.status(404).json({ success: false, message: "Lead not found." });
  const b = req.body ?? {};
  lead.next_action_title = b.title ?? null;
  lead.next_action_due = b.due ?? null;
  return ok(res, leadPublic(lead));
});

router.get("/api/v1/sales/leads/:id", (req, res) => {
  const lead = findLead(req.params.id);
  if (!lead) return res.status(404).json({ success: false, message: "Lead not found." });
  return ok(res, lead);
});

router.put("/api/v1/sales/leads/:id", (req, res) => {
  const lead = findLead(req.params.id);
  if (!lead) return res.status(404).json({ success: false, message: "Lead not found." });
  Object.assign(lead, req.body ?? {}, { updated_at: nowIso() });
  return ok(res, leadPublic(lead));
});

router.delete("/api/v1/sales/leads/:id", (req, res) => {
  store.leads = store.leads.filter((l) => l.id !== req.params.id);
  return res.status(204).end();
});

// ---------------------------------------------------------------------------
// Pipeline builder (used by /leads/pipeline and /super-admin/sales-pipeline)
// ---------------------------------------------------------------------------

function buildPipeline(query = {}) {
  let rows = store.leads.slice();
  if (query.q) rows = rows.filter((l) => (l.clinic_name + l.doctor_name).toLowerCase().includes(String(query.q).toLowerCase()));
  if (query.sales_user_id) rows = rows.filter((l) => l.sales_user_id === query.sales_user_id);
  if (query.with_next_action === "true") rows = rows.filter((l) => l.next_action_title);
  if (query.recency === "stale") rows = rows.filter((l) => Date.now() - new Date(l.last_activity_at).getTime() > 7 * 86400000);
  if (query.stage) {
    const stages = String(query.stage).split(",");
    rows = rows.filter((l) => stages.includes(l.stage));
  }
  const stages = store.pipelineStages.map((s) => {
    const bucket = rows.filter((l) => l.stage === s.name);
    return {
      stage: s.name,
      count: bucket.length,
      total_estimated_value: bucket.reduce((sum, l) => sum + l.estimated_value, 0),
      leads: bucket.map(leadPublic),
      is_custom: !s.is_default,
      color: s.color,
    };
  });
  const open = rows.filter((l) => l.stage !== "LOST" && l.stage !== "SUBSCRIPTION_CLOSED");
  const won = rows.filter((l) => l.stage === "SUBSCRIPTION_CLOSED");
  const lost = rows.filter((l) => l.stage === "LOST");
  return {
    total: rows.length,
    stages,
    metrics: {
      open_pipeline_value: open.reduce((s, l) => s + l.estimated_value, 0),
      weighted_forecast_value: Math.round(open.reduce((s, l) => s + l.estimated_value * 0.4, 0)),
      closed_won_value: won.reduce((s, l) => s + l.estimated_value, 0),
      active_lead_count: open.length,
      won_count: won.length,
      lost_count: lost.length,
    },
  };
}

// ---------------------------------------------------------------------------
// Pipeline stages (super-admin)
// ---------------------------------------------------------------------------

router.get("/api/super-admin/sales-pipeline-stages", (req, res) => ok(res, store.pipelineStages));

router.post("/api/super-admin/sales-pipeline-stages", (req, res) => {
  const b = req.body ?? {};
  const name = String(b.name ?? "CUSTOM_STAGE").toUpperCase().replace(/\s+/g, "_");
  const stage = {
    id: uid("stage"), name, label: b.name ?? name,
    position: b.position ?? store.pipelineStages.length + 1,
    color: b.color ?? "#64748B", is_default: false, is_active: true, created_at: nowIso(),
  };
  store.pipelineStages.push(stage);
  return ok(res, stage);
});

router.put("/api/super-admin/sales-pipeline-stages/reorder", (req, res) => {
  for (const { id, position } of (req.body ?? {}).order ?? []) {
    const stage = store.pipelineStages.find((s) => s.id === id);
    if (stage) stage.position = position;
  }
  store.pipelineStages.sort((a, b) => a.position - b.position);
  return ok(res, null);
});

router.put("/api/super-admin/sales-pipeline-stages/:id", (req, res) => {
  const stage = store.pipelineStages.find((s) => s.id === req.params.id);
  if (!stage) return res.status(404).json({ success: false, message: "Stage not found." });
  const b = req.body ?? {};
  if (b.name) {
    stage.label = b.name;
    if (!stage.is_default) stage.name = String(b.name).toUpperCase().replace(/\s+/g, "_");
  }
  if (b.color) stage.color = b.color;
  if (b.position !== undefined) stage.position = b.position;
  return ok(res, stage);
});

router.delete("/api/super-admin/sales-pipeline-stages/:id", (req, res) => {
  store.pipelineStages = store.pipelineStages.filter((s) => s.id !== req.params.id);
  return res.status(204).end();
});

router.get("/api/super-admin/sales-pipeline", (req, res) => ok(res, buildPipeline(req.query)));

// ---------------------------------------------------------------------------
// Follow-ups — literal routes first
// ---------------------------------------------------------------------------

router.get("/api/v1/sales/follow-ups/calendar", (req, res) => {
  const year = Number(req.query.year ?? new Date().getFullYear());
  const month = Number(req.query.month ?? new Date().getMonth() + 1);
  const calendar = {};
  let total = 0;
  for (const f of store.followUps) {
    const d = new Date(f.follow_up_at);
    if (d.getFullYear() !== year || d.getMonth() + 1 !== month) continue;
    const key = f.follow_up_at.slice(0, 10);
    (calendar[key] ??= []).push({ id: f.id, title: f.title, type: f.type, follow_up_at: f.follow_up_at, status: f.status });
    total += 1;
  }
  return ok(res, { year, month, total, calendar });
});

router.get("/api/v1/sales/follow-ups/upcoming", (req, res) => {
  const days = Number(req.query.days ?? 7);
  const horizon = Date.now() + days * 86400000;
  const upcoming = store.followUps.filter((f) => f.status === "PENDING" && new Date(f.follow_up_at).getTime() <= horizon && new Date(f.follow_up_at).getTime() >= Date.now() - 86400000);
  const overdue = store.followUps.filter((f) => (f.status === "PENDING" || f.status === "MISSED") && new Date(f.follow_up_at).getTime() < Date.now());
  return ok(res, { upcoming, overdue_count: overdue.length, days_window: days });
});

router.get("/api/v1/sales/follow-ups", (req, res) => {
  const { status, type, date, from, to, lead_id, user_id, page = 1, limit = 50 } = req.query;
  let rows = store.followUps.slice();
  if (status) rows = rows.filter((f) => String(status).split(",").includes(f.status));
  if (type) rows = rows.filter((f) => String(type).split(",").includes(f.type));
  if (date) rows = rows.filter((f) => f.follow_up_at.slice(0, 10) === date);
  if (from) rows = rows.filter((f) => f.follow_up_at >= from);
  if (to) rows = rows.filter((f) => f.follow_up_at <= to);
  if (lead_id) rows = rows.filter((f) => f.lead_id === lead_id);
  if (user_id) rows = rows.filter((f) => f.sales_user_id === user_id);
  const p = Number(page), l = Number(limit);
  return ok(res, { total: rows.length, page: p, limit: l, follow_ups: rows.slice((p - 1) * l, p * l) });
});

router.post("/api/v1/sales/follow-ups", (req, res) => {
  const me = authUserFrom(req) ?? store.reps[0];
  const b = req.body ?? {};
  const fu = {
    id: uid("fu"),
    sales_user_id: b.sales_user_id ?? me.id,
    lead_id: b.lead_id ?? null,
    title: b.title,
    description: b.description ?? null,
    follow_up_at: b.follow_up_at,
    type: b.type ?? "CALL",
    status: "PENDING",
    reminder_sent: false,
    completed_at: null,
    created_by: me.id,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  store.followUps.push(fu);
  return ok(res, fu);
});

router.post("/api/v1/sales/follow-ups/:id/complete", (req, res) => {
  const fu = store.followUps.find((f) => f.id === req.params.id);
  if (!fu) return res.status(404).json({ success: false, message: "Follow-up not found." });
  fu.status = "COMPLETED";
  fu.completed_at = nowIso();
  fu.updated_at = nowIso();
  return ok(res, fu);
});

router.get("/api/v1/sales/follow-ups/:id", (req, res) => {
  const fu = store.followUps.find((f) => f.id === req.params.id);
  if (!fu) return res.status(404).json({ success: false, message: "Follow-up not found." });
  return ok(res, fu);
});

router.put("/api/v1/sales/follow-ups/:id", (req, res) => {
  const fu = store.followUps.find((f) => f.id === req.params.id);
  if (!fu) return res.status(404).json({ success: false, message: "Follow-up not found." });
  Object.assign(fu, req.body ?? {}, { updated_at: nowIso() });
  return ok(res, fu);
});

router.delete("/api/v1/sales/follow-ups/:id", (req, res) => {
  store.followUps = store.followUps.filter((f) => f.id !== req.params.id);
  return res.status(204).end();
});

// ---------------------------------------------------------------------------
// Overview (me + team)
// ---------------------------------------------------------------------------

function activityFeed(leadFilter, kinds, limit = 20) {
  const items = [];
  for (const lead of store.leads) {
    if (leadFilter && !leadFilter(lead)) continue;
    for (const t of lead.timeline) {
      if (kinds && kinds.length && !kinds.includes(t.kind)) continue;
      items.push({
        id: t.id, kind: t.kind, lead_id: lead.id, lead_clinic_name: lead.clinic_name,
        city: lead.city, actor_id: t.author.id, actor_name: t.author.name,
        body: t.body, occurred_at: t.created_at,
      });
    }
  }
  items.sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
  return { activities: items.slice(0, limit), next_cursor: null };
}

router.get("/api/v1/sales/me/overview", (req, res) => {
  const me = authUserFrom(req) ?? store.reps[0];
  const myId = me.apiRole === "SALES_SUBADMIN" ? me.id : store.reps[0].id;
  const meta = store.subadminMeta[myId] ?? { target_hospitals: 10, hospitals_added: 5, hospitals_done: 2 };
  const myLeads = store.leads.filter((l) => l.sales_user_id === myId);
  const open = myLeads.filter((l) => l.stage !== "LOST" && l.stage !== "SUBSCRIPTION_CLOSED");
  const dueToday = myLeads.filter((l) => l.next_action_due && l.next_action_due.slice(0, 10) <= todayStr() && l.stage !== "LOST");
  const stale = myLeads.filter((l) => Date.now() - new Date(l.last_activity_at).getTime() > 7 * 86400000 && l.stage !== "LOST" && l.stage !== "SUBSCRIPTION_CLOSED");
  const hot = myLeads.filter((l) => l.stage === "HOT_LEADS");
  const monthStart = new Date();
  monthStart.setDate(1);
  const daysInMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
  const dayOfPeriod = new Date().getDate();
  const completion = Math.round((meta.hospitals_done / Math.max(1, meta.target_hospitals)) * 100);
  const stageCounts = (name) => myLeads.filter((l) => l.stage === name).length;
  return ok(res, {
    user: { id: me.id, name: me.name, initials: initials(me.name), timezone: "Asia/Kolkata" },
    quota: {
      period: "monthly",
      period_start: monthStart.toISOString(),
      period_end: new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).toISOString(),
      day_of_period: dayOfPeriod,
      days_total: daysInMonth,
      days_remaining: daysInMonth - dayOfPeriod,
      target_hospitals: meta.target_hospitals,
      hospitals_done: meta.hospitals_done,
      hospitals_added: meta.hospitals_added,
      completion_pct: completion,
      pace_status: completion >= Math.round((dayOfPeriod / daysInMonth) * 100) ? "on" : "behind",
    },
    today_panel: {
      due_today: { count: dueToday.length, items: dueToday.map((l) => ({ lead_id: l.id, clinic_name: l.clinic_name, next_action_title: l.next_action_title ?? "Follow up", next_action_due: l.next_action_due })) },
      stale_leads: { count: stale.length, items: stale.map((l) => ({ lead_id: l.id, clinic_name: l.clinic_name, stage: l.stage, last_activity_days: Math.floor((Date.now() - new Date(l.last_activity_at).getTime()) / 86400000) })) },
      hot_to_advance: { count: hot.length, value: hot.reduce((s, l) => s + l.estimated_value, 0), items: hot.map((l) => ({ lead_id: l.id, clinic_name: l.clinic_name, estimated_value: l.estimated_value })) },
    },
    kpis: {
      total_leads: { value: myLeads.length },
      open_pipeline: { value: open.reduce((s, l) => s + l.estimated_value, 0) },
      active_sprints: { value: myLeads.filter((l) => l.stage === "SPRINT_STARTED" || l.stage === "SPRINT_REVIEW").length },
      mrr: { value: myLeads.filter((l) => l.stage === "SUBSCRIPTION_CLOSED").reduce((s, l) => s + Math.round(l.estimated_value / 12), 0) },
    },
    funnel: {
      stages: store.pipelineStages.filter((s) => s.name !== "LOST").map((s) => ({ key: s.name, label: s.label, count: stageCounts(s.name) })),
      conversions: [
        { from: "NEW_LEADS", to: "FIRST_CONTACT", pct: 72 },
        { from: "FIRST_CONTACT", to: "DOCTOR_MEETING", pct: 55 },
        { from: "DOCTOR_MEETING", to: "SPRINT_STARTED", pct: 38 },
        { from: "SPRINT_STARTED", to: "SUBSCRIPTION_CLOSED", pct: 61 },
      ],
      bottleneck: "DOCTOR_MEETING",
    },
  });
});

router.get("/api/v1/sales/me/activity", (req, res) => {
  const me = authUserFrom(req) ?? store.reps[0];
  const myId = me.apiRole === "SALES_SUBADMIN" ? me.id : store.reps[0].id;
  const kinds = req.query.kind ? String(req.query.kind).split(",") : null;
  return ok(res, activityFeed((l) => l.sales_user_id === myId, kinds, Number(req.query.limit ?? 20)));
});

router.get("/api/v1/sales/team/overview", (req, res) => {
  const open = store.leads.filter((l) => l.stage !== "LOST" && l.stage !== "SUBSCRIPTION_CLOSED");
  const won = store.leads.filter((l) => l.stage === "SUBSCRIPTION_CLOSED");
  const activeReps = store.reps.filter((r) => r.status === "active");
  const leaderboard = store.reps.map((r, i) => {
    const meta = store.subadminMeta[r.id];
    const repLeads = store.leads.filter((l) => l.sales_user_id === r.id);
    const completion = Math.round((meta.hospitals_done / Math.max(1, meta.target_hospitals)) * 100);
    return {
      rank: 0, user_id: r.id, name: r.name,
      done: meta.hospitals_done, target: meta.target_hospitals,
      completion_pct: completion,
      pace_status: completion >= 50 ? "on" : "behind",
      pipeline_value: repLeads.filter((l) => l.stage !== "LOST" && l.stage !== "SUBSCRIPTION_CLOSED").reduce((s, l) => s + l.estimated_value, 0),
      mrr_contribution: repLeads.filter((l) => l.stage === "SUBSCRIPTION_CLOSED").reduce((s, l) => s + Math.round(l.estimated_value / 12), 0),
    };
  }).sort((a, b) => b.completion_pct - a.completion_pct).map((r, i) => ({ ...r, rank: i + 1 }));
  const atRisk = leaderboard.filter((r) => r.pace_status === "behind").map((r) => ({ user_id: r.user_id, name: r.name, pace_status: "behind", deficit: Math.max(0, r.target - r.done), done: r.done, target: r.target }));
  const stale = store.leads.filter((l) => Date.now() - new Date(l.last_activity_at).getTime() > 7 * 86400000 && l.stage !== "LOST" && l.stage !== "SUBSCRIPTION_CLOSED");
  const staleByRep = {};
  for (const l of stale) staleByRep[l.sales_user_id] = (staleByRep[l.sales_user_id] ?? 0) + 1;
  const hot = store.leads.filter((l) => l.stage === "HOT_LEADS");
  return ok(res, {
    as_of: nowIso(),
    team_kpis: {
      team_leads: { value: store.leads.length },
      open_pipeline: { value: open.reduce((s, l) => s + l.estimated_value, 0) },
      active_sprints: { value: store.leads.filter((l) => l.stage === "SPRINT_STARTED" || l.stage === "SPRINT_REVIEW").length },
      team_mrr: { value: won.reduce((s, l) => s + Math.round(l.estimated_value / 12), 0) },
      active_reps: { active: activeReps.length, total: store.reps.length },
      quota_attainment: { on_track: leaderboard.filter((r) => r.pace_status === "on").length, with_quota: store.reps.length, pct: Math.round((leaderboard.filter((r) => r.pace_status === "on").length / Math.max(1, store.reps.length)) * 100) },
    },
    team_health: {
      reps_at_risk: { count: atRisk.length, items: atRisk },
      stale_team_leads: { count: stale.length, by_rep: Object.entries(staleByRep).map(([user_id, count]) => ({ user_id, name: store.accounts.find((a) => a.id === user_id)?.name ?? "", count })) },
      hot_opportunities: { count: hot.length, value_total: hot.reduce((s, l) => s + l.estimated_value, 0), top: hot.slice(0, 5).map((l) => ({ lead_id: l.id, clinic_name: l.clinic_name, estimated_value: l.estimated_value, rep_name: l.sales_user_name })) },
    },
    leaderboard,
    conversion_by_rep: {
      rows: store.reps.map((r) => ({ user_id: r.id, name: r.name, lead_to_meeting_pct: 40 + (r.id.charCodeAt(6) % 30), meeting_to_sprint_pct: 30 + (r.id.charCodeAt(6) % 25), sprint_to_subscription_pct: 45 + (r.id.charCodeAt(6) % 30) })),
      thresholds: { strong: 60, review: 35 },
    },
  });
});

router.get("/api/v1/sales/team/roster", (req, res) => {
  const { page = 1, limit = 50 } = req.query;
  const rows = store.reps.map((r) => {
    const meta = store.subadminMeta[r.id];
    const repLeads = store.leads.filter((l) => l.sales_user_id === r.id);
    return {
      user_id: r.id, name: r.name, initials: initials(r.name), email: r.email,
      status: r.status === "inactive" ? "INACTIVE" : "ACTIVE",
      is_active_24h: r.lastActiveAt ? Date.now() - new Date(r.lastActiveAt).getTime() < 86400000 : false,
      todays_actions: repLeads.filter((l) => l.next_action_due && l.next_action_due.slice(0, 10) === todayStr()).length,
      hospitals_added: meta.hospitals_added,
      hospitals_done: meta.hospitals_done,
      target: meta.target_hospitals,
      pipeline_value: repLeads.filter((l) => l.stage !== "LOST" && l.stage !== "SUBSCRIPTION_CLOSED").reduce((s, l) => s + l.estimated_value, 0),
    };
  });
  return ok(res, { rows, page: Number(page), limit: Number(limit), total: rows.length });
});

router.get("/api/v1/sales/team/activity", (req, res) => {
  const kinds = req.query.kind ? String(req.query.kind).split(",") : null;
  return ok(res, activityFeed(null, kinds, Number(req.query.limit ?? 30)));
});

router.post("/api/v1/sales/team/export", (req, res) => {
  const format = (req.body ?? {}).format ?? "csv";
  if (format === "json") {
    return ok(res, { exported_at: nowIso(), leads: store.leads.map(leadPublic) });
  }
  const header = "clinic_name,doctor_name,city,stage,estimated_value,owner";
  const rows = store.leads.map((l) => [l.clinic_name, l.doctor_name, l.city, l.stage, l.estimated_value, l.sales_user_name].join(","));
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=team-export.csv");
  return res.send([header, ...rows].join("\n"));
});

router.get("/api/v1/sales/pipeline/health", (req, res) => {
  const stale = store.leads.filter((l) => Date.now() - new Date(l.last_activity_at).getTime() > 7 * 86400000 && l.stage !== "LOST" && l.stage !== "SUBSCRIPTION_CLOSED");
  const won = store.leads.filter((l) => l.stage === "SUBSCRIPTION_CLOSED").length;
  const lost = store.leads.filter((l) => l.stage === "LOST").length;
  return ok(res, {
    stale_leads_count: stale.length,
    conversion_rate_pct: Math.round((won / Math.max(1, won + lost)) * 100),
    at_risk_count: store.leads.filter((l) => l.stage === "HOT_LEADS" && !l.next_action_title).length,
  });
});

router.get("/api/v1/sales/team/performance", (req, res) => {
  const rows = store.reps.map((r) => {
    const act = store.repActuals[r.id];
    const tgt = store.metricTargets[r.id];
    const repLeads = store.leads.filter((l) => l.sales_user_id === r.id);
    const metrics = {};
    for (const key of ["leads", "sprints_done", "sprint_amount", "revenue"]) {
      metrics[key] = { actual: act[key], target: tgt?.[key]?.MONTHLY };
    }
    return {
      user_id: r.id, user_name: r.name, initials: initials(r.name),
      total_leads: repLeads.length,
      closed_won: repLeads.filter((l) => l.stage === "SUBSCRIPTION_CLOSED").length,
      pipeline_value: repLeads.filter((l) => l.stage !== "LOST" && l.stage !== "SUBSCRIPTION_CLOSED").reduce((s, l) => s + l.estimated_value, 0),
      trend_pct: (r.id.charCodeAt(6) % 30) - 10,
      metrics,
    };
  });
  return ok(res, { period: "monthly", rows });
});

router.post("/api/v1/sales/team/broadcast", (req, res) => {
  const me = authUserFrom(req) ?? store.accounts[0];
  const b = req.body ?? {};
  const recipients = b.user_ids?.length ? b.user_ids : store.reps.map((r) => r.id);
  const broadcast = {
    id: uid("bc"),
    type: b.type ?? "ANNOUNCEMENT",
    message: b.message,
    recipients_count: recipients.length,
    read_count: 0,
    sent_at: nowIso(),
    sender_id: me.id,
    sender_name: me.name,
  };
  store.broadcasts.unshift(broadcast);
  return ok(res, { sent_count: recipients.length, recipients, id: broadcast.id, type: broadcast.type, created_at: broadcast.sent_at });
});

router.get("/api/v1/sales/team/broadcasts", (req, res) => {
  const limit = Number(req.query.limit ?? 10);
  return ok(res, { broadcasts: store.broadcasts.slice(0, limit), total: store.broadcasts.length });
});

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

router.get("/api/v1/sales/analytics/win-loss", (req, res) => {
  const period = req.query.period ?? "monthly";
  const won = store.leads.filter((l) => l.stage === "SUBSCRIPTION_CLOSED");
  const lost = store.leads.filter((l) => l.stage === "LOST");
  const reasons = {};
  for (const l of lost) reasons[l.lost_reason ?? "other"] = (reasons[l.lost_reason ?? "other"] ?? 0) + 1;
  const byRep = store.reps.map((r) => {
    const w = won.filter((l) => l.sales_user_id === r.id).length;
    const lo = lost.filter((l) => l.sales_user_id === r.id).length;
    return { user_id: r.id, user_name: r.name, won: w, lost: lo, win_rate: w + lo ? Math.round((w / (w + lo)) * 100) : 0 };
  });
  return ok(res, {
    period,
    from: daysAgo(30),
    to: nowIso(),
    won: won.length,
    lost: lost.length,
    win_rate: Math.round((won.length / Math.max(1, won.length + lost.length)) * 100),
    total_closed: won.length + lost.length,
    total_pipeline: store.leads.filter((l) => l.stage !== "LOST" && l.stage !== "SUBSCRIPTION_CLOSED").reduce((s, l) => s + l.estimated_value, 0),
    avg_days_to_win: 21,
    reasons: Object.entries(reasons).map(([reason, count]) => ({ reason, count })),
    by_rep: byRep,
  });
});

// ---------------------------------------------------------------------------
// Brochure
// ---------------------------------------------------------------------------

router.post("/api/v1/sales/brochure/send", (req, res) => {
  const me = authUserFrom(req) ?? store.reps[0];
  const b = req.body ?? {};
  const digits = String(b.phone ?? "").replace(/\D/g, "");
  const to = digits.startsWith("91") ? `+${digits}` : `${b.country_code ?? "+91"}${digits}`;
  const send = {
    id: uid("brs"),
    message_id: `wamid.${uid("m")}`,
    to,
    lead_id: b.lead_id ?? null,
    note: b.note ?? null,
    delivery_status: "sent",
    provider: "whatsapp",
    sent_at: nowIso(),
    delivered_at: null,
    failed_at: null,
    failure_reason: null,
    sender: { id: me.id, name: me.name },
  };
  store.brochureSends.unshift(send);
  return ok(res, { message_id: send.message_id, to, delivery_status: send.delivery_status, sent_at: send.sent_at, sent_by: send.sender });
});

router.get("/api/v1/sales/brochure/sends", (req, res) => {
  let rows = store.brochureSends.slice();
  const { lead_id, limit = 20, offset = 0 } = req.query;
  if (lead_id) rows = rows.filter((r) => r.lead_id === lead_id);
  // apiRequest endpoint: total must live alongside data at the top level.
  return res.json({ success: true, total: rows.length, data: rows.slice(Number(offset), Number(offset) + Number(limit)) });
});

// ---------------------------------------------------------------------------
// Notifications — literal routes first
// ---------------------------------------------------------------------------

function myNotifications(req) {
  const me = authUserFrom(req) ?? store.accounts[0];
  return store.notifications.filter((n) => n.sales_user_id === me.id);
}

router.get("/api/v1/sales/notifications/count", (req, res) =>
  ok(res, { unread_count: myNotifications(req).filter((n) => !n.is_read).length }),
);

router.patch("/api/v1/sales/notifications/read-all", (req, res) => {
  for (const n of myNotifications(req)) {
    n.is_read = true;
    n.read_at = nowIso();
  }
  return ok(res, { message: "All notifications marked as read." });
});

router.get("/api/v1/sales/notifications", (req, res) => {
  let rows = myNotifications(req);
  const { is_read, page = 1, limit = 30 } = req.query;
  const unread = rows.filter((n) => !n.is_read).length;
  if (is_read !== undefined) rows = rows.filter((n) => String(n.is_read) === String(is_read));
  const p = Number(page), l = Number(limit);
  return ok(res, { total: rows.length, unread_count: unread, page: p, notifications: rows.slice((p - 1) * l, p * l) });
});

router.patch("/api/v1/sales/notifications/:id/read", (req, res) => {
  const n = store.notifications.find((x) => x.id === req.params.id);
  if (!n) return res.status(404).json({ success: false, message: "Notification not found." });
  n.is_read = true;
  n.read_at = nowIso();
  return ok(res, n);
});

router.delete("/api/v1/sales/notifications/:id", (req, res) => {
  store.notifications = store.notifications.filter((n) => n.id !== req.params.id);
  return res.status(204).end();
});

router.delete("/api/v1/sales/notifications", (req, res) => {
  const mine = myNotifications(req);
  const before = req.query.before;
  const toDelete = new Set(mine.filter((n) => !before || n.created_at < before).map((n) => n.id));
  store.notifications = store.notifications.filter((n) => !toDelete.has(n.id));
  return ok(res, { deleted: toDelete.size });
});

module.exports = { router };
