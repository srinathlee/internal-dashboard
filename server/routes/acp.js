/**
 * Accelerator Program routes: /api/v1/sales/acp/*
 */
const express = require("express");
const { store, uid, nowIso, daysAgo, dateOnly } = require("../data");
const { authUserFrom } = require("./auth-hcs");

const router = express.Router();
const ok = (res, data) => res.json({ success: true, data });
const BASE = "/api/v1/sales/acp";

function batchMembers(batchId) {
  return store.acpMembers.filter((m) => m.batch_id === batchId);
}

function batchWire(batch) {
  const members = batchMembers(batch.id);
  const sprintRev = members.reduce((s, m) => s + m.sprint_revenue, 0);
  const subRev = members.reduce((s, m) => s + m.subscription_revenue, 0);
  return {
    id: batch.id,
    name: batch.name,
    location: batch.location,
    active_count: members.filter((m) => m.status === "active").length,
    member_count: members.length,
    total_sprint_rev: sprintRev,
    total_sub_rev: subRev,
    total_revenue: sprintRev + subRev,
    at_risk_count: members.filter((m) => m.tag === "at_risk" || m.tag === "firing_zone").length,
    created_at: batch.created_at,
  };
}

// ---------------------------------------------------------------------------
// Overview / program config
// ---------------------------------------------------------------------------

router.get(`${BASE}/overview`, (req, res) => {
  const members = store.acpMembers;
  const sprintRev = members.reduce((s, m) => s + m.sprint_revenue, 0);
  const subRev = members.reduce((s, m) => s + m.subscription_revenue, 0);
  const sprints = Object.values(store.acpSprints).flat();
  const converted = members.filter((m) => m.tag === "converted").length;
  const top = members.slice().sort((a, b) => (b.sprint_revenue + b.subscription_revenue) - (a.sprint_revenue + a.subscription_revenue))[0] ?? null;
  return ok(res, {
    active_members: members.filter((m) => m.status === "active").length,
    total_members: members.length,
    total_sprints: sprints.length,
    sprint_revenue: sprintRev,
    subscription_revenue: subRev,
    conversion_rate: Math.round((converted / Math.max(1, members.length)) * 100),
    refund_rate: 4,
    top_performer: top ? { id: top.id, name: top.name, total_revenue: top.sprint_revenue + top.subscription_revenue } : null,
  });
});

router.get(`${BASE}/program/config`, (req, res) => ok(res, store.acpProgramConfig));

// ---------------------------------------------------------------------------
// Batches
// ---------------------------------------------------------------------------

router.get(`${BASE}/batches`, (req, res) => ok(res, store.acpBatches.map(batchWire)));

router.post(`${BASE}/batches`, (req, res) => {
  const b = req.body ?? {};
  const batch = { id: uid("batch"), name: b.name, location: b.location, created_at: nowIso() };
  store.acpBatches.push(batch);
  return ok(res, batchWire(batch));
});

router.get(`${BASE}/batches/:batchId/stats`, (req, res) => {
  const members = batchMembers(req.params.batchId);
  const logs = members.flatMap((m) => store.acpDailyLogs[m.id] ?? []);
  const reviewCounts = { working_fine: 0, observation: 0, retrain: 0 };
  for (const m of members) if (m.current_review) reviewCounts[m.current_review] += 1;
  return ok(res, {
    members: { active: members.filter((m) => m.status === "active").length, total: members.length },
    sprints: Object.entries(store.acpSprints).filter(([id]) => members.some((m) => m.id === id)).reduce((s, [, arr]) => s + arr.length, 0),
    sprint_revenue: members.reduce((s, m) => s + m.sprint_revenue, 0),
    subscription_revenue: members.reduce((s, m) => s + m.subscription_revenue, 0),
    top_performers: members
      .slice()
      .sort((a, b) => (b.sprint_revenue + b.subscription_revenue) - (a.sprint_revenue + a.subscription_revenue))
      .slice(0, 3)
      .map((m) => ({ id: m.id, name: m.name, total_revenue: m.sprint_revenue + m.subscription_revenue })),
    fire_list: members.filter((m) => m.tag === "firing_zone" || m.tag === "fired").map((m) => ({ id: m.id, name: m.name, tag: m.tag })),
    review_counts: reviewCounts,
  });
});

