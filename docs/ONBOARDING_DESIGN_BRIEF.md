# Prompt — Build the Onboarding Team Surface

> Paste everything below the line into a fresh Claude Code session inside `d:\NYRA-AI\Internal-dashboard`. It is self-contained — the receiving agent does not need this conversation's history.

---

You are working in an existing Next.js 14 (App Router) + TypeScript + Tailwind + shadcn/ui internal dashboard for **NYRA-AI**, a clinical/healthcare SaaS sold to hospitals and clinics. The Sales team surface is fully built; your job is to add the **Onboarding team** surface.

Read these files **first** to absorb the patterns and the existing data model. Do not write a single line until you've read all of them:

```
lib/types.ts                                            # all domain types
lib/access.ts                                           # role + team predicates
lib/permissions.ts                                      # role grants (do NOT modify)
lib/auth.tsx                                            # mocked auth
lib/mock-data.ts                                        # users, teams, metrics, audit
lib/sales-leads-data.ts                                 # 50+ seeded leads
lib/sales-pipeline.ts                                   # stage labels + summary math

app/(dashboard)/sales/                                  # the routing layout to mirror
components/sales/leads/leads-screen.tsx
components/sales/leads/leads-table.tsx
components/sales/leads/lead-detail-sheet.tsx
components/sales/leads/edit-lead-modal.tsx
components/sales/pipeline/pipeline-screen.tsx
components/sales/pipeline/pipeline-card.tsx
components/sales/pipeline/pipeline-column.tsx
components/sales/pipeline/mark-as-lost-modal.tsx
components/sales/pipeline/sales-rep-filter.tsx
components/sales/pipeline/new-lead-dropdown.tsx
components/sales/scorecard/scorecard-screen.tsx
components/sales/scorecard/scorecard-admin-screen.tsx  # large file — read in parts
components/sales/scorecard/scorecard-shared.tsx
components/sales/metrics/metric-management-screen.tsx
components/hospitals/hospitals-screen.tsx
components/layout/                                       # find the sidebar
```

**Hard rule:** every new screen must visually and structurally match its Sales counterpart. Same shadcn primitives, same `PageHeader` pattern, same spacing scale, same dark-mode classes, same `useAuth` + access-predicate gating, same toast patterns. If a Sales screen uses `Card` with `p-4` and `space-y-6`, your onboarding screen does the same.

---

## 1. The actual business flow

Read this carefully. The earlier "what is onboarding" answer in your head is probably wrong.

**Inside this app, the Sales team works hospitals — not abstract leads.** A `Lead` in [lib/sales-leads-data.ts](../lib/sales-leads-data.ts) represents a real clinic/hospital that Sales is trying to convert. The pipeline is:

```
cold-lead → first-contact → doctor-meeting → pitch-delivered →
hot-lead → sprint-started → sprint-review → subscription-closed
                                            ↑
                                    HANDOFF TO ONBOARDING
```

A "sprint" is NYRA-AI's pilot period — Sales runs the product live with the clinic for a fixed window to prove value. After `sprint-review`, the doctor either signs (`subscription-closed`) or doesn't (`lost`).

**The instant a lead hits `subscription-closed`, the Onboarding team picks it up.** That clinic now becomes an **Onboarding Account** owned by an Onboarding Specialist. Sales is done; Onboarding's clock starts.

So:
- **Sales' job ends** at `subscription-closed`.
- **Onboarding's job is** to take a freshly-signed clinic from "contract signed" to "fully operational on the platform" — kickoff call, system setup, staff training, go-live, and post-launch stabilization.
- **An Onboarding Account is identified by**: the source `Lead.id` (carries the contract context) + the `Hospital.id` (the existing canonical clinic record). Both already exist; Onboarding adds a third record that ties them together with onboarding-specific state.

Do not invent a separate "client" entity. The hospital is already the hospital — Onboarding tracks the **onboarding journey** of that hospital, not a new domain object.

---

## 2. Existing seed data you'll work with

These already exist in [lib/mock-data.ts](../lib/mock-data.ts) — find them:

- **Onboarding admin**: `u_neha` (Neha Gupta)
- **Onboarding members**: `u_divya` (Divya Reddy), `u_karthik` (Karthik Iyer), `u_riya` (Riya Singh)
- **Onboarding metric definitions** in `ONBOARDING_METRICS`: `clientsOnboarded`, `avgTimeToActivate`, `csatScore`, `activeOnboardings`
- **Onboarding daily metrics** are already generated in `dailyMetrics`
- **Onboarding member targets** are already in `targets`

