/**
 * Scorecard, scoring rule sets, audit log, metric targets (current model),
 * revenue targets (legacy paths that don't collide), target templates,
 * /me/targets snapshot.
 *
 * Colliding paths (/targets, /targets/:userId, /targets/me, /targets/monitor,
 * /targets/bulk) are owned by the module the UI actually uses:
 * - GET /targets            -> scoring model (camelCase ApiTarget[])
 * - GET /targets/monitor    -> metric-targets MonitorBoardResponse
 * - GET /targets/me         -> metric-targets RepMetricDetail
 * - PUT /targets/:userId    -> branches on body shape (values vs target_amount)
 * - POST /targets/bulk      -> branches on body shape (targets vs target_amount)
 */
const express = require("express");
const { store, uid, nowIso, daysAgo, initials } = require("../data");
const { authUserFrom } = require("./auth-hcs");

const router = express.Router();
const ok = (res, data) => res.json({ success: true, data });

const METRIC_KEYS = ["leads", "sprints_done", "sprint_amount", "revenue"];
const PERIODS = ["MONTHLY", "QUARTERLY", "HALF_YEARLY", "YEARLY"];

function periodWindow(period) {
  const now = new Date();
  const year = now.getFullYear();
  let start, end;
  if (period === "MONTHLY") {
    start = new Date(year, now.getMonth(), 1);
    end = new Date(year, now.getMonth() + 1, 0);
  } else if (period === "QUARTERLY") {
    const q = Math.floor(now.getMonth() / 3);
    start = new Date(year, q * 3, 1);
    end = new Date(year, q * 3 + 3, 0);
  } else if (period === "HALF_YEARLY") {
    const h = now.getMonth() < 6 ? 0 : 6;
    start = new Date(year, h, 1);
    end = new Date(year, h + 6, 0);
  } else {
    start = new Date(year, 0, 1);
    end = new Date(year, 11, 31);
  }
  const daysTotal = Math.round((end - start) / 86400000) + 1;
  const daysElapsed = Math.min(daysTotal, Math.max(1, Math.round((now - start) / 86400000) + 1));
  return {
    start: start.toISOString(),
    end: end.toISOString(),
    days_total: daysTotal,
    days_elapsed: daysElapsed,
    days_remaining: daysTotal - daysElapsed,
    elapsed_fraction: Math.round((daysElapsed / daysTotal) * 100) / 100,
  };
}

function metricCell(userId, key, period) {
  const target = store.metricTargets[userId]?.[key]?.[period] ?? 0;
  // Actuals are stored monthly; scale for longer periods.
  const scale = { MONTHLY: 1, QUARTERLY: 2.4, HALF_YEARLY: 4.5, YEARLY: 8 }[period] ?? 1;
  const actual = Math.round((store.repActuals[userId]?.[key] ?? 0) * scale);
  const win = periodWindow(period);
  const progress = target ? Math.round((actual / target) * 100) : null;
  const expected = Math.round(target * win.elapsed_fraction);
  const pace = expected ? Math.round((actual / expected) * 100) : 0;
  let paceStatus;
  if (!target) paceStatus = "UNSET";
  else if (win.elapsed_fraction < 0.1) paceStatus = "JUST_STARTED";
  else if (pace >= 110) paceStatus = "AHEAD";
  else if (pace >= 85) paceStatus = "ON_TRACK";
  else if (pace >= 60) paceStatus = "AT_RISK";
  else paceStatus = "BEHIND";
  const status = !target ? "UNSET" : progress >= 100 ? "ACHIEVED" : pace >= 85 ? "ON_TRACK" : pace >= 60 ? "AT_RISK" : "BEHIND";
  const remaining = Math.max(0, target - actual);
  return {
    target,
    actual,
    progress_pct: progress,
    status,
    pace,
    pace_status: paceStatus,
    expected_by_now: expected,
    remaining_to_target: remaining,
    required_per_day: win.days_remaining ? Math.ceil(remaining / win.days_remaining) : remaining,
    required_per_week: win.days_remaining ? Math.ceil(remaining / Math.max(1, win.days_remaining / 7)) : remaining,
  };
}