router.get(`${BASE}/batches/:batchId/week-view`, (req, res) => {
  const week = Number(req.query.week ?? 1);
  const members = batchMembers(req.params.batchId);
  const weekTitle = store.acpProgramConfig.week_titles.find((w) => w.week === week);
  const days = Array.from({ length: 6 }, (_, d) => {
    const sched = store.acpProgramConfig.day_schedule.find((s) => s.week === week && s.day === d + 1);
    return {
      day: d + 1,
      activity_type: sched?.activity_type ?? "field",
      is_training_day: (sched?.activity_type ?? "field") === "training",
      reps: members.map((m) => ({
        id: m.id,
        name: m.name,
        tag: m.tag,
        latest_review: m.current_review,
        sprint_rev: m.sprint_revenue,
        has_audio: false,
        visited_count: 3 + ((d + m.id.length) % 4),
        sprint_accepted_count: (d + m.id.length) % 2,
      })),
    };
  });
  return ok(res, { week, title: weekTitle?.title ?? `Week ${week}`, subtitle: weekTitle?.subtitle ?? "", days });
});

router.get(`${BASE}/batches/:batchId/members`, (req, res) => ok(res, batchMembers(req.params.batchId)));

router.post(`${BASE}/batches/:batchId/members`, (req, res) => {
  const b = req.body ?? {};
  const batch = store.acpBatches.find((x) => x.id === req.params.batchId);
  if (!batch) return res.status(404).json({ success: false, message: "Batch not found." });
  if (store.acpMembers.some((m) => m.email === b.email)) {
    return res.status(409).json({ success: false, code: "EMAIL_EXISTS", message: "A member with this email already exists." });
  }
  const member = {
    id: uid("acp-m"),
    name: b.name,
    email: b.email,
    phone: b.phone ?? "",
    joined_at: b.joined_at ?? nowIso(),
    ending_at: null,
    tag: "active",
    sprint_revenue: 0,
    subscription_revenue: 0,
    sprint_target: b.sprint_target ?? 10000,
    revenue_target: b.revenue_target ?? 110000,
    lead_count: 0,
    current_review: null,
    batch_id: batch.id,
    batch_name: batch.name,
    status: "active",
    note: "",
    note_updated_at: null,
  };
  store.acpMembers.push(member);
  store.acpDailyLogs[member.id] = [];
  store.acpMessages[member.id] = [];
  store.acpSprints[member.id] = [];
  return ok(res, member);
});

router.get(`${BASE}/batches/:batchId`, (req, res) => {
  const batch = store.acpBatches.find((x) => x.id === req.params.batchId);
  if (!batch) return res.status(404).json({ success: false, message: "Batch not found." });
  return ok(res, batchWire(batch));
});

router.delete(`${BASE}/batches/:batchId`, (req, res) => {
  store.acpBatches = store.acpBatches.filter((b) => b.id !== req.params.batchId);
  store.acpMembers = store.acpMembers.filter((m) => m.batch_id !== req.params.batchId);
  return res.status(204).end();
});

// ---------------------------------------------------------------------------
// Rep-facing (/me) — before /members/:memberId
// ---------------------------------------------------------------------------

function acpMemberForMe(req) {
  const me = authUserFrom(req);
  // Map any logged-in account to the first ACP member so the rep view works.
  return store.acpMembers.find((m) => me && m.email === me.email) ?? store.acpMembers[0];
}

router.get(`${BASE}/me/messages`, (req, res) => {
  const member = acpMemberForMe(req);
  if (!member) return res.status(404).json({ success: false, message: "Not enrolled in the accelerator." });
  return ok(res, (store.acpMessages[member.id] ?? []).slice().sort((a, b) => b.created_at.localeCompare(a.created_at)));
});

router.get(`${BASE}/me/daily-logs`, (req, res) => {
  const member = acpMemberForMe(req);
  if (!member) return res.status(404).json({ success: false, message: "Not enrolled in the accelerator." });
  return ok(res, (store.acpDailyLogs[member.id] ?? []).slice().sort((a, b) => b.date.localeCompare(a.date)));
});

router.post(`${BASE}/me/daily-logs/audio`, (req, res) => {
  const member = acpMemberForMe(req);
  req.resume();
  req.on("end", () => {
    if (!member) return res.status(404).json({ success: false, message: "Not enrolled in the accelerator." });
    const logs = store.acpDailyLogs[member.id] ?? (store.acpDailyLogs[member.id] = []);
    let log = logs.find((l) => l.date === dateOnly(nowIso()));
    if (!log) {
      log = {
        id: uid("acp-log"), member_id: member.id, date: dateOnly(nowIso()),
        week_number: 1, day_in_week: 1, activity_type: "field", note: "",
        visited: [], sprint_accepted: [], sprint_revenue: 0,
        audio_url: null, audio_filename: null, audio_duration: null, admin_review: null,
      };
      logs.unshift(log);
    }
    log.audio_url = "https://mock-cdn.nyraai.local/acp-audio/daily-log.webm";
    log.audio_filename = "daily-log.webm";
    log.audio_duration = "0:42";
    res.json({ success: true, data: log });
  });
});

