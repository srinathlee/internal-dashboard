/**
 * Auth (/api/auth/*) + hospital-management routes:
 * users, branches, hospitals, subscriptions, payment gateway, upload, teams.
 */
const express = require("express");
const { store, uid, nowIso, daysAgo, daysFromNow, makeJwt } = require("../data");

const router = express.Router();
const ok = (res, data) => res.json({ success: true, data });

function authUserFrom(req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (token && store.sessions[token]) {
    return store.accounts.find((a) => a.id === store.sessions[token]) ?? null;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

router.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    return res.status(400).json({ success: false, message: "Email and password are required." });
  }
  // Match a seeded account by email; any password works. Unknown emails log
  // in as the super admin so the dashboard is always reachable with dummy data.
  let account =
    store.accounts.find((a) => a.email.toLowerCase() === String(email).toLowerCase()) ??
    store.accounts[0];
  const token = makeJwt(account);
  const refreshToken = `refresh-${token.slice(-24)}`;
  store.sessions[token] = account.id;
  store.sessions[refreshToken] = account.id;
  account.lastActiveAt = nowIso();
  return ok(res, {
    user: publicUser(account),
    token,
    refreshToken,
  });
});

router.get("/api/auth/me", (req, res) => {
  const account = authUserFrom(req);
  if (!account) return res.status(401).json({ success: false, message: "Not authenticated." });
  return ok(res, { user: publicUser(account) });
});

router.post("/api/auth/refresh", (req, res) => {
  const { refreshToken } = req.body ?? {};
  const accountId = refreshToken && store.sessions[refreshToken];
  const account = store.accounts.find((a) => a.id === accountId);
  if (!account) return res.status(401).json({ success: false, message: "Invalid refresh token." });
  const token = makeJwt(account);
  store.sessions[token] = account.id;
  return ok(res, { token, refreshToken });
});

function publicUser(account) {
  return {
    id: account.id,
    name: account.name,
    email: account.email,
    role: account.apiRole,
    teamId: account.teamId,
    status: account.status,
    phone: account.phone,
    joinedAt: account.joinedAt,
    lastActiveAt: account.lastActiveAt,
  };
}

// ---------------------------------------------------------------------------
// Hospital users (/api/users)
// ---------------------------------------------------------------------------

router.get("/api/users", (req, res) => {
  const { hospital_id } = req.query;
  const users = store.hospitalUsers.filter((u) => !hospital_id || u.hospital_id === hospital_id);
  return ok(res, { users });
});

router.post("/api/users/hospital-admin", (req, res) => {
  const b = req.body ?? {};
  const user = { id: uid("hu"), name: b.name, email: b.email, phone: b.phone, role: "HOSPITAL_ADMIN", hospital_id: b.hospital_id, branch_id: null, status: "active", created_at: nowIso() };
  store.hospitalUsers.push(user);
  return ok(res, user);
});

router.post("/api/users/branch-admin", (req, res) => {
  const b = req.body ?? {};
  const user = { id: uid("hu"), name: b.name, email: b.email, phone: b.phone, role: "BRANCH_ADMIN", hospital_id: b.hospital_id, branch_id: b.branch_id, status: b.status ?? "active", created_at: nowIso() };
  store.hospitalUsers.push(user);
  return ok(res, user);
});

router.post("/api/users/staff", (req, res) => {
  const b = req.body ?? {};
  const user = { id: uid("hu"), ...b, status: b.status ?? "active", created_at: nowIso() };
  store.hospitalUsers.push(user);
  return ok(res, user);
});

router.get("/api/users/:id", (req, res) => {
  const user = store.hospitalUsers.find((u) => u.id === req.params.id);
  if (!user) return res.status(404).json({ success: false, message: "User not found." });
  return ok(res, { user });
});

router.put("/api/users/:id", (req, res) => {
  const user = store.hospitalUsers.find((u) => u.id === req.params.id);
  if (!user) return res.status(404).json({ success: false, message: "User not found." });
  Object.assign(user, req.body ?? {}, { updated_at: nowIso() });
  if (typeof user.status === "string") user.status = user.status.toLowerCase();
  return ok(res, user);
});

router.delete("/api/users/:id", (req, res) => {
  store.hospitalUsers = store.hospitalUsers.filter((u) => u.id !== req.params.id);
  return res.status(204).end();
});

// ---------------------------------------------------------------------------
// Branches
// ---------------------------------------------------------------------------

router.get("/api/branches", (req, res) => {
  const { hospital_id } = req.query;
  return ok(res, { branches: store.branches.filter((b) => !hospital_id || b.hospital_id === hospital_id) });
});

router.post("/api/branches", (req, res) => {
  const b = req.body ?? {};
  const branch = { id: uid("br"), hospital_id: b.hospital_id, name: b.name, address: b.address ?? null, phone: b.phone ?? null, email: b.email ?? null, timezone: b.timezone ?? "Asia/Kolkata", status: "ACTIVE" };
  store.branches.push(branch);
  return ok(res, branch);
});