Inside [lib/sales-leads-data.ts](../lib/sales-leads-data.ts) there's exactly **one** lead at stage `subscription-closed` (`lead_001` — 32 Pearly White Dental Clinic). For onboarding seed data you need a healthy spread (~12–18 accounts), so for v1 **fabricate additional onboarding accounts** that look as though they handed off from Sales, even if no matching `Lead` row exists. Each account record stores its own snapshot of the contract terms — it is not a live join.

---

## 3. Roles to support (mirror the Sales pattern exactly)

| Role | What they see | What they do |
|---|---|---|
| **Onboarding Member** (`role: "member", teamId: "onboarding"`) | The Hospitals page (read), accounts they own, the journey board filtered to their accounts, their scorecard | Edit their accounts, advance stages, log kickoff calls / training sessions / check-ins / blockers / notes, mark stalled / activated, edit next-action |
| **Onboarding Admin** (`role: "admin", teamId: "onboarding"`) | All onboarding accounts, full journey board, all reps' scorecards, rankings, scoring rule set, manual points, the **handoff queue** of unassigned accounts | Assign / reassign accounts, edit any account, set targets, publish scoring rules, award manual points, mark churned |
| **Super Admin** (`role: "super_admin", teamId: null`) | Everything across both teams | Everything |

Add these access predicates to [lib/access.ts](../lib/access.ts), mirroring the existing sales predicates **exactly**:

```ts
export function isOnboardingMember(auth: AuthContextValue): boolean { ... }
export function isOnboardingAdmin(auth: AuthContextValue): boolean { ... }
export function isOnOnboarding(auth: AuthContextValue): boolean { ... }
export function isOnboardingAdminOrSuperAdmin(auth: AuthContextValue): boolean { ... }
export function canSeeOnboardingTabs(auth: AuthContextValue): boolean { ... }
```

Also extend `canSeeHospitals` so onboarding members can read hospitals (they need it — see §6). Sales still sees hospitals; super_admin still sees everything.

Do **not** modify [lib/permissions.ts](../lib/permissions.ts). The existing role grants are team-agnostic and already correct for both teams.

---

## 4. Onboarding stages

Pick exactly these 9 stages. Order matters for the Kanban left-to-right.

| ID | Label | Meaning |
|---|---|---|
| `handoff-received` | Handoff received | Just landed from Sales. No work started. The "inbox" column. |
| `kickoff-scheduled` | Kickoff scheduled | Kickoff call booked but not yet held. |
| `kickoff-done` | Kickoff done | Kickoff call complete, plan agreed, requirements captured. |
| `setup` | Setup | Accounts being created, configurations done, integrations wired. |
| `training` | Training | Doctor + staff being trained on the platform. |
| `go-live` | Go-live | Switched to production use with the clinic. |
| `stabilizing` | Stabilizing | First ~30 days post go-live, monitoring usage and CSAT. |
| `activated` | Activated | Usage targets hit, CSAT signed. **Terminal success state.** |
| `stalled` | Stalled | Blocked / no progress for 14+ days. Needs intervention. |
| `churned` | Churned | Customer cancelled before reaching activated. **Terminal fail state.** |

**Default stage** when an account is created from a Sales handoff: `handoff-received`.