function overallForUser(userId, period) {
  const cells = METRIC_KEYS.map((k) => metricCell(userId, k, period));
  const withTarget = cells.filter((c) => c.target > 0);
  const avgPace = withTarget.length ? Math.round(withTarget.reduce((s, c) => s + c.pace, 0) / withTarget.length) : 0;
  let status;
  if (!withTarget.length) status = "UNSET";
  else if (avgPace >= 110) status = "AHEAD";
  else if (avgPace >= 85) status = "ON_TRACK";
  else if (avgPace >= 60) status = "AT_RISK";
  else status = "BEHIND";
  return { status, pace: avgPace };
}

// ---------------------------------------------------------------------------
// Scorecard
// ---------------------------------------------------------------------------

function scorecardBoardFor(userId, periodQuery) {
  const account = store.accounts.find((a) => a.id === userId) ?? store.reps[0];
  const win = periodWindow("MONTHLY");
  const rows = store.scorecardMetrics.map((m) => {
    const target = store.metricTargets[account.id]?.[m.key]?.MONTHLY ?? m.targets[0].target_value;
    const actual = store.repActuals[account.id]?.[m.key] ?? 0;
    const progress = target ? Math.round((actual / target) * 100) : 0;
    const base = Math.round(actual * m.rule.points_per_unit);
    const manual = store.manualPoints.filter((p) => p.userId === account.id && p.metricKey === m.key).reduce((s, p) => s + p.points, 0);
    const bonus = progress >= 100 ? m.rule.bonus_points : 0;
    const status = !target ? "NO_TARGET" : progress >= 100 ? "STRETCH" : progress >= 75 ? "ON_TRACK" : progress >= 45 ? "IN_PROGRESS" : "AT_RISK";
    return {
      metric: { id: m.id, key: m.key, label: m.label, unit: m.unit, is_active: true },
      rule: { points_per_unit: m.rule.points_per_unit, weight_pct: m.rule.weight_pct, bonus_points: m.rule.bonus_points },
      target: { target_value: target, period_type: "MONTHLY" },
      actual_value: actual,
      target_value: target,
      progress_percent: progress,
      status,
      points: { base_points: base, bonus_points: bonus, manual_adjustment_points: manual, total_points: base + bonus + manual, cap_applied: false },
      weighted_score: Math.round((base + bonus + manual) * (m.rule.weight_pct / 100)),
    };
  });
  return {
    user: { id: account.id, name: account.name, email: account.email, status: account.status === "inactive" ? "INACTIVE" : "ACTIVE" },
    period: {
      period_type: "MONTHLY",
      period_key: periodQuery?.period ?? new Date().toISOString().slice(0, 7),
      period_start: win.start,
      period_end: win.end,
    },
    summary: {
      total_points: rows.reduce((s, r) => s + r.points.total_points, 0),
      total_weighted_score: rows.reduce((s, r) => s + r.weighted_score, 0),
      on_track_metrics: rows.filter((r) => r.status === "ON_TRACK" || r.status === "STRETCH").length,
      at_risk_metrics: rows.filter((r) => r.status === "AT_RISK").length,
    },
    rows,
  };
}

router.get("/api/v1/sales/scorecard/me/board", (req, res) => {
  const me = authUserFrom(req);
  const userId = me && me.apiRole === "SALES_SUBADMIN" ? me.id : (req.query.user_id ?? store.reps[0].id);
  return ok(res, scorecardBoardFor(userId, req.query));
});

router.get("/api/v1/sales/scorecard/users/:userId/board", (req, res) =>
  ok(res, scorecardBoardFor(req.params.userId, req.query)),
);

router.get("/api/v1/sales/scorecard/leaderboard", (req, res) => {
  const includeInactive = req.query.include_inactive_users === "true";
  const users = store.reps.filter((r) => includeInactive || r.status === "active");
  const boards = users.map((r) => scorecardBoardFor(r.id, req.query));
  const leaderboard = boards
    .map((b) => ({
      rank: 0,
      user_id: b.user.id,
      name: b.user.name,
      total_points: b.summary.total_points,
      total_weighted_score: b.summary.total_weighted_score,
      on_track_metrics: b.summary.on_track_metrics,
      at_risk_metrics: b.summary.at_risk_metrics,
    }))
    .sort((a, b) => b.total_points - a.total_points)
    .map((r, i) => ({ ...r, rank: i + 1 }));
  return ok(res, { period: boards[0]?.period ?? {}, total_users: leaderboard.length, leaderboard });
});

