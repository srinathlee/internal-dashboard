/**
 * NYRA mock backend — implements every endpoint the internal dashboard calls,
 * backed by in-memory dummy data (see data.js). No database; restart to reset.
 *
 *   cd server && npm install && npm start   ->  http://localhost:4000
 *
 * Point the frontend at it with NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
 * (already set in ../.env.local).
 */
const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 4000;

// The frontend sends credentialed requests (credentials: "include"), so the
// CORS response must echo the origin and allow credentials.
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "5mb" }));

// Tiny request log so you can watch the dashboard talk to the mock.
app.use((req, res, next) => {
  res.on("finish", () => {
    console.log(`${new Date().toISOString().slice(11, 19)} ${res.statusCode} ${req.method} ${req.originalUrl}`);
  });
  next();
});

app.get("/", (req, res) =>
  res.json({ name: "nyra-mock-server", status: "ok", docs: "All dashboard endpoints are served under /api/*" }),
);
app.get("/health", (req, res) => res.json({ status: "ok" }));

app.use(require("./routes/auth-hcs").router);
app.use(require("./routes/sales-core").router);
app.use(require("./routes/leads").router);
app.use(require("./routes/targets").router);
app.use(require("./routes/acp").router);

// Unknown API path -> JSON 404 (never HTML, so the frontend shows a clean message).
app.use((req, res) => {
  res.status(404).json({ success: false, message: `No mock route for ${req.method} ${req.path}` });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ success: false, message: err.message ?? "Internal mock server error" });
});

app.listen(PORT, () => {
  console.log(`NYRA mock server listening on http://localhost:${PORT}`);
  console.log("Login with any seeded email (e.g. ram@gmail.com) and any password.");
});