router.put("/api/branches/:id/operating-hours", (req, res) => {
  const branch = store.branches.find((b) => b.id === req.params.id);
  if (!branch) return res.status(404).json({ success: false, message: "Branch not found." });
  branch.operating_hours = (req.body ?? {}).operating_hours ?? {};
  return ok(res, branch);
});

router.put("/api/branches/:id", (req, res) => {
  const branch = store.branches.find((b) => b.id === req.params.id);
  if (!branch) return res.status(404).json({ success: false, message: "Branch not found." });
  Object.assign(branch, req.body ?? {});
  return ok(res, branch);
});

router.delete("/api/branches/:id", (req, res) => {
  store.branches = store.branches.filter((b) => b.id !== req.params.id);
  return res.status(204).end();
});

// ---------------------------------------------------------------------------
// Hospitals
// ---------------------------------------------------------------------------

router.get("/api/hospitals", (req, res) => {
  const { q, city, page = 1, limit = 20 } = req.query;
  let rows = store.hospitals.slice();
  if (q) rows = rows.filter((h) => h.name.toLowerCase().includes(String(q).toLowerCase()));
  if (city) rows = rows.filter((h) => (h.location ?? []).join(",").toLowerCase().includes(String(city).toLowerCase()));
  const p = Number(page), l = Number(limit);
  const paged = rows.slice((p - 1) * l, p * l);
  return ok(res, { total: rows.length, page: p, limit: l, total_pages: Math.max(1, Math.ceil(rows.length / l)), hospitals: paged });
});

router.post("/api/hospitals", (req, res) => {
  const b = req.body ?? {};
  const hospital = {
    id: uid("hosp"),
    name: b.name,
    email: b.email ?? null,
    phone: b.phone ?? null,
    emergency_phone: b.emergency_phone ?? null,
    location: b.location ?? null,
    address: b.address ?? null,
    timezone: b.timezone ?? "Asia/Kolkata",
    currency: b.currency ?? "INR",
    hospital_image_url: b.hospital_image_url ?? null,
    hospital_type: b.hospital_type ?? [],
    status: "ACTIVE",
    created_at: nowIso(),
  };
  store.hospitals.push(hospital);
  return ok(res, hospital);
});

router.get("/api/hospitals/:id", (req, res) => {
  const hospital = store.hospitals.find((h) => h.id === req.params.id);
  if (!hospital) return res.status(404).json({ success: false, message: "Hospital not found." });
  return ok(res, { hospital });
});

router.put("/api/hospitals/:id/image", (req, res) => {
  const hospital = store.hospitals.find((h) => h.id === req.params.id);
  if (!hospital) return res.status(404).json({ success: false, message: "Hospital not found." });
  hospital.hospital_image_url = (req.body ?? {}).hospital_image_url ?? null;
  return ok(res, { message: "Image updated", hospital: { id: hospital.id, name: hospital.name, hospital_image_url: hospital.hospital_image_url } });
});

router.delete("/api/hospitals/:id/image", (req, res) => {
  const hospital = store.hospitals.find((h) => h.id === req.params.id);
  if (hospital) hospital.hospital_image_url = null;
  return res.status(204).end();
});

router.patch("/api/hospitals/:id/status", (req, res) => {
  const hospital = store.hospitals.find((h) => h.id === req.params.id);
  if (!hospital) return res.status(404).json({ success: false, message: "Hospital not found." });
  hospital.status = (req.body ?? {}).status ?? hospital.status;
  return ok(res, hospital);
});

router.put("/api/hospitals/:id", (req, res) => {
  const hospital = store.hospitals.find((h) => h.id === req.params.id);
  if (!hospital) return res.status(404).json({ success: false, message: "Hospital not found." });
  Object.assign(hospital, req.body ?? {});
  return ok(res, hospital);
});

router.delete("/api/hospitals/:id", (req, res) => {
  store.hospitals = store.hospitals.filter((h) => h.id !== req.params.id);
  return res.status(204).end();
});

// ---------------------------------------------------------------------------
// Upload (multipart; we don't parse the file, just return a fake URL)
// ---------------------------------------------------------------------------

router.post("/api/upload", (req, res) => {
  const folder = req.query.folder || "org-assets";
  req.resume(); // drain the multipart stream
  req.on("end", () => {
    res.json({ success: true, url: `https://mock-cdn.myteamflow.local/${folder}/${uid("file")}.png`, file_name: "upload.png", file_type: "image/png", size: 12345 });
  });
});

// ---------------------------------------------------------------------------
// Subscriptions
// ---------------------------------------------------------------------------

router.get("/api/v1/subscriptions/plans", (req, res) => ok(res, { plans: store.subscriptionPlans }));