router.get("/api/v1/sales/scorecard/team/board", (req, res) => {
  const boards = store.reps.map((r) => scorecardBoardFor(r.id, req.query));
  return ok(res, {
    period: boards[0]?.period ?? {},
    users: boards.map((b) => ({
      user_id: b.user.id,
      name: b.user.name,
      total_points: b.summary.total_points,
      total_weighted_score: b.summary.total_weighted_score,
      metrics: b.rows,
    })),
  });
});

router.get("/api/v1/sales/scorecard/config", (req, res) =>
  ok(res, { generated_at: nowIso(), rule_set_version: 2, metrics: store.scorecardMetrics }),
);

router.put("/api/v1/sales/scorecard/config", (req, res) => {
  const patch = (req.body ?? {}).metrics ?? [];
  for (const p of patch) {
    const metric = store.scorecardMetrics.find((m) => m.key === p.key);
    if (!metric) continue;
    if (p.label) metric.label = p.label;
    if (p.is_active !== undefined) metric.is_active = p.is_active;
    if (p.display_order !== undefined) metric.display_order = p.display_order;
    if (p.rule) Object.assign(metric.rule, p.rule);
    if (p.target) {
      const t = metric.targets.find((x) => x.user_id === (p.target.user_id ?? null));
      if (t && p.target.target_value !== undefined) t.target_value = p.target.target_value;
      else if (p.target.target_value !== undefined) {
        metric.targets.push({ id: uid("tgt"), user_id: p.target.user_id ?? null, target_value: p.target.target_value, period_type: p.target.period_type ?? "MONTHLY", is_default: p.target.is_default ?? false });
      }
    }
  }
  return ok(res, { generated_at: nowIso(), rule_set_version: 2, metrics: store.scorecardMetrics });
});

router.post("/api/v1/sales/scorecard/adjustments", (req, res) => {
  const b = req.body ?? {};
  const me = authUserFrom(req) ?? store.accounts[0];
  const entry = {
    id: uid("mp"),
    userId: b.user_id,
    metricId: b.metric_id ?? `metric-${b.metric_key ?? "leads"}`,
    metricKey: b.metric_key ?? (b.metric_id ?? "").replace("metric-", "") ?? "leads",
    points: b.points,
    reason: b.reason,
    refType: b.ref_type ?? null,
    refId: b.ref_id ?? null,
    createdBy: { id: me.id, name: me.name },
    occurredAt: b.occurred_at ?? nowIso(),
    createdAt: nowIso(),
  };
  store.manualPoints.unshift(entry);
  return ok(res, entry);
});

// ---------------------------------------------------------------------------
// Scoring rule sets + manual points
// ---------------------------------------------------------------------------

router.get("/api/v1/sales/scoring-rule-sets/live", (req, res) =>
  ok(res, store.scoringRuleSets.find((r) => r.isLive) ?? store.scoringRuleSets[0]),
);

router.get("/api/v1/sales/scoring-rule-sets", (req, res) => ok(res, store.scoringRuleSets));

router.post("/api/v1/sales/scoring-rule-sets", (req, res) => {
  const version = Math.max(...store.scoringRuleSets.map((r) => r.version)) + 1;
  for (const r of store.scoringRuleSets) r.isLive = false;
  const rules = ((req.body ?? {}).rules ?? []).map((r, i) => ({
    id: uid("rule"),
    metric_id: `metric-${r.systemId}`,
    rule_set_version: version,
    points_per_unit: r.pointsPerUnit ?? 10,
    cap_per_period: r.cap ?? null,
    bonus_points: r.bonusPoints ?? 0,
    bonus_on_target_pct: r.bonusAtTargetPct ?? 100,
    weight_pct: r.weight ?? 25,
    min_floor: r.floor ?? null,
    stretch_target: r.stretch ?? null,
    effective_from: nowIso(),
    effective_to: null,
  }));
  const set = { id: uid("rs"), teamId: "sales", version, isLive: true, appliedAt: nowIso(), rules };
  store.scoringRuleSets.unshift(set);
  return ok(res, set);
});

