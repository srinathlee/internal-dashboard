"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  BarChart3,
  Calendar,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Flame,
  IndianRupee,
  Loader2,
  MinusCircle,
  Pencil,
  Search,
  Target as TargetIcon,
  Trash2,
  TrendingDown,
  TrendingUp,
  UserCog,
  Users,
  XCircle,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/layout/page-header";
import { useAuth } from "@/lib/auth";
import { getInitials } from "@/lib/format";
import { formatCurrency } from "@/lib/format-metric";
import { useLeadPeople } from "@/lib/hooks/use-leads";
import { errorMessage } from "@/lib/hooks/use-async";
import {
  useMonitorBoard,
  useRepRevenueTargets,
  useRevenueTargetMutations,
} from "@/lib/hooks/use-revenue-targets";
import type {
  PeriodSnapshot,
  RevenuePeriod,
} from "@/lib/api/sales-revenue-targets";
import { cn } from "@/lib/utils";

// ---------- Period model ---------------------------------------------------

export type Period = RevenuePeriod;

const PERIODS: { key: Period; label: string }[] = [
  { key: "DAILY", label: "Daily" },
  { key: "WEEKLY", label: "Weekly" },
  { key: "MONTHLY", label: "Monthly" },
  { key: "QUARTERLY", label: "Quarterly" },
  { key: "YEARLY", label: "Yearly" },
];

const PERIOD_LABEL: Record<Period, string> = {
  DAILY: "Daily",
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
  YEARLY: "Yearly",
};

const PERIOD_HUMAN: Record<Period, string> = {
  DAILY: "Today",
  WEEKLY: "This Week",
  MONTHLY: "This Month",
  QUARTERLY: "This Quarter",
  YEARLY: "This Year",
};

const PERIOD_ICON: Record<Period, LucideIcon> = {
  DAILY: Zap,
  WEEKLY: Calendar,
  MONTHLY: CalendarDays,
  QUARTERLY: BarChart3,
  YEARLY: TargetIcon,
};

// How much of the current period has elapsed (0–100). Used for the
// "pace vs expected" stat — the backend doesn't pre-compute this since it
// changes minute-to-minute, so derive client-side.
function elapsedPctOf(period: Period): number {
  const now = new Date();
  switch (period) {
    case "DAILY":
      return Math.round(
        ((now.getHours() * 60 + now.getMinutes()) / (24 * 60)) * 100,
      );
    case "WEEKLY": {
      const day = now.getDay() === 0 ? 7 : now.getDay();
      return Math.round((day / 7) * 100);
    }
    case "MONTHLY": {
      const total = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0,
      ).getDate();
      return Math.round((now.getDate() / total) * 100);
    }
    case "QUARTERLY": {
      const q = Math.floor(now.getMonth() / 3);
      const qStart = new Date(now.getFullYear(), q * 3, 1);
      const qEnd = new Date(now.getFullYear(), q * 3 + 3, 0);
      const totalDays = Math.ceil(
        (qEnd.getTime() - qStart.getTime()) / (1000 * 60 * 60 * 24),
      );
      const elapsedDays =
        Math.ceil((now.getTime() - qStart.getTime()) / (1000 * 60 * 60 * 24));
      return Math.round((elapsedDays / totalDays) * 100);
    }
    case "YEARLY": {
      const yearStart = new Date(now.getFullYear(), 0, 1);
      const yearEnd = new Date(now.getFullYear() + 1, 0, 1);
      return Math.round(
        ((now.getTime() - yearStart.getTime()) /
          (yearEnd.getTime() - yearStart.getTime())) *
          100,
      );
    }
  }
}

/**
 * "Day X of Y" / "Hour X of 24" summary for the current period. Lets each
 * tile show how far through the period we are in concrete units, not just
 * the elapsed percentage.
 */
function periodElapsedSummary(period: Period): {
  current: number;
  total: number;
  label: string;
} {
  const now = new Date();
  switch (period) {
    case "DAILY": {
      const hour = now.getHours() + 1; // 1..24, friendly count
      return { current: hour, total: 24, label: `Hour ${hour} of 24` };
    }
    case "WEEKLY": {
      // ISO week: Monday=1, Sunday=7
      const day = now.getDay() === 0 ? 7 : now.getDay();
      return { current: day, total: 7, label: `Day ${day} of 7` };
    }
    case "MONTHLY": {
      const total = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0,
      ).getDate();
      return {
        current: now.getDate(),
        total,
        label: `Day ${now.getDate()} of ${total}`,
      };
    }
    case "QUARTERLY": {
      const q = Math.floor(now.getMonth() / 3);
      const qStart = new Date(now.getFullYear(), q * 3, 1);
      const qEnd = new Date(now.getFullYear(), q * 3 + 3, 0);
      const totalDays =
        Math.round((qEnd.getTime() - qStart.getTime()) / 86400000) + 1;
      const current =
        Math.floor((now.getTime() - qStart.getTime()) / 86400000) + 1;
      return { current, total: totalDays, label: `Day ${current} of ${totalDays}` };
    }
    case "YEARLY": {
      const yearStart = new Date(now.getFullYear(), 0, 1);
      const current =
        Math.floor((now.getTime() - yearStart.getTime()) / 86400000) + 1;
      const y = now.getFullYear();
      const isLeap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
      const total = isLeap ? 366 : 365;
      return { current, total, label: `Day ${current} of ${total}` };
    }
  }
}