router.post("/api/v1/subscriptions/assign", (req, res) => {
  const b = req.body ?? {};
  const plan = store.subscriptionPlans.find((p) => p.id === Number(b.plan_id)) ?? store.subscriptionPlans[0];
  const sub = {
    id: uid("sub"),
    hospital_id: b.hospital_id,
    plan_id: plan.id,
    plan_name: plan.name,
    billing_cycle: b.billing_cycle ?? "monthly",
    payment_mode: b.payment_mode ?? "offline",
    status: b.status ?? "ACTIVE",
    is_active: (b.status ?? "ACTIVE") === "ACTIVE",
    start_date: nowIso(),
    end_date: daysFromNow(365),
    appointments_limit: plan.appointments_limit,
    appointments_used: 0,
    usage_percent: 0,
    next_billing_date: daysFromNow(30),
    days_until_renewal: 30,
    price: plan.monthly_price,
  };
  store.hospitalSubscriptions[b.hospital_id] = sub;
  (store.subscriptionEvents[b.hospital_id] ??= []).push({ id: uid("se"), hospital_id: b.hospital_id, event_type: "ASSIGNED", occurred_at: nowIso(), details: { plan: plan.name } });
  return ok(res, sub);
});

router.get("/api/v1/subscriptions/hospital/:hospitalId/history", (req, res) =>
  ok(res, { events: store.subscriptionEvents[req.params.hospitalId] ?? [] }),
);

router.get("/api/v1/subscriptions/hospital/:hospitalId", (req, res) =>
  ok(res, store.hospitalSubscriptions[req.params.hospitalId] ?? null),
);

// ---------------------------------------------------------------------------
// Payment gateway settings
// ---------------------------------------------------------------------------

const defaultGateway = () => ({
  razorpay_enabled: false,
  razorpay_key_id: "",
  razorpay_webhook_url: "",
  whatsapp_payment_links_enabled: false,
  whatsapp_provider_key: "",
});

router.get("/api/settings/payment-gateway", (req, res) => {
  const id = req.query.hospital_id;
  return ok(res, store.paymentGatewaySettings[id] ?? defaultGateway());
});

router.put("/api/settings/payment-gateway", (req, res) => {
  const b = req.body ?? {};
  const id = b.hospital_id;
  const current = store.paymentGatewaySettings[id] ?? defaultGateway();
  const { hospital_id, ...rest } = b;
  store.paymentGatewaySettings[id] = { ...current, ...rest };
  return ok(res, store.paymentGatewaySettings[id]);
});

// ---------------------------------------------------------------------------
// Teams (/api/v1/teams)
// ---------------------------------------------------------------------------

router.get("/api/v1/teams", (req, res) => ok(res, store.teams));

router.post("/api/v1/teams", (req, res) => {
  const b = req.body ?? {};
  const team = {
    id: b.id || uid("team"),
    name: b.name,
    color: b.color ?? "#7C6CF6",
    description: b.description ?? "",
    admin: null,
    member_count: 0,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  let admin = null;
  if (b.admin) {
    admin = { user_id: uid("u-admin"), name: b.admin.name, email: b.admin.email, role: "SALES_ADMIN", team_id: team.id, status: "ACTIVE", created_at: nowIso() };
    team.admin = admin;
  }
  store.teams.push(team);
  return ok(res, { team: { id: team.id, name: team.name, color: team.color, description: team.description, created_at: team.created_at, updated_at: team.updated_at }, admin });
});

router.patch("/api/v1/teams/:id", (req, res) => {
  const team = store.teams.find((t) => t.id === req.params.id);
  if (!team) return res.status(404).json({ success: false, message: "Team not found." });
  Object.assign(team, req.body ?? {}, { updated_at: nowIso() });
  return ok(res, team);
});

router.post("/api/v1/teams/:id/admin", (req, res) => {
  const team = store.teams.find((t) => t.id === req.params.id);
  if (!team) return res.status(404).json({ success: false, message: "Team not found." });
  const b = req.body ?? {};
  const admin = b.admin
    ? { user_id: uid("u-admin"), name: b.admin.name, email: b.admin.email, role: "SALES_ADMIN", team_id: team.id, status: "ACTIVE", created_at: nowIso() }
    : { user_id: b.existing_user_id, name: store.accounts.find((a) => a.id === b.existing_user_id)?.name ?? "Admin", email: "", role: "SALES_ADMIN", team_id: team.id, status: "ACTIVE", created_at: nowIso() };
  team.admin = admin;
  return ok(res, admin);
});

router.delete("/api/v1/teams/:id/admin", (req, res) => {
  const team = store.teams.find((t) => t.id === req.params.id);
  if (!team) return res.status(404).json({ success: false, message: "Team not found." });
  const previous = team.admin?.user_id ?? "";
  team.admin = null;
  return ok(res, { team_id: team.id, previous_admin_id: previous, action: (req.body ?? {}).demote === false ? "deleted" : "demoted" });
});

router.delete("/api/v1/teams/:id", (req, res) => {
  store.teams = store.teams.filter((t) => t.id !== req.params.id);
  return res.status(204).end();
});

module.exports = { router, authUserFrom };