// ---------------------------------------------------------------------------
// Daily log review
// ---------------------------------------------------------------------------

router.patch(`${BASE}/daily-logs/:logId/review`, (req, res) => {
  const review = (req.body ?? {}).admin_review ?? null;
  for (const logs of Object.values(store.acpDailyLogs)) {
    const log = logs.find((l) => l.id === req.params.logId);
    if (log) {
      log.admin_review = review;
      const member = store.acpMembers.find((m) => m.id === log.member_id);
      if (member) member.current_review = review;
      return ok(res, { updated: true });
    }
  }
  return res.status(404).json({ success: false, message: "Daily log not found." });
});

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------

function findMember(id) {
  return store.acpMembers.find((m) => m.id === id);
}

router.get(`${BASE}/members/:memberId/daily-logs`, (req, res) => {
  const member = findMember(req.params.memberId);
  if (!member) return res.status(404).json({ success: false, message: "Member not found." });
  return ok(res, (store.acpDailyLogs[member.id] ?? []).slice().sort((a, b) => b.date.localeCompare(a.date)));
});

router.get(`${BASE}/members/:memberId/sprints`, (req, res) => {
  const member = findMember(req.params.memberId);
  if (!member) return res.status(404).json({ success: false, message: "Member not found." });
  return ok(res, {
    sprints: store.acpSprints[member.id] ?? [],
    sprint_rev: member.sprint_revenue,
    sub_rev: member.subscription_revenue,
  });
});

router.get(`${BASE}/members/:memberId/messages`, (req, res) => {
  const member = findMember(req.params.memberId);
  if (!member) return res.status(404).json({ success: false, message: "Member not found." });
  return ok(res, (store.acpMessages[member.id] ?? []).slice().sort((a, b) => b.created_at.localeCompare(a.created_at)));
});

router.post(`${BASE}/members/:memberId/messages`, (req, res) => {
  const member = findMember(req.params.memberId);
  if (!member) return res.status(404).json({ success: false, message: "Member not found." });
  const me = authUserFrom(req) ?? store.accounts[0];
  const message = { id: uid("acp-msg"), member_id: member.id, sent_by: me.name, message: (req.body ?? {}).message ?? "", created_at: nowIso() };
  (store.acpMessages[member.id] ??= []).unshift(message);
  return ok(res, { sent: true });
});

router.patch(`${BASE}/members/:memberId/tag`, (req, res) => {
  const member = findMember(req.params.memberId);
  if (!member) return res.status(404).json({ success: false, message: "Member not found." });
  member.tag = (req.body ?? {}).tag ?? member.tag;
  member.status = member.tag === "fired" ? "inactive" : "active";
  return ok(res, { tag: member.tag, status: member.status });
});

router.patch(`${BASE}/members/:memberId/note`, (req, res) => {
  const member = findMember(req.params.memberId);
  if (!member) return res.status(404).json({ success: false, message: "Member not found." });
  member.note = (req.body ?? {}).note ?? "";
  member.note_updated_at = nowIso();
  return ok(res, { note: member.note, note_updated_at: member.note_updated_at });
});

router.patch(`${BASE}/members/:memberId/password`, (req, res) => {
  const member = findMember(req.params.memberId);
  if (!member) return res.status(404).json({ success: false, message: "Member not found." });
  return ok(res, { updated: true });
});

router.get(`${BASE}/members/:memberId`, (req, res) => {
  const member = findMember(req.params.memberId);
  if (!member) return res.status(404).json({ success: false, message: "Member not found." });
  return ok(res, member);
});

router.patch(`${BASE}/members/:memberId`, (req, res) => {
  const member = findMember(req.params.memberId);
  if (!member) return res.status(404).json({ success: false, message: "Member not found." });
  const b = req.body ?? {};
  if (b.email && store.acpMembers.some((m) => m.id !== member.id && m.email === b.email)) {
    return res.status(409).json({ success: false, code: "EMAIL_EXISTS", message: "A member with this email already exists." });
  }
  for (const key of ["name", "email", "phone", "sprint_target", "revenue_target"]) {
    if (b[key] !== undefined) member[key] = b[key];
  }
  return ok(res, member);
});

router.delete(`${BASE}/members/:memberId`, (req, res) => {
  store.acpMembers = store.acpMembers.filter((m) => m.id !== req.params.memberId);
  return res.status(204).end();
});

module.exports = { router };