function periodEndsLabel(period: Period): { label: string; days: number } {
  const now = new Date();
  let end: Date;
  switch (period) {
    case "DAILY":
      end = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        23,
        59,
        59,
      );
      break;
    case "WEEKLY": {
      const day = now.getDay();
      const daysUntilSun = day === 0 ? 0 : 7 - day;
      end = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + daysUntilSun,
        23,
        59,
        59,
      );
      break;
    }
    case "MONTHLY":
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      break;
    case "QUARTERLY": {
      const q = Math.floor(now.getMonth() / 3);
      end = new Date(now.getFullYear(), q * 3 + 3, 0, 23, 59, 59);
      break;
    }
    case "YEARLY":
      end = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
      break;
  }
  const days = Math.max(
    0,
    Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
  );
  const label =
    days === 0
      ? "Ends today"
      : days === 1
        ? "Ends tomorrow"
        : `Ends in ${days} days`;
  return { label, days };
}

// ---------- Pace-based status ----------------------------------------------
//
// The backend's `status` field bands by `achieved/target` ratio, which paints
// every rep "Behind" on day 1 of a period. We override it client-side with a
// *pace* model that compares achieved against what's expected by today —
// `expected = target * elapsed_fraction_of_period`. A rep at 5% achievement
// on day 1 (when expected is also ~5%) is "On Track", not "Behind".

type PaceStatus =
  | "JUST_STARTED"
  | "AHEAD"
  | "ON_TRACK"
  | "AT_RISK"
  | "BEHIND"
  | "UNSET";

interface PaceResult {
  status: PaceStatus;
  /** `(achieved / expected) * 100`. 0 when just started / unset. */
  pace: number;
  /** Revenue the rep should have hit by now (`target * elapsed`). */
  expected: number;
  /** Fraction of the period elapsed, 0–1. */
  elapsed: number;
}

function isUnset(snap: PeriodSnapshot | null | undefined): boolean {
  return !snap || snap.target_amount <= 0 || snap.status === "UNSET";
}

function computePace(
  snapshot: PeriodSnapshot | null | undefined,
  period: Period,
): PaceResult {
  if (isUnset(snapshot)) {
    return { status: "UNSET", pace: 0, expected: 0, elapsed: 0 };
  }
  const target = snapshot!.target_amount;
  const achieved = snapshot!.actual_amount;
  // `elapsedPctOf` already returns 0–100 from real clock math; clamp to
  // [0, 1] so we don't divide by a near-zero or go past 100% after period end.
  const elapsed = Math.min(1, Math.max(0, elapsedPctOf(period) / 100));

  // Very early in the period: pace is meaningless (huge division), so we
  // bail out to a neutral "Just started" state per the spec.
  if (elapsed < 0.1) {
    return {
      status: "JUST_STARTED",
      pace: 0,
      expected: target * elapsed,
      elapsed,
    };
  }

  const expected = target * elapsed;
  if (expected <= 0) {
    return { status: "JUST_STARTED", pace: 0, expected: 0, elapsed };
  }

  const pace = (achieved / expected) * 100;
  let status: PaceStatus;
  if (pace >= 100) status = "AHEAD";
  else if (pace >= 90) status = "ON_TRACK";
  else if (pace >= 70) status = "AT_RISK";
  else status = "BEHIND";

  return { status, pace, expected, elapsed };
}

const STATUS_META: Record<
  PaceStatus,
  {
    label: string;
    pill: string;
    text: string;
    bar: string;
    icon: LucideIcon;
  }
> = {
  JUST_STARTED: {
    label: "Just started",
    pill: "bg-zinc-100 text-zinc-600 ring-1 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700",
    text: "text-zinc-500 dark:text-zinc-400",
    bar: "bg-zinc-300 dark:bg-zinc-600",
    icon: Clock,
  },
  AHEAD: {
    label: "Ahead",
    pill: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900/40",
    text: "text-emerald-600 dark:text-emerald-400",
    bar: "bg-emerald-500",
    icon: CheckCircle2,
  },
  ON_TRACK: {
    label: "On Track",
    pill: "bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:ring-zinc-700",
    text: "text-zinc-700 dark:text-zinc-200",
    bar: "bg-zinc-500 dark:bg-zinc-400",
    icon: TrendingUp,
  },
  AT_RISK: {
    label: "At Risk",
    pill: "bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900/40",
    text: "text-amber-600 dark:text-amber-400",
    bar: "bg-amber-500",
    icon: AlertTriangle,
  },
  BEHIND: {
    label: "Behind",
    pill: "bg-rose-50 text-rose-700 ring-1 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-900/40",
    text: "text-rose-600 dark:text-rose-400",
    bar: "bg-rose-500",
    icon: TrendingDown,
  },
  UNSET: {
    label: "Unset",
    pill: "bg-zinc-100 text-zinc-600 ring-1 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700",
    text: "text-zinc-400",
    bar: "bg-zinc-300",
    icon: MinusCircle,
  },
};