router.post("/api/v1/sales/scoring-rule-sets/:versionId/restore", (req, res) => {
  const source = store.scoringRuleSets.find((r) => String(r.version) === String(req.params.versionId) || r.id === req.params.versionId);
  if (!source) return res.status(404).json({ success: false, message: "Rule set version not found." });
  const version = Math.max(...store.scoringRuleSets.map((r) => r.version)) + 1;
  for (const r of store.scoringRuleSets) r.isLive = false;
  const set = { ...source, id: uid("rs"), version, isLive: true, appliedAt: nowIso(), restoredFrom: source.version };
  store.scoringRuleSets.unshift(set);
  return ok(res, set);
});

router.get("/api/v1/sales/manual-points", (req, res) => {
  let rows = store.manualPoints.slice();
  const { userId, from, to } = req.query;
  if (userId) rows = rows.filter((p) => p.userId === userId);
  if (from) rows = rows.filter((p) => p.occurredAt >= from);
  if (to) rows = rows.filter((p) => p.occurredAt <= to);
  return ok(res, rows);
});

router.delete("/api/v1/sales/manual-points/:id", (req, res) => {
  const entry = store.manualPoints.find((p) => p.id === req.params.id);
  if (!entry) return res.status(404).json({ success: false, message: "Entry not found." });
  const reversal = { ...entry, id: uid("mp"), points: -entry.points, reason: `Reversal of: ${entry.reason}`, createdAt: nowIso(), occurredAt: nowIso() };
  store.manualPoints.unshift(reversal);
  return ok(res, { originalId: entry.id, reversalId: reversal.id, points: reversal.points });
});

// ---------------------------------------------------------------------------
// Audit log (apiRequest — raw envelope with data + meta at top level)
// ---------------------------------------------------------------------------

router.get("/api/v1/sales/audit-log", (req, res) => {
  let rows = store.auditLog.slice();
  const { actorId, action, from, to, limit = 10, cursor = 0 } = req.query;
  if (actorId) rows = rows.filter((r) => r.actorId === actorId);
  if (action) rows = rows.filter((r) => r.action === action);
  if (from) rows = rows.filter((r) => r.timestamp >= from);
  if (to) rows = rows.filter((r) => r.timestamp <= to);
  const start = Number(cursor);
  const l = Number(limit);
  const page = rows.slice(start, start + l);
  const next = start + l < rows.length ? start + l : null;
  return res.json({ data: page, meta: { total: rows.length, nextCursor: next } });
});

// ---------------------------------------------------------------------------
// Metric targets — literal routes before /targets/:userId
// ---------------------------------------------------------------------------

router.get("/api/v1/sales/targets/metrics", (req, res) => ok(res, { metrics: store.metricCatalogue }));

function monitorBoard(query = {}) {
  const period = PERIODS.includes(query.period) ? query.period : "MONTHLY";
  const win = periodWindow(period);
  let repsRows = store.reps.slice();
  if (query.search) repsRows = repsRows.filter((r) => r.name.toLowerCase().includes(String(query.search).toLowerCase()));
  if (query.user_ids) {
    const ids = String(query.user_ids).split(",");
    repsRows = repsRows.filter((r) => ids.includes(r.id));
  }
  let rows = repsRows.map((r) => {
    const overall = overallForUser(r.id, period);
    const metrics = {};
    for (const key of METRIC_KEYS) metrics[key] = metricCell(r.id, key, period);
    return {
      user: { id: r.id, name: r.name, initials: initials(r.name), role: r.surfaceRole },
      overall_status: overall.status,
      overall_pace: overall.pace,
      metrics,
    };
  });
  const tallies = { behind: 0, at_risk: 0, on_track: 0, ahead: 0, just_started: 0, unset: 0, total: rows.length };
  for (const row of rows) {
    const key = row.overall_status.toLowerCase();
    if (key in tallies) tallies[key] += 1;
  }
  if (query.status) {
    const wanted = String(query.status).split(",");
    rows = rows.filter((r) => wanted.includes(r.overall_status));
  }
  return { period, ...win, tallies, rows };
}

