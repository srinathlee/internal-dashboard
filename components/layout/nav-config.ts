import {
  BarChart3,
  Building2,
  CalendarCheck,
  Filter,
  Footprints,
  GitBranch,
  LayoutGrid,
  Map,
  MapPinned,
  Network,
  Radio,
  ScrollText,
  Settings,
  SlidersHorizontal,
  Target,
  TrendingUp,
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
    label: "Follow-ups",
    href: "/sales/follow-ups",
    icon: CalendarCheck,
    group: "salesTeam",
    // Sales-rep-only personal task list (calls, meetings, visits). Admins
    // and super-admin don't have a personal calendar surface here.
    show: (a) => isSalesMember(a),
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
    // Sales admins manage their own team's reps + targets; super-admin sees
    // all teams. Plain sales members go to /sales/my-targets instead.
    show: (a) => isSalesAdminOrSuperAdmin(a),
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
  {
    label: "Live location",
    href: "/sales/live-location",
    icon: Radio,
    group: "salesTeam",
    // Admin-only — real-time map of reps in the field.
    show: (a) => isSalesAdminOrSuperAdmin(a),
  },
  {
    label: "Distance",
    href: "/sales/distance",
    icon: Footprints,
    group: "salesTeam",
    // Reps see their own daily distance; admins see the team breakdown.
    show: (a) => isOnSales(a) || a.user?.role === "super_admin",
  },
  {
    label: "Groups",
    href: "/sales/groups",
    icon: LayoutGrid,
    group: "salesTeam",
    // Organise reps into zones / sub-teams. Admin-only.
    show: (a) => isSalesAdminOrSuperAdmin(a),
  },
  {
    label: "Territories",
    href: "/sales/territories",
    icon: MapPinned,
    group: "salesTeam",
    // Geographic polygon assignments. Admin-only.
    show: (a) => isSalesAdminOrSuperAdmin(a),
  },
  {
    label: "Win / loss",
    href: "/sales/analytics",
    icon: TrendingUp,
    group: "salesTeam",
    // Closed-deal analytics. Admin-only.
    show: (a) => isSalesAdminOrSuperAdmin(a),
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
  "/performance": "Performance",
  "/hospitals": "Hospitals",
  "/sales/leads": "Leads",
  "/sales/pipeline": "Pipeline",
  "/sales/follow-ups": "Follow-ups",
  "/sales/scorecard": "Scorecard",
  "/sales/field-location": "Field location",
  "/sales/metrics": "Metric management",
  "/sales/targets": "Target management",
  "/sales/my-targets": "My targets",
  "/sales/live-location": "Live location",
  "/sales/distance": "Distance",
  "/sales/groups": "Groups",
  "/sales/territories": "Territories",
  "/sales/analytics": "Win / loss",
  "/team": "Team",
  "/teams": "Teams",
  "/audit-log": "Audit log",
  "/settings": "Settings",
  "/profile": "Profile",
};
