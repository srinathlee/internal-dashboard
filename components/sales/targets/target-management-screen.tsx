"use client";

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
  RevenueStatus,
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

// ---------- Status mapping -------------------------------------------------

const STATUS_META: Record<
  RevenueStatus,
  {
    label: string;
    pill: string;
    text: string;
    bar: string;
    rowBg: string;
    icon: LucideIcon;
  }
> = {
  BEHIND: {
    label: "Behind",
    pill: "bg-rose-50 text-rose-700 ring-1 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-900/40",
    text: "text-rose-600 dark:text-rose-400",
    bar: "bg-rose-500",
    rowBg: "bg-rose-50/40 dark:bg-rose-950/10",
    icon: TrendingDown,
  },
  AT_RISK: {
    label: "At Risk",
    pill: "bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900/40",
    text: "text-amber-600 dark:text-amber-400",
    bar: "bg-amber-500",
    rowBg: "bg-amber-50/40 dark:bg-amber-950/10",
    icon: AlertTriangle,
  },
  ON_TRACK: {
    label: "On Track",
    pill: "bg-sky-50 text-sky-700 ring-1 ring-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-900/40",
    text: "text-sky-600 dark:text-sky-400",
    bar: "bg-sky-500",
    rowBg: "",
    icon: TrendingUp,
  },
  ACHIEVED: {
    label: "Achieved",
    pill: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900/40",
    text: "text-emerald-600 dark:text-emerald-400",
    bar: "bg-emerald-500",
    rowBg: "",
    icon: CheckCircle2,
  },
  UNSET: {
    label: "Unset",
    pill: "bg-zinc-100 text-zinc-600 ring-1 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700",
    text: "text-zinc-400",
    bar: "bg-zinc-300",
    rowBg: "",
    icon: MinusCircle,
  },
};

/** A `(period, snapshot)` pair where snapshot may be missing entirely. */
function isUnset(snap: PeriodSnapshot | null | undefined): boolean {
  return !snap || snap.target_amount <= 0 || snap.status === "UNSET";
}

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

  const tallies = monitor.data?.tallies ?? {
    behind: 0,
    at_risk: 0,
    on_track: 0,
    achieved: 0,
    unset: 0,
  };
  const rows = monitor.data?.rows ?? [];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiTile
          icon={XCircle}
          accent="text-rose-600"
          accentBg="bg-rose-50 dark:bg-rose-950/30"
          label="Behind target"
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
          accent="text-sky-600"
          accentBg="bg-sky-50 dark:bg-sky-950/30"
          label="On track"
          value={tallies.on_track}
        />
        <KpiTile
          icon={CheckCircle2}
          accent="text-emerald-600"
          accentBg="bg-emerald-50 dark:bg-emerald-950/30"
          label="Achieved"
          value={tallies.achieved}
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
      ) : rows.length === 1 ? (
        <SingleRepDetailedView
          user={{
            id: rows[0]!.user.id,
            name: rows[0]!.user.name,
          }}
          periods={rows[0]!.all_periods}
          activePeriod={period}
          onPeriodChange={setPeriod}
        />
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <RepTargetCard
              key={r.user.id}
              userId={r.user.id}
              name={r.user.name}
              periods={r.all_periods}
              activePeriod={period}
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
}: {
  userId: string;
  name: string;
  periods: Partial<Record<Period, PeriodSnapshot | null>>;
  activePeriod: Period;
}) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center gap-2.5 border-b border-zinc-200/60 px-4 py-3 dark:border-zinc-800/60">
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
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{name}</div>
          <div className="truncate text-xs text-zinc-500">Sales Rep</div>
        </div>
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
  const noTarget = isUnset(snapshot);
  const status: RevenueStatus = noTarget ? "UNSET" : snapshot!.status;
  const meta = STATUS_META[status];
  const target = snapshot?.target_amount ?? 0;
  const actual = snapshot?.actual_amount ?? 0;
  const pct = snapshot?.progress_pct ?? 0;

  return (
    <Card
      className={cn(
        "p-3",
        highlighted && "ring-2 ring-indigo-200 dark:ring-indigo-900/40",
        !noTarget &&
          status === "BEHIND" &&
          "border-rose-200/70 dark:border-rose-900/40",
        !noTarget &&
          status === "AT_RISK" &&
          "border-amber-200/70 dark:border-amber-900/40",
        !noTarget &&
          status === "ON_TRACK" &&
          "border-sky-200/70 dark:border-sky-900/40",
        !noTarget &&
          status === "ACHIEVED" &&
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
          formatCurrency(target, "INR")
        )}
      </div>
      <div className="mt-1 text-[11px] tabular-nums text-zinc-500">
        {noTarget
          ? "Set one from Assign targets"
          : `${formatCurrency(actual, "INR")} achieved · ${pct}%`}
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
}: {
  user: { id: string; name: string };
  periods: Partial<Record<Period, PeriodSnapshot | null>>;
  activePeriod: Period;
  onPeriodChange: (p: Period) => void;
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
        <div className="min-w-0">
          <div className="truncate text-base font-semibold">{user.name}</div>
          <div className="truncate text-xs text-zinc-500">Sales Rep</div>
        </div>
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
  const noTarget = isUnset(snapshot);
  const status: RevenueStatus = noTarget ? "UNSET" : snapshot!.status;
  const meta = STATUS_META[status];
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

      <div className="mt-2 flex items-baseline justify-between gap-2">
        <span className="truncate text-[11px] text-zinc-500">
          {noTarget
            ? "Set from Assign targets"
            : `of ${formatCurrency(target, "INR")}`}
        </span>
        {!noTarget ? (
          <span
            className={cn("text-xs font-semibold tabular-nums", meta.text)}
          >
            {pct}%
          </span>
        ) : null}
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
  const noTarget = isUnset(snapshot);
  const status: RevenueStatus = noTarget ? "UNSET" : snapshot!.status;
  const meta = STATUS_META[status];
  const target = snapshot?.target_amount ?? 0;
  const actual = snapshot?.actual_amount ?? 0;
  const pct = snapshot?.progress_pct ?? 0;
  const ends = periodEndsLabel(period);
  const remaining = Math.max(0, target - actual);
  const elapsed = elapsedPctOf(period);
  const pace = noTarget ? 0 : pct - elapsed;

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
              label="Remaining"
              value={noTarget ? "—" : formatCurrency(remaining, "INR")}
              accent="rose"
            />
            <StatTile
              label="Pace vs expected"
              value={
                noTarget
                  ? "—"
                  : `${pace >= 0 ? "+" : ""}${Math.round(pace)}%`
              }
              accent="sky"
              TrendIcon={pace >= 0 ? TrendingUp : TrendingDown}
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