router.get("/api/v1/sales/targets/monitor/:userId", (req, res) => {
  const account = store.accounts.find((a) => a.id === req.params.userId);
  if (!account) return res.status(404).json({ success: false, message: "User not found." });
  const periods = {};
  const metrics = {};
  for (const p of PERIODS) {
    const win = periodWindow(p);
    periods[p] = { start: win.start, end: win.end, days_total: win.days_total, days_elapsed: win.days_elapsed, days_remaining: win.days_remaining, elapsed_fraction: win.elapsed_fraction };
  }
  for (const key of METRIC_KEYS) {
    metrics[key] = {};
    for (const p of PERIODS) metrics[key][p] = metricCell(account.id, key, p);
  }
  return ok(res, { user: { id: account.id, name: account.name, initials: initials(account.name), role: account.surfaceRole }, as_of: nowIso(), periods, metrics });
});

router.get("/api/v1/sales/targets/monitor", (req, res) => ok(res, monitorBoard(req.query)));

router.get("/api/v1/sales/targets/me", (req, res) => {
  const me = authUserFrom(req);
  const userId = me && me.apiRole === "SALES_SUBADMIN" ? me.id : store.reps[0].id;
  const periods = {};
  const metrics = {};
  for (const p of PERIODS) {
    const win = periodWindow(p);
    periods[p] = { start: win.start, end: win.end, days_total: win.days_total, days_elapsed: win.days_elapsed, days_remaining: win.days_remaining, elapsed_fraction: win.elapsed_fraction };
  }
  for (const key of METRIC_KEYS) {
    metrics[key] = {};
    for (const p of PERIODS) metrics[key][p] = metricCell(userId, key, p);
  }
  const account = store.accounts.find((a) => a.id === userId);
  return ok(res, { user: { id: userId, name: account?.name ?? "", initials: initials(account?.name ?? "R"), role: "member" }, as_of: nowIso(), periods, metrics });
});

router.get("/api/v1/sales/targets/reps", (req, res) =>
  ok(res, store.reps.map((r) => ({ id: r.id, name: r.name, initials: initials(r.name), role: r.surfaceRole, is_active: r.status === "active" }))),
);

router.get("/api/v1/sales/targets/assign/:userId", (req, res) => {
  const account = store.accounts.find((a) => a.id === req.params.userId);
  if (!account) return res.status(404).json({ success: false, message: "User not found." });
  return ok(res, {
    user: { id: account.id, name: account.name, initials: initials(account.name) },
    targets: store.metricTargets[account.id] ?? {},
    updated_at: daysAgo(3),
  });
});

router.put("/api/v1/sales/targets/assign/:userId", (req, res) => {
  const account = store.accounts.find((a) => a.id === req.params.userId);
  if (!account) return res.status(404).json({ success: false, message: "User not found." });
  const patch = (req.body ?? {}).targets ?? {};
  const targets = (store.metricTargets[account.id] ??= {});
  let changed = 0;
  for (const [key, byPeriod] of Object.entries(patch)) {
    targets[key] ??= {};
    for (const [period, value] of Object.entries(byPeriod ?? {})) {
      targets[key][period] = value;
      changed += 1;
    }
  }
  return ok(res, {
    user: { id: account.id, name: account.name, initials: initials(account.name) },
    targets,
    updated_at: nowIso(),
    changed_count: changed,
  });
});

router.post("/api/v1/sales/targets/bulk", (req, res) => {
  const b = req.body ?? {};
  if (b.targets) {
    // metric-targets bulk
    let changed = 0;
    for (const userId of b.user_ids ?? []) {
      const targets = (store.metricTargets[userId] ??= {});
      for (const [key, byPeriod] of Object.entries(b.targets)) {
        targets[key] ??= {};
        for (const [period, value] of Object.entries(byPeriod ?? {})) {
          targets[key][period] = value;
          changed += 1;
        }
      }
    }
    return ok(res, { updated_user_count: (b.user_ids ?? []).length, changed_count: changed });
  }
  // legacy revenue bulk
  const ids = b.user_ids?.length ? b.user_ids : store.reps.filter((r) => r.status === "active").map((r) => r.id);
  return ok(res, { period: b.period ?? "MONTHLY", target_amount: b.target_amount ?? 0, applied_to: ids.length, skipped: [] });
});