Stages are values, not a strict sequence. The UI lets you move freely except for one rule: **moving to `stalled` or `churned` requires a reason** (mirror Sales' "mark as lost" flow).

When stage hits:
- `kickoff-scheduled` — set `kickoffAt` to the scheduled date (collected in a small modal)
- `go-live` — set `goLiveAt = now`
- `activated` — set `activatedAt = now`, compute `timeToActivateDays = activatedAt − signedAt` in whole days
- `stalled` — set `stalledAt = now`, capture `stallReason` + optional notes
- `churned` — set `churnedAt = now`, capture `churnReason` + optional notes

---

## 5. Data model additions

Add to [lib/types.ts](../lib/types.ts), after the lead types section:

```ts
// ---------- Onboarding accounts ----------

export type OnboardingStage =
  | "handoff-received"
  | "kickoff-scheduled"
  | "kickoff-done"
  | "setup"
  | "training"
  | "go-live"
  | "stabilizing"
  | "activated"
  | "stalled"
  | "churned";

export type OnboardingHealth = "healthy" | "watch" | "at-risk";

export type StallReason =
  | "tech-blocker"           // platform / integration issue
  | "client-unresponsive"    // can't reach the doctor or staff
  | "scope-change"           // doctor wants something different
  | "staffing"               // clinic short on people to learn
  | "data-migration"         // legacy data import problems
  | "other";

export type ChurnReason =
  | "pricing"
  | "competitor"
  | "wrong-fit"
  | "client-unresponsive"
  | "scope-change"
  | "other";

export type OnboardingActivityType =
  | "stage-change"
  | "kickoff-call"           // initial planning call
  | "training-session"       // staff training
  | "check-in"               // routine touch-base
  | "blocker-logged"         // something is blocking progress
  | "blocker-resolved"
  | "csat-collected"         // a CSAT score was recorded
  | "note";

export interface OnboardingTimelineEvent {
  id: string;
  actorId: string;
  timestamp: string;          // ISO
  type: OnboardingActivityType;
  fromStage?: OnboardingStage;
  toStage?: OnboardingStage;
  content?: string;
  durationSec?: number;       // for kickoff-call / training-session
  csatScore?: number;         // for csat-collected, 0–5
}

export interface OnboardingAccount {
  id: string;                 // ob_001 etc

  // ---- snapshot from the source Sales lead (frozen at handoff) ----
  /** Optional pointer back to the Lead this came from. May be null in seed. */
  sourceLeadId: string | null;
  /** Optional pointer to the canonical Hospital record. May be null. */
  hospitalId: string | null;

  clinicName: string;
  doctorName: string;
  specialization: string;
  phone: string;
  city: string;
  area: string;
  address: string;

  /** Monthly subscription INR — copied from the source lead at handoff. */
  monthlyValue: number;
  /** Branches the contract covers. */
  branches: number;

  // ---- onboarding-specific state ----
  stage: OnboardingStage;
  health: OnboardingHealth;
  ownerId: string;            // the assigned onboarding specialist; ""
                              // when the account is in the handoff queue.

  /** ISO date the contract was signed (= the lead hit subscription-closed). */
  signedAt: string;
  /** Kickoff call date if scheduled / done. */
  kickoffAt: string | null;
  /** Production launch date. */
  goLiveAt: string | null;
  /** Activation date. */
  activatedAt: string | null;
  /** Whole days between signedAt and activatedAt; null while in flight. */
  timeToActivateDays: number | null;

  /** Most recent CSAT (0–5). Null if never surveyed. */
  lastCsatScore: number | null;
  lastCsatAt: string | null;

  lastActivityAt: string;
  nextAction: string | null;
  notes: string;

  // ---- terminal-state details ----
  stalledAt?: string;
  stallReason?: StallReason;
  stallNotes?: string;
  churnedAt?: string;
  churnReason?: ChurnReason;
  churnNotes?: string;

  timeline: OnboardingTimelineEvent[];
}
```

Create [lib/onboarding-accounts-data.ts](../lib/onboarding-accounts-data.ts) **mirroring** [lib/sales-leads-data.ts](../lib/sales-leads-data.ts):
- Reuse the `ts(daysAgo, hour, minute)` helper pattern.
- Seed **15–20 accounts** with realistic distribution: 1 in handoff queue (no owner), 2 kickoff-scheduled, 3 setup, 3 training, 2 go-live, 2 stabilizing, 3 activated, 1 stalled, 1 churned.
- Owners distributed across `u_divya`, `u_karthik`, `u_riya`. The handoff-queue account has `ownerId: ""`.
- Each timeline tells a coherent story (stages move forward over time, with a stall/recovery on at least one).
- Use real-sounding clinic names (mix of dental, pediatrics, family medicine, ENT, dermatology) and Hyderabad/Bangalore/Mumbai cities to match the rest of the app's seed data.
- Half of activated accounts have `lastCsatScore` between 4.0 and 5.0; one stalled account has `lastCsatScore` of 3.2.

Create [lib/onboarding-journey.ts](../lib/onboarding-journey.ts) mirroring [lib/sales-pipeline.ts](../lib/sales-pipeline.ts):

```ts
import type { OnboardingAccount, OnboardingStage, StallReason, ChurnReason } from "./types";

export const JOURNEY_STAGE_LABEL: Record<OnboardingStage, string> = {
  "handoff-received":  "Handoff",
  "kickoff-scheduled": "Kickoff scheduled",
  "kickoff-done":      "Kickoff done",
  setup:               "Setup",
  training:            "Training",
  "go-live":           "Go-live",
  stabilizing:         "Stabilizing",
  activated:           "Activated",
  stalled:             "Stalled",
  churned:             "Churned",
};

export const JOURNEY_STAGE_ORDER: OnboardingStage[] = [
  "handoff-received", "kickoff-scheduled", "kickoff-done", "setup",
  "training", "go-live", "stabilizing", "activated", "stalled", "churned",
];

/** Probability the account reaches "activated" given current stage. */
export const STAGE_ACTIVATION_PROBABILITY: Record<OnboardingStage, number> = {
  "handoff-received":  0.5,
  "kickoff-scheduled": 0.6,
  "kickoff-done":      0.7,
  setup:               0.8,
  training:            0.9,
  "go-live":           0.95,
  stabilizing:         0.97,
  activated:           1,
  stalled:             0.25,
  churned:             0,
};

const ACTIVE_STAGES = new Set<OnboardingStage>([
  "handoff-received", "kickoff-scheduled", "kickoff-done",
  "setup", "training", "go-live", "stabilizing",
]);
export function isActiveStage(stage: OnboardingStage): boolean { ... }

export const STAGE_DOT_CLASS: Record<OnboardingStage, string> = {
  /* Same shape as Sales' STAGE_DOT_CLASS — pick zinc/sky/violet/indigo/amber/
     emerald/orange tones that read as a left-to-right gradient,
     stalled = rose, churned = zinc-300. */
};

export const STALL_REASON_LABEL: Record<StallReason, string> = { ... };
export const STALL_REASON_ORDER: StallReason[] = [ ... ];
export const CHURN_REASON_LABEL: Record<ChurnReason, string> = { ... };
export const CHURN_REASON_ORDER: ChurnReason[] = [ ... ];

export interface JourneySummary {
  /** Counts. */
  handoffQueueCount: number;       // ownerId === "" OR stage === "handoff-received" with no owner
  activeCount: number;             // in active stages
  activatedCount: number;
  stalledCount: number;
  churnedCount: number;

  /** Sum of monthlyValue across active accounts (revenue currently in flight). */
  activeMrr: number;
  /** Sum of monthlyValue across activated accounts. */
  activatedMrr: number;

  /** Mean days from signedAt → activatedAt for activated accounts. Null if 0. */
  avgTimeToActivateDays: number | null;
  /** Share of active accounts with health === "healthy", 0–100. Null if 0. */
  healthScorePct: number | null;
  /** activatedCount / (activatedCount + churnedCount), 0–100, null if denom 0. */
  activationRatePct: number | null;
}

export function summarizeJourney(accounts: OnboardingAccount[]): JourneySummary { ... }
```

---

## 6. Screen-by-screen mapping

Build these in order. Each row mirrors the Sales structure 1:1.

| Sales reference | Onboarding screen to build | What's different |
|---|---|---|
| `app/(dashboard)/sales/page.tsx` | `app/(dashboard)/onboarding/page.tsx` | Brief overview placeholder |
| `app/(dashboard)/sales/leads/` + `components/sales/leads/` | `app/(dashboard)/onboarding/accounts/` + `components/onboarding/accounts/` | Table view of all onboarding accounts |
| `app/(dashboard)/sales/pipeline/` + `components/sales/pipeline/` | `app/(dashboard)/onboarding/journey/` + `components/onboarding/journey/` | Kanban using the 9 onboarding stages |
| **(new)** Handoff queue | A panel/card on the Journey page above the board, OR its own subpage `app/(dashboard)/onboarding/handoff/` | Lists accounts with `ownerId === ""` — admin can assign |
| `app/(dashboard)/sales/scorecard/` + `components/sales/scorecard/` | `app/(dashboard)/onboarding/scorecard/` + `components/onboarding/scorecard/` | Same scorecard machinery, different metrics (§9) |
| `app/(dashboard)/sales/metrics/` + `components/sales/metrics/` | `app/(dashboard)/onboarding/metrics/` + `components/onboarding/metrics/` | Reuses the same metric-management tabs |
| `app/(dashboard)/sales/field-location/` | **Skip for v1.** No field component. |
| `components/hospitals/` | **Reuse** as-is | Both teams see Hospitals |

---

## 7. The Accounts screen ([components/onboarding/accounts/accounts-screen.tsx](../components/onboarding/accounts/accounts-screen.tsx))

Mirror [components/sales/leads/leads-screen.tsx](../components/sales/leads/leads-screen.tsx). Differences:

- Page title: "Onboarding accounts"
- Description: "Track every clinic from contract signed to fully activated."
- Filters: search (clinic, doctor, phone, city), stage select (the 9 stages + "All"), owner select (admins/super_admins only — sales reps were filtered the same way)
- Columns in the table: Clinic, Doctor + specialization, Stage (`StageBadge`), Health pill (healthy/watch/at-risk), Owner, Days since signed (computed from `signedAt`), Next action, MRR, last activity
- Row click opens an `AccountDetailSheet` (mirror `LeadDetailSheet`) — overview tab + activity timeline tab
- "Edit account" pencil opens an `EditAccountModal` (mirror `EditLeadModal`)
- "+ New account" button in the page header opens a small dropdown:
  - **From a closed lead** — pick from the list of `subscription-closed` leads that don't already have an account (the canonical handoff path)
  - **Manual entry** — for accounts where Sales didn't go through this app
  - **Import CSV** — placeholder, just emits a toast like Sales does

The detail sheet must show:
- Header card: clinic name, doctor, specialization, phone, city, **stage badge**, **health pill**, MRR, branches
- Contract context block: "Signed on {signedAt} · From lead `{sourceLeadId}` · Contract value ₹{monthlyValue}/mo"
- Stage select (dropdown) — moving to `stalled` or `churned` opens the reason modal
- Next action edit-in-place
- "Log kickoff call" / "Log training session" / "Log check-in" / "Log blocker" / "Add note" buttons (use `toast.info("…— Phase 2")` placeholders for the unimplemented modals — mirror exactly how the lead detail sheet handles call/meeting/note)
- Activity timeline (oldest first), grouped by date

---

## 8. The Journey board ([components/onboarding/journey/journey-screen.tsx](../components/onboarding/journey/journey-screen.tsx))

Mirror [components/sales/pipeline/pipeline-screen.tsx](../components/sales/pipeline/pipeline-screen.tsx). Top of page shows four summary tiles (replace pipeline numbers):

| Tile | Value |
|---|---|
| **Active onboardings** | `summary.activeCount` (with MRR underneath) |
| **Activated** | `summary.activatedCount` (with MRR underneath) |
| **Activation rate** | `summary.activationRatePct` |
| **Avg time to activate** | `summary.avgTimeToActivateDays` (in days) |

Above the Kanban, when there are accounts in the handoff queue (`ownerId === ""`), render a **Handoff queue** card listing them with an "Assign" button each. The button opens a small popover where admin picks an onboarding specialist; after assignment, the account moves to that owner and stage `kickoff-scheduled` defaults (admin can set kickoff date in the same popover or skip).

Members do not see the handoff queue. They only see the assignments dropped on them.

Kanban columns = the 9 stages, in `JOURNEY_STAGE_ORDER`. `Stalled` and `Churned` are rightmost. Cards show clinic name, doctor name, MRR, days-since-signed, owner avatar, health pill, next-action snippet (truncated to 1 line). Forecast mode toggle (mirror Sales) replaces MRR with `MRR × STAGE_ACTIVATION_PROBABILITY`.

Drag rules:
- Any → `stalled` opens `MarkAsStalledModal` (mirror `mark-as-lost-modal.tsx` — name it [components/onboarding/journey/mark-as-stalled-modal.tsx](../components/onboarding/journey/mark-as-stalled-modal.tsx)). Required: `stallReason` from `STALL_REASON_ORDER`. Optional notes.
- Any → `churned` opens `MarkAsChurnedModal` similarly. Required: `churnReason`. Optional notes. **Admin only** — members see a disabled drop target with a tooltip "Only admins can mark churned."
- Members can only move their own accounts. Admins can move any.

Drag drops emit a `stage-change` timeline event the same way Sales does at [pipeline-screen.tsx:150-200](../components/sales/pipeline/pipeline-screen.tsx#L150-L200).

---

## 9. Scorecard ([components/onboarding/scorecard/](../components/onboarding/scorecard/))

Reuse — don't duplicate — these from [components/sales/scorecard/scorecard-shared.tsx](../components/sales/scorecard/scorecard-shared.tsx):

`ScoreRow`, `ScorecardTable`, `HeroGrade`, `HeroStat`, `letterGrade`, `GRADE_BG`, `GRADE_FG`, `PeriodTabs`, `PeriodValueDropdown`, `defaultSelectionFor`, `buildOptions`, `resolveWindow`, `ScorecardSkeleton`, `periodTagLabel`.

If anything in that file references `seedLeads` directly, **refactor it to be team-agnostic** before mounting onboarding — extract a `buildScorecard` interface that takes a builder fn per team. Do not break the Sales scorecard while doing this.

Create [components/onboarding/scorecard/scorecard-shared.tsx](../components/onboarding/scorecard/scorecard-shared.tsx) with:

```ts
export function buildOnboardingScorecard(
  user: User,
  window: ScorecardWindow,
): ScoreRow[]
```

Six metrics, weights summing to 100:

| ID | Label | Description | Unit | Weight | Default target | Compute |
|---|---|---|---|---|---|---|
| `accounts_activated` | Accounts activated | Accounts moved to `activated` in the period | count | 25 | 4 | count of `stage-change` events to `activated` in window across owned accounts |
| `time_to_activate` | Time to activate | Mean days from signed → activated, lower is better | days (lower better) | 20 | 21 | mean across activations in window. **Score = clamp(target / max(achieved, 1), 0, 1) × weight** because lower is better |
| `csat_score` | Average CSAT | Mean of `lastCsatScore` across owned active accounts | rating | 15 | 4.5 | sum of scores / count of accounts with non-null score |
| `training_sessions` | Training sessions | Trainings logged in the period | count | 15 | 12 | count of `training-session` timeline events |
| `health` | Portfolio health | Share of owned active accounts that are `healthy` | percent | 15 | 80 | `healthy / activeCount * 100` |
| `discipline` | Discipline | Days the rep logged any activity | percent | 10 | 80 | distinct activity-days / period-days × 100 |

`computeMrrForUser` for onboarding = sum of `monthlyValue` on accounts the user owns where `activatedAt` falls inside the window.

Then mirror the rest:
- [components/onboarding/scorecard/scorecard-screen.tsx](../components/onboarding/scorecard/scorecard-screen.tsx) for Onboarding Members — gated by `isOnboardingMember`.
- [components/onboarding/scorecard/scorecard-admin-screen.tsx](../components/onboarding/scorecard/scorecard-admin-screen.tsx) for Onboarding Admins + Super Admins — gated by `isOnboardingAdminOrSuperAdmin`. Reuse the same Rep performance / Rankings tab structure as Sales.

---

## 10. Metric management ([components/onboarding/metrics/metric-management-screen.tsx](../components/onboarding/metrics/metric-management-screen.tsx))

Mirror [components/sales/metrics/metric-management-screen.tsx](../components/sales/metrics/metric-management-screen.tsx). Two tabs: **Metrics & setup** and **Manual points**.

The existing `MetricsSetupTab` and `ManualPointsTab` in [scorecard-admin-screen.tsx](../components/sales/scorecard/scorecard-admin-screen.tsx) are sales-specific in their seed data only — they take `reps` as props in the manual-points case and read team metrics in the setup case. **Parameterize them** on `teamId` (or pass the rep array + metric defs in) instead of forking. Verify the sales surface still works after the refactor.

---

## 11. Routing & sidebar

Add routes:
```
app/(dashboard)/onboarding/
├── page.tsx                   → OnboardingOverviewScreen (placeholder card OK)
├── accounts/page.tsx          → AccountsScreen
├── journey/page.tsx           → JourneyScreen
├── scorecard/page.tsx         → branches on role: ScorecardScreen | ScorecardAdminScreen
├── metrics/page.tsx           → MetricManagementScreen
```

Find the sidebar (search for `Sales` in `components/layout/`). Add an **Onboarding** section right under the Sales section, gated with `canSeeOnboardingTabs(auth)`. Items in this order with appropriate `lucide-react` icons:

- Overview (`Compass` or `LayoutDashboard`)
- Accounts (`ClipboardCheck` or `Users`)
- Journey (`GitBranch` — same as Sales pipeline)
- Scorecard (`Trophy` — same as Sales)
- Metric management (`Sparkles` or `Wand2` — same as Sales)

The Hospitals link should remain visible to onboarding members and admins.

---

## 12. Things to deliberately NOT do

- **Don't** add field-location for onboarding. Out of scope.
- **Don't** add a backend, real auth, or fetch calls — mock everything in `lib/`, just like Sales.
- **Don't** invent shadcn primitives. Only use what's already in `components/ui/`.
- **Don't** duplicate `scorecard-shared.tsx` — refactor first.
- **Don't** change [lib/permissions.ts](../lib/permissions.ts).
- **Don't** edit any existing Sales file unless you're extracting code for reuse. After extracting, verify the Sales screens still render identically.
- **Don't** add comments narrating the work or referencing this brief. Code should read like it always belonged.
- **Don't** call `useMemo` / `useState` / `useEffect` after early returns. Hooks-rules will fail the build.
- **Don't** hard-code "today" — use the existing `REFERENCE_DATE` from [lib/mock-data.ts](../lib/mock-data.ts).

---

## 13. Acceptance criteria

You're done when **every one** of these is true:

1. Every new screen renders without console errors.
2. `npx next build` passes (no TS errors, no lint errors).
3. Logging in as `neha.gupta@nyra.ai` (Onboarding Admin) shows the Onboarding section in the sidebar with all five items, all rendering real seed data.
4. Logging in as `divya.reddy@nyra.ai` (Onboarding Member) shows the Onboarding section but only Divya's own accounts on the Accounts and Journey screens, and her own scorecard. The handoff-queue panel is hidden.
5. Logging in as `priya.sharma@nyra.ai` (Super Admin) shows both Sales and Onboarding sections.
6. Logging in as `arjun.mehta@nyra.ai` (Sales Member) does NOT show the Onboarding section.
7. Drag-drop on the Journey board moves accounts between stages and logs a `stage-change` timeline event. Dropping into "Stalled" opens the stall-reason modal. Dropping into "Churned" works for admin only.
8. The handoff queue card lists the 1 unowned seed account with an "Assign" affordance that, when clicked, sets `ownerId` and moves the account to `kickoff-scheduled`.
9. The scorecard rankings tab orders the 3 onboarding reps by total points, just like Sales.
10. The metric management screen lists onboarding metrics + the manual points form.
11. Visual diff — open Sales pipeline and Onboarding journey side-by-side. They should be visually identical except for column labels, content, and color of the stage dots.

---

## 14. Suggested order of work

1. **Types & data** — extend `lib/types.ts`, create `lib/onboarding-accounts-data.ts` and `lib/onboarding-journey.ts`. No UI yet. Verify with `tsc --noEmit`.
2. **Access predicates** — `lib/access.ts` additions. Verify Sales access still works.
3. **Routes & sidebar** — empty `page.tsx` files + a placeholder `OnboardingOverviewScreen`. Add sidebar items and gate. Click through every link as Neha to verify routing.
4. **Refactor scorecard-shared** to be team-agnostic. Verify Sales scorecard renders unchanged.
5. **Refactor MetricsSetupTab + ManualPointsTab** to take a teamId / rep list. Verify Sales metrics screen unchanged.
6. **Accounts screen** — table, detail sheet, edit modal, new-account dropdown.
7. **Journey screen** — Kanban + summary tiles + handoff queue + mark-as-stalled + mark-as-churned modals.
8. **Onboarding scorecard** — member + admin screens.
9. **Onboarding metric management**.
10. **Polish + build** — `npx next build` must pass. Walk every acceptance criterion.

Commit only when the user explicitly asks. If you finish a phase and want to checkpoint, just say so — do not push to `git` on your own.

---

## 15. When you finish

Report back with:
- A list of files created and files modified
- Confirmation that `npx next build` passes
- Any decisions you made that weren't pinned by this brief (e.g., "I named the Kanban 'Activation journey' instead of 'Onboarding journey' because…")
- Any visual or structural compromises and the reason

Do not ship a partial implementation. If you hit a blocker, stop and ask the user.