// ---------- Screen ---------------------------------------------------------

export function TargetManagementScreen() {
  const auth = useAuth();
  const [tab, setTab] = useState<"monitor" | "assign">("monitor");

  if (!auth.isLoaded) {
    return (
      <div className="space-y-4">
        <Card className="h-16 animate-pulse" />
        <Card className="h-96 animate-pulse" />
      </div>
    );
  }
  if (auth.user?.role !== "super_admin") {
    return (
      <div className="space-y-6">
        <PageHeader title="Target management" />
        <Card className="p-12 text-center text-sm text-zinc-500">
          Target management is for super admins only.
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Target management"
        description="Assign a target amount for each period and track team progress against it."
      />

      <div className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white p-1 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <TabButton
          active={tab === "monitor"}
          onClick={() => setTab("monitor")}
          icon={Activity}
          label="Monitor team"
        />
        <TabButton
          active={tab === "assign"}
          onClick={() => setTab("assign")}
          icon={TargetIcon}
          label="Assign targets"
        />
      </div>

      {tab === "monitor" ? <MonitorTeamTab /> : <AssignTargetsTab />}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: LucideIcon;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "bg-zinc-900 text-white shadow-sm dark:bg-zinc-100 dark:text-zinc-900"
          : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900",
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {label}
    </button>
  );
}

// =============================================================
// Monitor team
// =============================================================

function MonitorTeamTab() {
  const [period, setPeriod] = useState<Period>("DAILY");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const peopleQuery = useLeadPeople();
  const people = useMemo(
    () => peopleQuery.data ?? [],
    [peopleQuery.data],
  );

  // Default to "all reps selected" once people load.
  useEffect(() => {
    if (selectedIds.length === 0 && people.length > 0) {
      setSelectedIds(people.map((p) => p.id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [people.length]);

  // The monitor endpoint returns tallies + rows + all_periods in one shot.
  // We filter rows client-side by selectedIds so the dropdown stays snappy
  // — but we also pass `user_ids` to the API for backend-side filtering.
  const monitor = useMonitorBoard({
    period,
    user_ids: selectedIds.length > 0 ? selectedIds : undefined,
  });

  const rows = monitor.data?.rows ?? [];

  // Recompute tallies client-side using pace status. The backend's `tallies`
  // bands by achieved/target ratio, which flags everyone "Behind" on day 1
  // of a period — we want pace-vs-expected counts instead.
  const tallies = useMemo(() => {
    const t = { behind: 0, at_risk: 0, on_track: 0, ahead: 0 };
    for (const row of rows) {
      const { status } = computePace(row.active_period, period);
      if (status === "BEHIND") t.behind++;
      else if (status === "AT_RISK") t.at_risk++;
      else if (status === "ON_TRACK" || status === "JUST_STARTED") t.on_track++;
      else if (status === "AHEAD") t.ahead++;
      // UNSET excluded from tallies.
    }
    return t;
  }, [rows, period]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiTile
          icon={XCircle}
          accent="text-rose-600"
          accentBg="bg-rose-50 dark:bg-rose-950/30"
          label="Behind"
          value={tallies.behind}
        />
        <KpiTile
          icon={AlertOctagon}
          accent="text-amber-600"
          accentBg="bg-amber-50 dark:bg-amber-950/30"
          label="At risk"
          value={tallies.at_risk}
        />
        <KpiTile
          icon={TrendingUp}
          accent="text-zinc-600 dark:text-zinc-300"
          accentBg="bg-zinc-100 dark:bg-zinc-800/40"
          label="On track"
          value={tallies.on_track}
        />
        <KpiTile
          icon={CheckCircle2}
          accent="text-emerald-600"
          accentBg="bg-emerald-50 dark:bg-emerald-950/30"
          label="Ahead"
          value={tallies.ahead}
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PeriodTabs value={period} onChange={setPeriod} />
        <RepMultiSelect
          people={people}
          selectedIds={selectedIds}
          onChange={setSelectedIds}
        />
      </div>

      {monitor.error ? (
        <Card className="grid place-items-center py-12 text-sm text-rose-600">
          Couldn't load the team board: {errorMessage(monitor.error)}
        </Card>
      ) : monitor.isLoading && rows.length === 0 ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="h-24 animate-pulse" />
          ))}
        </div>
      ) : people.length === 0 ? (
        <Card className="grid place-items-center py-12 text-sm text-zinc-500">
          <Users className="mb-2 h-6 w-6 text-zinc-400" aria-hidden />
          No reps configured yet.
        </Card>
      ) : selectedIds.length === 0 ? (
        <Card className="grid place-items-center py-12 text-sm text-zinc-500">
          Pick at least one rep from the dropdown to see their targets.
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <RepTargetCard
              key={r.user.id}
              userId={r.user.id}
              name={r.user.name}
              periods={r.all_periods}
              activePeriod={period}
              profileHref={`/teams/sales?member=${r.user.id}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RepMultiSelect({
  people,
  selectedIds,
  onChange,
}: {
  people: { id: string; name: string }[];
  selectedIds: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return people;
    return people.filter((p) => p.name.toLowerCase().includes(q));
  }, [people, query]);

  const toggle = (id: string) => {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((x) => x !== id)
        : [...selectedIds, id],
    );
  };

  const allSelected =
    people.length > 0 && selectedIds.length === people.length;

  const label =
    selectedIds.length === 0
      ? "No reps selected"
      : allSelected
        ? "All reps"
        : selectedIds.length === 1
          ? people.find((p) => p.id === selectedIds[0])?.name ?? "1 rep"
          : `${selectedIds.length} reps selected`;

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Filter by rep"
          className="inline-flex h-9 min-w-[12rem] items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 text-sm shadow-sm transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900"
        >
          <Users className="h-3.5 w-3.5 text-zinc-400" aria-hidden />
          <span className="min-w-0 flex-1 truncate text-left">{label}</span>
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 shrink-0 text-zinc-400 transition-transform",
              open && "rotate-180",
            )}
            aria-hidden
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 p-0">
        <div className="border-b border-zinc-200 p-2 dark:border-zinc-800">
          <div className="relative">
            <Search
              aria-hidden
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400"
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search reps…"
              className="h-8 border-zinc-200 pl-7 text-sm dark:border-zinc-800"
              autoFocus
            />
          </div>
        </div>

        <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-2 text-[11px] dark:border-zinc-800">
          <span className="text-zinc-500">
            {selectedIds.length} of {people.length} selected
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onChange(people.map((p) => p.id))}
              className="font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
            >
              All
            </button>
            <span aria-hidden className="text-zinc-300">
              ·
            </span>
            <button
              type="button"
              onClick={() => onChange([])}
              className="font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              None
            </button>
          </div>
        </div>

        <ul className="max-h-72 overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <li className="px-3 py-6 text-center text-xs text-zinc-500">
              No matching reps.
            </li>
          ) : (
            filtered.map((p) => {
              const isSelected = selectedIds.includes(p.id);
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => toggle(p.id)}
                    className="flex w-full items-center gap-2.5 rounded-md px-3 py-1.5 text-left text-sm transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-zinc-900"
                  >
                    <Avatar className="h-6 w-6">
                      <AvatarFallback
                        className={cn(
                          "text-[9px] font-semibold text-white",
                          colorForId(p.id),
                        )}
                      >
                        {getInitials(p.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="min-w-0 flex-1 truncate">{p.name}</span>
                    <span className="grid h-4 w-4 shrink-0 place-items-center text-indigo-600 dark:text-indigo-400">
                      {isSelected ? (
                        <Check className="h-3.5 w-3.5" aria-hidden />
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function RepTargetCard({
  userId,
  name,
  periods,
  activePeriod,
  profileHref,
}: {
  userId: string;
  name: string;
  periods: Partial<Record<Period, PeriodSnapshot | null>>;
  activePeriod: Period;
  profileHref?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const activeSnapshot = periods[activePeriod] ?? null;

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-wrap items-center gap-3 border-b border-zinc-200/60 px-4 py-3 dark:border-zinc-800/60">
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarFallback
            className={cn(
              "text-[10px] font-semibold text-white",
              colorForId(userId),
            )}
          >
            {getInitials(name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{name}</div>
          <div className="truncate text-xs text-zinc-500">Sales Rep</div>
        </div>
        {profileHref ? (
          <Link
            href={profileHref}
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            <UserCog className="h-3.5 w-3.5" aria-hidden />
            Manage profile
          </Link>
        ) : null}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-controls={`rep-details-${userId}`}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            expanded
              ? "border border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-200 dark:hover:bg-indigo-950/60"
              : "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900",
          )}
        >
          {expanded ? "Hide details" : "View details"}
          {expanded ? (
            <ChevronUp className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" aria-hidden />
          )}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 px-4 py-4 sm:grid-cols-3 lg:grid-cols-5">
        {PERIODS.map((p) => (
          <PeriodSnapshotCard
            key={p.key}
            period={p.key}
            snapshot={periods[p.key] ?? null}
            highlighted={p.key === activePeriod}
          />
        ))}
      </div>

      {expanded ? (
        <div
          id={`rep-details-${userId}`}
          className="border-t border-zinc-200/60 px-4 pb-5 pt-4 dark:border-zinc-800/60"
        >
          <DetailedBreakdownCard
            period={activePeriod}
            snapshot={activeSnapshot}
          />
        </div>
      ) : null}
    </Card>
  );
}

function PeriodSnapshotCard({
  period,
  snapshot,
  highlighted,
}: {
  period: Period;
  snapshot: PeriodSnapshot | null;
  highlighted: boolean;
}) {
  const pace = computePace(snapshot, period);
  const elapsedSummary = periodElapsedSummary(period);
  const noTarget = pace.status === "UNSET";
  const meta = STATUS_META[pace.status];
  const target = snapshot?.target_amount ?? 0;
  const actual = snapshot?.actual_amount ?? 0;
  const pct = snapshot?.progress_pct ?? 0;

  return (
    <Card
      className={cn(
        "p-3",
        highlighted && "ring-2 ring-indigo-200 dark:ring-indigo-900/40",
        pace.status === "BEHIND" &&
          "border-rose-200/70 dark:border-rose-900/40",
        pace.status === "AT_RISK" &&
          "border-amber-200/70 dark:border-amber-900/40",
        pace.status === "AHEAD" &&
          "border-emerald-200/70 dark:border-emerald-900/40",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          {PERIOD_LABEL[period]}
        </span>
        <span
          className={cn(
            "rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider",
            meta.pill,
          )}
        >
          {meta.label}
        </span>
      </div>
      <div className="mt-2 text-sm font-semibold tabular-nums">
        {noTarget ? (
          <span className="text-zinc-400">No target</span>
        ) : (
          formatCurrency(actual, "INR")
        )}
      </div>
      <div className="mt-1 space-y-0.5 text-[11px] text-zinc-500">
        {noTarget ? (
          <div>Set one from Assign targets · {elapsedSummary.label}</div>
        ) : (
          <>
            <div className="truncate tabular-nums">
              of {formatCurrency(target, "INR")} · {elapsedSummary.label}
            </div>
            <div className="truncate tabular-nums">
              {pace.status === "JUST_STARTED"
                ? `Expected ${formatCurrency(pace.expected, "INR")} by today`
                : `Expected ${formatCurrency(pace.expected, "INR")} · ${Math.round(pace.pace)}% pace`}
            </div>
          </>
        )}
      </div>
      {!noTarget ? (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
          <span
            className={cn("block h-full rounded-full", meta.bar)}
            style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
          />
        </div>
      ) : null}
    </Card>
  );
}

// =============================================================
// Single-rep detailed view
// =============================================================

export function SingleRepDetailedView({
  user,
  periods,
  activePeriod,
  onPeriodChange,
  profileHref,
}: {
  user: { id: string; name: string };
  periods: Partial<Record<Period, PeriodSnapshot | null>>;
  activePeriod: Period;
  onPeriodChange: (p: Period) => void;
  /**
   * When provided, renders a "Manage profile" link in the rep header that
   * deep-links into the team detail screen (which auto-opens the member
   * sheet via `?member=<id>`). Omit to hide the affordance — e.g. for the
   * rep's own My Targets view, where this isn't applicable.
   */
  profileHref?: string;
}) {
  const activeSnapshot = periods[activePeriod] ?? null;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2.5">
        <Avatar className="h-9 w-9 shrink-0">
          <AvatarFallback
            className={cn(
              "text-xs font-semibold text-white",
              colorForId(user.id),
            )}
          >
            {getInitials(user.name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-semibold">{user.name}</div>
          <div className="truncate text-xs text-zinc-500">Sales Rep</div>
        </div>
        {profileHref ? (
          <Link
            href={profileHref}
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            <UserCog className="h-3.5 w-3.5" aria-hidden />
            Manage profile
          </Link>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {PERIODS.map((p) => (
          <PeriodTile
            key={p.key}
            period={p.key}
            snapshot={periods[p.key] ?? null}
            active={p.key === activePeriod}
            onClick={() => onPeriodChange(p.key)}
          />
        ))}
      </div>

      <DetailedBreakdownCard
        period={activePeriod}
        snapshot={activeSnapshot}
      />
    </div>
  );
}

function PeriodTile({
  period,
  snapshot,
  active,
  onClick,
}: {
  period: Period;
  snapshot: PeriodSnapshot | null;
  active: boolean;
  onClick: () => void;
}) {
  const Icon = PERIOD_ICON[period];
  const pace = computePace(snapshot, period);
  const elapsedSummary = periodElapsedSummary(period);
  const noTarget = pace.status === "UNSET";
  const justStarted = pace.status === "JUST_STARTED";
  const meta = STATUS_META[pace.status];
  const target = snapshot?.target_amount ?? 0;
  const actual = snapshot?.actual_amount ?? 0;
  const pct = snapshot?.progress_pct ?? 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-xl border bg-white p-4 text-left shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-zinc-950",
        active
          ? "border-indigo-500 ring-2 ring-indigo-500/30 dark:border-indigo-400"
          : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <Icon
            className={cn(
              "h-3.5 w-3.5 shrink-0",
              active
                ? "text-indigo-600 dark:text-indigo-400"
                : "text-zinc-400",
            )}
            aria-hidden
          />
          <span className="truncate text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            {PERIOD_HUMAN[period]}
          </span>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider",
            meta.pill,
          )}
        >
          {meta.label}
        </span>
      </div>

      <div className="mt-2 text-xl font-bold tabular-nums">
        {noTarget ? (
          <span className="text-base text-zinc-400">No target</span>
        ) : (
          formatCurrency(actual, "INR")
        )}
      </div>

      {!noTarget ? (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
          <span
            className={cn("block h-full rounded-full", meta.bar)}
            style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
          />
        </div>
      ) : null}

      <div className="mt-2 space-y-0.5 text-[11px] leading-snug text-zinc-500">
        {noTarget ? (
          <div>Set from Assign targets · {elapsedSummary.label}</div>
        ) : (
          <>
            <div className="truncate">
              of {formatCurrency(target, "INR")} · {elapsedSummary.label}
            </div>
            {justStarted ? (
              <div className="truncate">
                Expected {formatCurrency(pace.expected, "INR")} by today
              </div>
            ) : (
              <div className="truncate">
                Expected {formatCurrency(pace.expected, "INR")} ·{" "}
                <span className={cn("font-semibold", meta.text)}>
                  {Math.round(pace.pace)}% pace
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </button>
  );
}

function DetailedBreakdownCard({
  period,
  snapshot,
}: {
  period: Period;
  snapshot: PeriodSnapshot | null;
}) {
  const pace = computePace(snapshot, period);
  const elapsedSummary = periodElapsedSummary(period);
  const noTarget = pace.status === "UNSET";
  const justStarted = pace.status === "JUST_STARTED";
  const meta = STATUS_META[pace.status];
  const target = snapshot?.target_amount ?? 0;
  const actual = snapshot?.actual_amount ?? 0;
  const pct = snapshot?.progress_pct ?? 0;
  const ends = periodEndsLabel(period);

  // SVG ring math: r=42 → circumference ≈ 263.89
  const R = 42;
  const C = 2 * Math.PI * R;
  const clampedPct = Math.max(0, Math.min(100, pct));
  const dash = (clampedPct / 100) * C;

  return (
    <Card className="overflow-hidden p-0">
      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              {PERIOD_HUMAN[period]} revenue
            </div>
            <h3 className="mt-0.5 text-xl font-bold">Detailed breakdown</h3>
            <div className="mt-1 text-xs tabular-nums text-zinc-500">
              {elapsedSummary.label}
            </div>
          </div>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
              ends.days <= 1
                ? "bg-rose-50 text-rose-600 ring-1 ring-rose-200/60 dark:bg-rose-950/40 dark:text-rose-400 dark:ring-rose-900/40"
                : ends.days <= 7
                  ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200/60 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900/40"
                  : "bg-zinc-100 text-zinc-600 ring-1 ring-zinc-200/60 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700",
            )}
          >
            <Flame className="h-3.5 w-3.5" aria-hidden />
            {ends.label}
          </span>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[auto_1fr] lg:items-center">
          <div className="flex flex-col items-center gap-3">
            <div className="relative h-40 w-40">
              <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                <circle
                  cx="50"
                  cy="50"
                  r={R}
                  fill="none"
                  strokeWidth="9"
                  className="stroke-zinc-100 dark:stroke-zinc-800"
                />
                {!noTarget ? (
                  <circle
                    cx="50"
                    cy="50"
                    r={R}
                    fill="none"
                    strokeWidth="9"
                    strokeLinecap="round"
                    stroke="currentColor"
                    strokeDasharray={`${dash} ${C}`}
                    className={meta.text}
                  />
                ) : null}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div
                  className={cn(
                    "text-3xl font-bold tabular-nums",
                    noTarget ? "text-zinc-400" : meta.text,
                  )}
                >
                  {noTarget ? "—" : `${pct}%`}
                </div>
                <div className="text-xs text-zinc-500">
                  {meta.label}
                </div>
              </div>
            </div>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
                meta.pill,
              )}
            >
              <meta.icon className="h-3.5 w-3.5" aria-hidden />
              {meta.label}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <StatTile
              label="Achieved"
              value={noTarget ? "—" : formatCurrency(actual, "INR")}
            />
            <StatTile
              label="Target"
              value={noTarget ? "—" : formatCurrency(target, "INR")}
            />
            <StatTile
              label="Expected by today"
              value={noTarget ? "—" : formatCurrency(pace.expected, "INR")}
              accent="sky"
            />
            <StatTile
              label="Pace"
              value={
                noTarget || justStarted
                  ? "—"
                  : `${Math.round(pace.pace)}%`
              }
              accent="sky"
              TrendIcon={
                noTarget || justStarted
                  ? undefined
                  : pace.pace >= 100
                    ? TrendingUp
                    : TrendingDown
              }
            />
          </div>
        </div>

        {!noTarget ? (
          <div className="mt-6">
            <div className="mb-2 flex items-baseline justify-between">
              <span className="text-xs font-semibold text-zinc-500">
                Progress
              </span>
              <span className="text-xs font-semibold tabular-nums text-zinc-500">
                {pct}% of {formatCurrency(target, "INR")}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
              <span
                className={cn("block h-full rounded-full", meta.bar)}
                style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
              />
            </div>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

function StatTile({
  label,
  value,
  accent,
  TrendIcon,
}: {
  label: string;
  value: string;
  accent?: "rose" | "sky";
  TrendIcon?: LucideIcon;
}) {
  const tone =
    accent === "rose"
      ? "border-rose-200/60 bg-rose-50/60 dark:border-rose-900/40 dark:bg-rose-950/20"
      : accent === "sky"
        ? "border-sky-200/60 bg-sky-50/60 dark:border-sky-900/40 dark:bg-sky-950/20"
        : "border-zinc-200 bg-zinc-50/60 dark:border-zinc-800 dark:bg-zinc-900/40";
  const valueTone =
    accent === "rose"
      ? "text-rose-600 dark:text-rose-400"
      : accent === "sky"
        ? "text-sky-600 dark:text-sky-400"
        : "text-zinc-900 dark:text-zinc-100";

  return (
    <div className={cn("rounded-lg border p-4", tone)}>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        {label}
      </div>
      <div
        className={cn(
          "mt-1 flex items-center gap-1.5 text-2xl font-bold tabular-nums",
          valueTone,
        )}
      >
        {TrendIcon ? <TrendIcon className="h-5 w-5" aria-hidden /> : null}
        {value}
      </div>
    </div>
  );
}

function KpiTile({
  icon: Icon,
  accent,
  accentBg,
  label,
  value,
}: {
  icon: LucideIcon;
  accent: string;
  accentBg: string;
  label: string;
  value: number;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <span
          aria-hidden
          className={cn(
            "grid h-8 w-8 place-items-center rounded-md",
            accentBg,
            accent,
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        <span className={cn("text-3xl font-bold tabular-nums", accent)}>
          {value}
        </span>
      </div>
      <div
        className={cn(
          "mt-1 text-[10px] font-semibold uppercase tracking-wider",
          accent,
        )}
      >
        {label}
      </div>
    </Card>
  );
}

function PeriodTabs({
  value,
  onChange,
}: {
  value: Period;
  onChange: (next: Period) => void;
}) {
  return (
    <div className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-950">
      {PERIODS.map((p) => {
        const active = value === p.key;
        return (
          <button
            key={p.key}
            type="button"
            onClick={() => onChange(p.key)}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300"
                : "text-zinc-600 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-900",
            )}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}

// =============================================================
// Assign targets
// =============================================================

function AssignTargetsTab() {
  const peopleQuery = useLeadPeople();
  const people = useMemo(
    () => peopleQuery.data ?? [],
    [peopleQuery.data],
  );

  const [userId, setUserId] = useState<string>("");
  const [applyAll, setApplyAll] = useState(false);
  const [period, setPeriod] = useState<Period>("WEEKLY");
  const [value, setValue] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const mutations = useRevenueTargetMutations();
  const repTargetsQuery = useRepRevenueTargets(userId || null);

  // Default the rep selection to the first available rep once people load.
  useEffect(() => {
    if (!userId && people.length > 0) setUserId(people[0]!.id);
  }, [people, userId]);

  const selectedRep = people.find((p) => p.id === userId) ?? null;
  const repTargets = repTargetsQuery.data?.targets ?? {};

  const handleAssign = async () => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      toast.error("Target amount must be a positive number");
      return;
    }
    if (!applyAll && !userId) {
      toast.error("Pick a rep (or check Apply to all reps)");
      return;
    }
    setSubmitting(true);
    try {
      if (applyAll) {
        const res = await mutations.bulkSet({
          period,
          target_amount: numeric,
          currency: "INR",
          user_ids: null,
        });
        toast.success(
          `${PERIOD_LABEL[period]} target applied to ${res.applied_to} rep${res.applied_to === 1 ? "" : "s"}`,
          res.skipped.length > 0
            ? { description: `${res.skipped.length} skipped.` }
            : undefined,
        );
      } else {
        await mutations.setForUser(userId, {
          period,
          target_amount: numeric,
          currency: "INR",
        });
        toast.success(`${PERIOD_LABEL[period]} target updated`);
      }
      setValue("");
      await repTargetsQuery.refetch();
    } catch (err) {
      toast.error("Couldn't save target", { description: errorMessage(err) });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (p: Period) => {
    if (!userId) return;
    if (
      typeof window !== "undefined" &&
      !window.confirm(`Remove the ${PERIOD_LABEL[p].toLowerCase()} target?`)
    ) {
      return;
    }
    try {
      await mutations.remove(userId, p);
      toast.success(`${PERIOD_LABEL[p]} target removed`);
      await repTargetsQuery.refetch();
    } catch (err) {
      toast.error("Couldn't remove target", {
        description: errorMessage(err),
      });
    }
  };

  const startEdit = (p: Period, current: number) => {
    setPeriod(p);
    setValue(String(current));
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      {/* ---------- Left: Assign form ---------- */}
      <Card className="p-5">
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400"
          >
            <TargetIcon className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-base font-semibold">Assign new target</h2>
            <p className="text-sm text-zinc-500">
              Set the target amount for the selected period.
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Sales rep
            </label>
            <Select
              value={userId}
              onValueChange={(v) => setUserId(v)}
              disabled={applyAll}
            >
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Pick a rep" />
              </SelectTrigger>
              <SelectContent>
                {people.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    <span className="inline-flex items-center gap-2">
                      <Avatar className="h-5 w-5">
                        <AvatarFallback
                          className={cn(
                            "text-[9px] text-white",
                            colorForId(p.id),
                          )}
                        >
                          {getInitials(p.name)}
                        </AvatarFallback>
                      </Avatar>
                      {p.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <label className="mt-2 inline-flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={applyAll}
                onChange={(e) => setApplyAll(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-zinc-300"
              />
              <span className="text-zinc-700 dark:text-zinc-300">
                Apply to all reps
              </span>
            </label>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Period
            </label>
            <div className="inline-flex w-full items-center rounded-lg border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-950">
              {PERIODS.map((p) => {
                const active = period === p.key;
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setPeriod(p.key)}
                    className={cn(
                      "flex-1 rounded-md px-2 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      active
                        ? "bg-indigo-50 text-indigo-700 shadow-sm dark:bg-indigo-950/40 dark:text-indigo-300"
                        : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100",
                    )}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Target amount
            </label>
            <div className="relative">
              <IndianRupee
                className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400"
                aria-hidden
              />
              <Input
                type="number"
                min="0"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="500000"
                className="h-10 pl-9 tabular-nums"
              />
            </div>
          </div>

          <Button
            onClick={handleAssign}
            disabled={submitting || !value || (!userId && !applyAll)}
            className="h-11 w-full bg-indigo-600 hover:bg-indigo-700"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <TargetIcon className="h-4 w-4" aria-hidden />
            )}
            Assign target
          </Button>
        </div>
      </Card>

      {/* ---------- Right: Current targets ---------- */}
      <Card className="p-5">
        <h2 className="text-base font-semibold">
          {selectedRep ? `${selectedRep.name}'s targets` : "Targets"}
        </h2>
        <p className="text-sm text-zinc-500">
          Current target amount per period.
        </p>

        <div className="mt-4 space-y-3">
          {!userId ? (
            <div className="rounded-md border border-dashed p-6 text-center text-xs text-zinc-500">
              Select a rep to see their targets.
            </div>
          ) : repTargetsQuery.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="h-14 animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-800"
                />
              ))}
            </div>
          ) : repTargetsQuery.error ? (
            <div className="rounded-md border border-rose-200 bg-rose-50 p-4 text-xs text-rose-600 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-400">
              {errorMessage(repTargetsQuery.error)}
            </div>
          ) : (
            PERIODS.map((p) => {
              const entry = repTargets[p.key];
              const current = entry?.target_amount ?? 0;
              const hasTarget = current > 0;
              return (
                <div
                  key={p.key}
                  className="overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-800"
                >
                  <div className="border-b border-zinc-200 bg-zinc-50/60 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/40">
                    {p.label}
                  </div>
                  <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                    <span className="text-sm">Target amount</span>
                    <div className="flex items-center gap-2">
                      {hasTarget ? (
                        <span className="text-sm font-semibold tabular-nums">
                          {formatCurrency(current, "INR")}
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-400">
                          Not set
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => startEdit(p.key, current)}
                        aria-label={`Edit ${p.label.toLowerCase()} target`}
                        className="grid h-7 w-7 place-items-center rounded-md text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(p.key)}
                        disabled={!hasTarget}
                        aria-label={`Remove ${p.label.toLowerCase()} target`}
                        className={cn(
                          "grid h-7 w-7 place-items-center rounded-md",
                          hasTarget
                            ? "bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-950/30 dark:text-rose-400 dark:hover:bg-rose-950/50"
                            : "text-zinc-300 cursor-not-allowed dark:text-zinc-700",
                        )}
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>
    </div>
  );
}

// ---------- Avatar colour palette ------------------------------------------

const AVATAR_COLORS = [
  "bg-orange-500",
  "bg-sky-500",
  "bg-rose-500",
  "bg-emerald-500",
  "bg-indigo-500",
  "bg-amber-500",
  "bg-violet-500",
  "bg-teal-500",
];

function colorForId(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length]!;
}