router.get("/api/v1/sales/targets/me/period/:period", (req, res) => {
  const period = req.params.period;
  const win = periodWindow(period === "DAILY" || period === "WEEKLY" ? "MONTHLY" : period);
  return ok(res, {
    period,
    target_amount: 110000,
    actual_amount: 45000,
    progress_pct: 41,
    status: "AT_RISK",
    period_start: win.start,
    period_end: win.end,
    daily_breakdown: Array.from({ length: 7 }, (_, i) => ({ date: daysAgo(6 - i).slice(0, 10), amount: [0, 5000, 12000, 0, 8000, 11000, 9000][i] })),
    contributing_leads: store.leads.filter((l) => l.stage === "SUBSCRIPTION_CLOSED").slice(0, 3).map((l) => ({ lead_id: l.id, clinic_name: l.clinic_name, closed_at: l.subscription_closed_at, amount: l.estimated_value })),
  });
});

router.get("/api/v1/sales/targets/me/history", (req, res) => {
  const period = req.query.period ?? "MONTHLY";
  const limit = Number(req.query.limit ?? 6);
  return ok(res, {
    period,
    history: Array.from({ length: limit }, (_, i) => {
      const target = 110000;
      const actual = [45000, 122000, 98000, 130000, 76000, 105000][i % 6];
      const pct = Math.round((actual / target) * 100);
      return {
        period_key: new Date(Date.now() - i * 30 * 86400000).toISOString().slice(0, 7),
        period_start: daysAgo(30 * (i + 1)),
        period_end: daysAgo(30 * i),
        target_amount: target,
        actual_amount: actual,
        progress_pct: pct,
        status: pct >= 100 ? "ACHIEVED" : pct >= 70 ? "ON_TRACK" : pct >= 40 ? "AT_RISK" : "BEHIND",
      };
    }),
  });
});

// GET /targets — scoring model (camelCase ApiTarget[])
router.get("/api/v1/sales/targets", (req, res) => {
  const { userId, period } = req.query;
  const rows = [];
  for (const [uidKey, byMetric] of Object.entries(store.metricTargets)) {
    if (userId && uidKey !== userId) continue;
    for (const [key, byPeriod] of Object.entries(byMetric)) {
      for (const [p, value] of Object.entries(byPeriod)) {
        if (period && p !== period) continue;
        rows.push({
          id: `t-${uidKey}-${key}-${p}`,
          userId: uidKey,
          metricId: `metric-${key}`,
          metricKey: key,
          periodType: p,
          targetValue: value,
          isDefault: false,
          periodKey: null,
          createdAt: daysAgo(30),
          updatedAt: daysAgo(3),
        });
      }
    }
  }
  return ok(res, rows);
});

// DELETE /targets/:userId/:period — legacy revenue delete
router.delete("/api/v1/sales/targets/:userId/:period", (req, res) => res.status(204).end());

// GET /targets/:userId — legacy revenue RepTargets
router.get("/api/v1/sales/targets/:userId", (req, res) => {
  const account = store.accounts.find((a) => a.id === req.params.userId);
  if (!account) return res.status(404).json({ success: false, message: "User not found." });
  const monthly = store.metricTargets[account.id]?.revenue?.MONTHLY ?? 110000;
  return ok(res, {
    user: { id: account.id, name: account.name },
    targets: {
      MONTHLY: { id: `rt-${account.id}-m`, target_amount: monthly, currency: "INR", effective_from: daysAgo(30) },
      QUARTERLY: { id: `rt-${account.id}-q`, target_amount: monthly * 3, currency: "INR", effective_from: daysAgo(30) },
      YEARLY: null,
      WEEKLY: null,
      DAILY: null,
    },
  });
});

// PUT /targets/:userId — branch: scoring {values} vs revenue {target_amount}
router.put("/api/v1/sales/targets/:userId", (req, res) => {
  const b = req.body ?? {};
  if (b.values) {
    const period = String(req.query.period ?? "monthly").toUpperCase();
    const targets = (store.metricTargets[req.params.userId] ??= {});
    for (const [key, value] of Object.entries(b.values)) {
      targets[key] ??= {};
      targets[key][period] = value;
    }
    return ok(res, { userId: req.params.userId, period: String(req.query.period ?? "monthly"), values: b.values });
  }
  const account = store.accounts.find((a) => a.id === req.params.userId);
  return ok(res, {
    id: uid("rt"),
    user_id: req.params.userId,
    user_name: account?.name ?? "",
    period: b.period ?? "MONTHLY",
    target_amount: b.target_amount ?? 0,
    currency: b.currency ?? "INR",
    effective_from: nowIso(),
    effective_to: null,
    created_by: { id: "u-admin-1", name: "Anita Rao" },
    created_at: nowIso(),
    updated_at: nowIso(),
  });
});

