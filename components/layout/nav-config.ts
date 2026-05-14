import {
  BarChart3,
  Building2,
  Filter,
  GitBranch,
  LayoutDashboard,
  Map,
  Network,
  ScrollText,
  Settings,
  SlidersHorizontal,
  Target,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { AuthContextValue } from "@/lib/auth";
import {
  canSeeHospitals,
  canSeeSalesTabs,
  isOnSales,
  isSalesAdmin,
  isSalesAdminOrSuperAdmin,
  isSalesMember,
} from "@/lib/access";

/**
 * Sidebar groups, in render order:
 *   top              — flat list at the top (no label)
 *   hospitalOnboard  — labeled "Hospital onboard"
 *   salesTeam        — labeled "Sales KPIs" (sales member) or "Sales Team"
 *   bottom           — flat list at the bottom; Settings lives here
 */
export type NavGroupId =
  | "top"
  | "hospitalOnboard"
  | "salesTeam"
  | "bottom";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /**
   * Section the item lives under. May depend on the active user — Performance,
   * for example, sits at the top for admins/super-admin (team or org view) but
   * inside the Sales KPIs group for sales members (personal view).
   */
  group: NavGroupId | ((auth: AuthContextValue) => NavGroupId);
  /**
   * Predicate determining whether this item is visible.
   * Centralizing access control here keeps every sidebar conditional going
   * through `can()` (and the small access helpers in lib/access.ts) —
   * components never compare `user.role === ...` directly.
   */
  show: (auth: AuthContextValue) => boolean;
}

export const NAV_ITEMS: NavItem[] = [
  // ----- Top group (flat, no label) -----
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    group: "top",
    // Sales members and sales admins live inside the Sales Team section —
    // their per-tab views (Pipeline, Scorecard, etc.) cover the same ground
    // a generic dashboard would, so the Dashboard entry is hidden for them.
    // Super admin doesn't get a dedicated Dashboard either; the org-wide
    // surfaces (Hospitals, Performance, Teams) cover what they need.
    show: (a) =>
      a.can("performance:read:self") &&
      !isSalesMember(a) &&
      !isSalesAdmin(a) &&
      a.user?.role !== "super_admin",
  },
  {
    label: "Performance",
    href: "/performance",
    // Sales member sees their personal KPIs and the sales admin sees their
    // team's KPIs — both are grouped inside the Sales Team section. Other
    // admins and super-admin keep Performance at the top (org / non-sales
    // team scope).
    icon: BarChart3,
    group: (a) =>
      isSalesMember(a) || isSalesAdmin(a) ? "salesTeam" : "top",
    show: (a) => a.can("performance:read:self"),
  },
  {
    label: "Team",
    href: "/team",
    icon: Users,
    /**
     * Sales admins see Team grouped under the Sales Team section so all
     * sales-context items live together. Other team admins (e.g. onboarding)
     * keep Team at the top since they have no team-named section to nest into.
     */
    group: (a) => (isOnSales(a) ? "salesTeam" : "top"),
    /**
     * Admins see their own team here. Super admins skip this and use /teams.
     * `teamId != null` distinguishes a team-scoped admin from a global super admin
     * (whose teamId is null) — a structural property, not a role string compare.
     */
    show: (a) =>
      a.can("team:add_member") && a.user?.teamId != null && !isSalesMember(a),
  },
  {
    label: "Teams",
    href: "/teams",
    icon: Network,
    group: "top",
    show: (a) => a.can("performance:read:all"),
  },
  {
    label: "Audit log",
    href: "/audit-log",
    icon: ScrollText,
    group: "top",
    show: (a) => a.can("audit_log:read"),
  },

  // ----- Hospital onboard group -----
  {
    label: "Hospitals",
    href: "/hospitals",
    icon: Building2,
    group: "hospitalOnboard",
    show: (a) => canSeeHospitals(a),
  },

  // ----- Sales group (label flips between "Sales KPIs" and "Sales Team") -----
  {
    label: "Leads",
    href: "/sales/leads",
    icon: Filter,
    group: "salesTeam",
    show: (a) => canSeeSalesTabs(a),
  },
  {
    label: "Pipeline",
    href: "/sales/pipeline",
    icon: GitBranch,
    group: "salesTeam",
    show: (a) => canSeeSalesTabs(a),
  },
  {
    label: "Scorecard",
    href: "/sales/scorecard",
    icon: Trophy,
    group: "salesTeam",
    show: (a) => canSeeSalesTabs(a),
  },
  {
    label: "Field location",
    href: "/sales/field-location",
    icon: Map,
    group: "salesTeam",
    show: (a) => canSeeSalesTabs(a),
  },
  {
    label: "Metric management",
    href: "/sales/metrics",
    icon: SlidersHorizontal,
    group: "salesTeam",
    // Configuration surface — only sales admins and super-admin can edit
    // metric definitions and per-rep targets, so plain sales members and
    // admins from other teams are filtered out.
    show: (a) => isSalesAdminOrSuperAdmin(a),
  },
  {
    label: "Target management",
    href: "/sales/targets",
    icon: Target,
    group: "salesTeam",
    // Super-admin-only: org-wide target oversight and assignment. Sales
    // admins manage metric definitions; only super-admin assigns hard
    // numeric targets to individual reps.
    show: (a) => a.user?.role === "super_admin",
  },
  {
    label: "My targets",
    href: "/sales/my-targets",
    icon: Target,
    group: "salesTeam",
    // Sales rep counterpart to Target management — read-only view of the
    // targets the super admin has assigned to this rep, with current
    // progress per period.
    show: (a) => isSalesMember(a),
  },

  // ----- Bottom group: Settings always last -----
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
    group: "bottom",
    show: () => true,
  },
];

/**
 * Group definitions.
 * - `label` may be a function to vary by viewer — salesTeam reads
 *   "Sales KPIs" for the sales member and "Sales Team" for everyone else.
 * - `collapsible` makes the group header a click-to-toggle button. The
 *   sidebar persists the collapsed state to localStorage and force-expands
 *   the group when it contains the active route.
 */
export interface NavGroup {
  id: NavGroupId;
  label: string | null | ((auth: AuthContextValue) => string | null);
  collapsible?: boolean;
}

export const NAV_GROUPS: NavGroup[] = [
  { id: "top", label: null },
  { id: "hospitalOnboard", label: "Hospital onboard" },
  {
    id: "salesTeam",
    label: (a) => (isSalesMember(a) ? "Sales KPIs" : "Sales Team"),
    collapsible: true,
  },
  { id: "bottom", label: null },
];

/** Used by the header to display the current page title. */
export const PAGE_TITLE_BY_PATH: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/performance": "Performance",
  "/hospitals": "Hospitals",
  "/sales/leads": "Leads",
  "/sales/pipeline": "Pipeline",
  "/sales/scorecard": "Scorecard",
  "/sales/field-location": "Field location",
  "/sales/metrics": "Metric management",
  "/sales/targets": "Target management",
  "/sales/my-targets": "My targets",
  "/team": "Team",
  "/teams": "Teams",
  "/audit-log": "Audit log",
  "/settings": "Settings",
  "/profile": "Profile",
};