// ---------------------------------------------------------------------------
// /me/targets — rep snapshot (currency values in paise)
// ---------------------------------------------------------------------------

router.get("/api/v1/sales/me/targets", (req, res) => {
  const me = authUserFrom(req);
  const userId = me && me.apiRole === "SALES_SUBADMIN" ? me.id : store.reps[0].id;
  const account = store.accounts.find((a) => a.id === userId);
  const catalogue = {
    leads: { title: "Leads Added", subtitle: "New clinics added", icon: "users", unit: "count" },
    sprints_done: { title: "Sprints Done", subtitle: "Sprints completed", icon: "hash", unit: "count" },
    sprint_amount: { title: "Sprint Amount", subtitle: "Sprint revenue booked", icon: "wallet", unit: "currency" },
    revenue: { title: "Revenue", subtitle: "Subscription revenue", icon: "rupee", unit: "currency" },
  };
  const periods = {};
  for (const [pKey, apiPeriod] of [["monthly", "MONTHLY"], ["quarterly", "QUARTERLY"], ["half_yearly", "HALF_YEARLY"], ["yearly", "YEARLY"]]) {
    const win = periodWindow(apiPeriod);
    periods[pKey] = {
      period_start: win.start,
      period_end: win.end,
      days_total: win.days_total,
      days_elapsed: win.days_elapsed,
      days_remaining: win.days_remaining,
      metrics: METRIC_KEYS.map((key) => {
        const cell = metricCell(userId, key, apiPeriod);
        const meta = catalogue[key];
        const isCurrency = meta.unit === "currency";
        const factor = isCurrency ? 100 : 1; // paise on the wire
        const status = cell.pace_status === "AHEAD" ? "ahead" : cell.pace_status === "ON_TRACK" ? "on_track" : cell.pace_status === "AT_RISK" ? "at_risk" : "behind";
        return {
          key,
          title: meta.title,
          subtitle: meta.subtitle,
          icon: meta.icon,
          actual: cell.actual * factor,
          target: cell.target * factor,
          status,
          unit: meta.unit,
          ...(isCurrency ? { currency: "INR" } : {}),
        };
      }),
    };
  }
  return ok(res, { user: { id: userId, name: account?.name ?? "", role_label: "Sales Rep" }, generated_at: nowIso(), periods });
});

// ---------------------------------------------------------------------------
// Target templates
// ---------------------------------------------------------------------------

router.get("/api/v1/sales/target-templates", (req, res) => ok(res, { templates: store.targetTemplates }));

router.post("/api/v1/sales/target-templates", (req, res) => {
  const b = req.body ?? {};
  const template = {
    id: uid("tpl"),
    name: b.name,
    description: b.description ?? null,
    icon: b.icon ?? null,
    color: b.color ?? null,
    is_default: false,
    targets: b.targets ?? {},
    created_by: "u-admin-1",
    created_at: nowIso(),
  };
  store.targetTemplates.push(template);
  return ok(res, template);
});

router.get("/api/v1/sales/target-templates/:id", (req, res) => {
  const t = store.targetTemplates.find((x) => x.id === req.params.id);
  if (!t) return res.status(404).json({ success: false, message: "Template not found." });
  return ok(res, t);
});

router.patch("/api/v1/sales/target-templates/:id", (req, res) => {
  const t = store.targetTemplates.find((x) => x.id === req.params.id);
  if (!t) return res.status(404).json({ success: false, message: "Template not found." });
  Object.assign(t, req.body ?? {});
  return ok(res, t);
});

router.put("/api/v1/sales/target-templates/:id", (req, res) => {
  const t = store.targetTemplates.find((x) => x.id === req.params.id);
  if (!t) return res.status(404).json({ success: false, message: "Template not found." });
  Object.assign(t, req.body ?? {});
  return ok(res, t);
});

router.delete("/api/v1/sales/target-templates/:id", (req, res) => {
  store.targetTemplates = store.targetTemplates.filter((t) => t.id !== req.params.id);
  return res.status(204).end();
});

module.exports = { router };
