"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronRight,
  Flame,
  IndianRupee,
  Loader2,
  MapPin,
  Mic,
  MoreHorizontal,
  Plus,
  Search,
  Star,
  Trash2,
  TrendingUp,
  UserCircle,
  Users,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { PageHeader } from "@/components/layout/page-header";
import { useAuth } from "@/lib/auth";
import { isSalesAdminOrSuperAdmin } from "@/lib/access";
import { getInitials } from "@/lib/format";
import { errorMessage } from "@/lib/hooks/use-async";
import {
  useAcpBatch,
  useAcpBatchStats,
  useAcpMembers,
  useAcpMutations,
  useAcpWeekView,
} from "@/lib/hooks/use-accelerator";
import type {
  AcpMember,
  AcpReview,
  AcpWeekDay,
  AcpWeekDayRep,
} from "@/lib/api/sales-accelerator";
import { REVIEW_KEYS } from "@/lib/api/sales-accelerator";
import { ApiError } from "@/lib/api/client";
import { cn } from "@/lib/utils";

import {
  acpFmt,
  ACTIVITY_META,
  getRepWeek,
  REVIEW_META,
  reviewBar,
  SectionLabel,
  StatCard,
  WEEK_CONFIG,
  weekTitle,
} from "./acp-shared";
import { AddMemberModal } from "./add-member-modal";
import { BatchAlerts } from "./admin-alert-panel";

/** Max reps shown in the Attention / Fire list (lowest revenue first). */
const FIRE_LIST_SIZE = 5;

const WEEK_SUBTITLE: Record<number, string> = {
  1: "Training + field observation",
  2: "Observation",
  3: "Sprint push",
  4: "Month 1 close",
  5: "Conversion",
  6: "Selling",
  7: "Month 2 target",
  8: "Final push",
};


export function BatchDashboardScreen({ batchId }: { batchId: string }) {
  const auth = useAuth();
  const router = useRouter();
  const batch = useAcpBatch(batchId);
  const stats = useAcpBatchStats(batchId);
  const members = useAcpMembers(batchId);
  const { deleteMember } = useAcpMutations();

  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  // Training days have no per-day rep logs, so clicking one opens a roster
  // sidebar of the week's members instead of the field-day detail table.
  const [rosterDay, setRosterDay] = useState<number | null>(null);
  // Which review-summary card's roster sidebar is open, if any.
  const [reviewSheet, setReviewSheet] = useState<AcpReview | null>(null);
  const [showAddMember, setShowAddMember] = useState(false);
  // All-members roster filter: which status pill is active + the search query.
  const [memberFilter, setMemberFilter] = useState<"all" | "active" | "fired">(
    "all",
  );
  const [memberQuery, setMemberQuery] = useState("");
  // The rep an admin is about to un-enroll, shown in the confirm dialog.
  const [removeTarget, setRemoveTarget] = useState<AcpMember | null>(null);
  const [removing, setRemoving] = useState(false);

  // Un-enroll a rep from the program (admin-only). Keeps their sales login and
  // pipeline leads; removes only their ACP membership/logs/sprints. A repeat
  // delete returns 404, which we treat as success (idempotent). On success we
  // refetch the roster + stats so the row and header counts drop the rep.
  const handleRemoveMember = async () => {
    const target = removeTarget;
    if (!target) return;
    setRemoving(true);
    try {
      await deleteMember(target.id);
      toast.success(`${target.name} removed from program`, {
        description: "Their sales account and leads were preserved.",
      });
      setRemoveTarget(null);
      members.refetch();
      stats.refetch();
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        toast.success(`${target.name} removed from program`);
        setRemoveTarget(null);
        members.refetch();
        stats.refetch();
      } else {
        toast.error("Couldn't remove rep", { description: errorMessage(err) });
      }
    } finally {
      setRemoving(false);
    }
  };

  // Clicking a rep opens their full profile page (replaces the old side-panel).
  const openRep = (repId: string) =>
    router.push(`/sales/accelerator/${batchId}/${repId}`);

  const weekView = useAcpWeekView(batchId, selectedWeek);

  const memberList = useMemo(() => members.data ?? [], [members.data]);
  const activeMembers = useMemo(
    () => memberList.filter((m) => m.status !== "inactive"),
    [memberList],
  );
  const memberById = useMemo(() => {
    const map = new Map<string, AcpMember>();
    for (const m of memberList) map.set(m.id, m);
    return map;
  }, [memberList]);

  // Most recent review for a rep, from the server's `current_review`.
  const latestReviewFor = useMemo(
    () => (member: AcpMember): AcpReview | null => member.current_review ?? null,
    [],
  );

  const reviewCounts = useMemo(() => {
    const counts: Record<AcpReview, number> = {
      working_fine: 0,
      observation: 0,
      retrain: 0,
    };
    for (const m of activeMembers) {
      const r = latestReviewFor(m);
      if (r) counts[r] += 1;
    }
    return counts;
  }, [activeMembers, latestReviewFor]);

  const weekCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    for (const m of activeMembers) {
      const w = getRepWeek(m.joined_at).week;
      counts[w] = (counts[w] ?? 0) + 1;
    }
    return counts;
  }, [activeMembers]);

  // Members of the selected week grouped by their current day-in-week (1–5).
  // Each rep sits on exactly the one day tile matching where they are in the
  // program *today* — a rep who joined today is on Day 1 and rolls to Day 2
  // tomorrow, so the per-day counts move with them rather than every training
  // day showing the whole cohort.
  const membersByDayInWeek = useMemo(() => {
    const map = new Map<number, AcpMember[]>();
    if (selectedWeek == null) return map;
    for (const m of activeMembers) {
      const pos = getRepWeek(m.joined_at);
      if (pos.week !== selectedWeek) continue;
      const arr = map.get(pos.dayInWeek);
      if (arr) arr.push(m);
      else map.set(pos.dayInWeek, [m]);
    }
    return map;
  }, [activeMembers, selectedWeek]);

  const topPerformers = useMemo(
    () =>
      [...activeMembers]
        .map((m) => ({
          id: m.id,
          name: m.name,
          total: m.sprint_revenue + m.subscription_revenue,
        }))
        .sort((a, b) => b.total - a.total),
    [activeMembers],
  );

  // Attention / Fire list: the worst-performing *active* reps — the ones
  // heading toward being fired. Ranked by total revenue ascending (lowest
  // first) and capped at FIRE_LIST_SIZE. Already-fired members are excluded
  // (they live in the All-members roster, not here).
  const fireList = useMemo(
    () =>
      [...activeMembers]
        .map((m) => ({
          id: m.id,
          name: m.name,
          total: m.sprint_revenue + m.subscription_revenue,
        }))
        .sort((a, b) => a.total - b.total)
        .slice(0, FIRE_LIST_SIZE),
    [activeMembers],
  );

  // Roster breakdown for the All-members header: a member is "fired" when the
  // backend marks them inactive or tags them fired; everyone else is active.
  const memberStats = useMemo(() => {
    let fired = 0;
    for (const m of memberList) {
      if (m.status === "inactive" || m.tag === "fired") fired += 1;
    }
    return { total: memberList.length, active: memberList.length - fired, fired };
  }, [memberList]);

  // Roster after applying the active status pill + search box. The list's
  // numbering and the "showing N" reflect this filtered view, not the full
  // roster (the pill badges keep showing the full totals).
  const filteredMembers = useMemo(() => {
    const q = memberQuery.trim().toLowerCase();
    return memberList.filter((m) => {
      const fired = m.status === "inactive" || m.tag === "fired";
      if (memberFilter === "active" && fired) return false;
      if (memberFilter === "fired" && !fired) return false;
      if (
        q &&
        !m.name.toLowerCase().includes(q) &&
        !m.email.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [memberList, memberFilter, memberQuery]);

  const weekDays = useMemo(() => weekView.data?.days ?? [], [weekView.data]);

  const selectWeek = (n: number) => {
    setSelectedWeek((prev) => (prev === n ? null : n));
    setSelectedDay(null);
    setRosterDay(null);
  };
  const selectDay = (d: number) =>
    setSelectedDay((prev) => (prev === d ? null : d));

  if (!auth.isLoaded) {
    return (
      <div className="space-y-6">
        <Card className="h-20 animate-pulse" />
        <Card className="h-40 animate-pulse" />
      </div>
    );
  }

  if (!isSalesAdminOrSuperAdmin(auth)) {
    return (
      <Card className="p-12 text-center text-sm text-zinc-500">
        The Accelerator program is managed by sales admins and super admins.
      </Card>
    );
  }

  const b = batch.data;
  const sprintRev =
    stats.data?.sprint_revenue ??
    activeMembers.reduce((n, m) => n + m.sprint_revenue, 0);
  const subRev =
    stats.data?.subscription_revenue ??
    activeMembers.reduce((n, m) => n + m.subscription_revenue, 0);

  const selectedDayData =
    selectedDay != null
      ? weekDays.find((d) => d.day === selectedDay) ?? null
      : null;

  // Reps shown in the open field-day table: members the backend logged for that
  // day, plus any cohort members currently positioned on it who haven't logged
  // yet (as a zero-state row) — so the table matches the tile count instead of
  // reading "no reps logged" for a cohort that has only just reached this day.
  const selectedDayReps: AcpWeekDayRep[] = (() => {
    if (!selectedDayData || selectedDayData.activity_type === "training") {
      return [];
    }
    const reps = [...selectedDayData.reps];
    const seen = new Set(reps.map((r) => r.member_id));
    for (const m of membersByDayInWeek.get(selectedDayData.day) ?? []) {
      if (seen.has(m.id)) continue;
      reps.push({
        member_id: m.id,
        name: m.name,
        tag: m.tag,
        review: latestReviewFor(m),
        sprint_revenue: 0,
        has_audio: false,
        visited_count: 0,
        sprint_accepted_count: 0,
      });
    }
    return reps;
  })();

  // Active members whose latest review matches the open review card.
  const reviewSheetMembers = reviewSheet
    ? activeMembers.filter((m) => latestReviewFor(m) === reviewSheet)
    : [];

  // Status filter pills for the All-members card — badge counts stay on the
  // full roster so they read as totals, not the post-search subset.
  const memberFilters: {
    key: "all" | "active" | "fired";
    label: string;
    count: number;
    dot?: string;
  }[] = [
    { key: "all", label: "All", count: memberStats.total },
    {
      key: "active",
      label: "Active",
      count: memberStats.active,
      dot: "bg-emerald-500",
    },
    {
      key: "fired",
      label: "Fired",
      count: memberStats.fired,
      dot: "bg-rose-500",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-zinc-500">
        <Link
          href="/sales/accelerator"
          className="transition-colors hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          All batches
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        <span className="font-medium text-zinc-900 dark:text-zinc-100">
          {b?.name ?? "Batch"}
        </span>
      </div>

      <PageHeader
        title={b?.name ?? "Batch"}
        description={b?.location}
        actions={
          <div className="flex items-center gap-2">
            <BatchAlerts
              batchId={batchId}
              members={memberList}
              onOpenRep={openRep}
            />
            <Button onClick={() => setShowAddMember(true)}>
              <Plus className="h-4 w-4" aria-hidden />
              Add member
            </Button>
          </div>
        }
      />

      {batch.error ? (
        <Card className="p-6 text-center text-sm text-rose-600 dark:text-rose-400">
          Couldn&apos;t load batch: {errorMessage(batch.error)}
        </Card>
      ) : null}

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4 sm:p-5">
          <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
            <Users className="h-4 w-4 text-zinc-400" aria-hidden />
            Members
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <div>
              <div className="text-xl font-bold leading-none tabular-nums">
                {memberStats.total}
              </div>
              <div className="mt-1 text-[10px] uppercase tracking-wider text-zinc-400">
                Total
              </div>
            </div>
            <div>
              <div className="text-xl font-bold leading-none tabular-nums text-emerald-600 dark:text-emerald-400">
                {memberStats.active}
              </div>
              <div className="mt-1 text-[10px] uppercase tracking-wider text-zinc-400">
                Active
              </div>
            </div>
            <div>
              <div className="text-xl font-bold leading-none tabular-nums text-rose-600 dark:text-rose-400">
                {memberStats.fired}
              </div>
              <div className="mt-1 text-[10px] uppercase tracking-wider text-zinc-400">
                Fired
              </div>
            </div>
          </div>
        </Card>
        <StatCard
          icon={Zap}
          label="Sprints"
          value={stats.data?.total_sprints ?? 0}
          tone="amber"
        />
        <StatCard
          icon={IndianRupee}
          label="Sprint ₹"
          value={acpFmt(sprintRev)}
          tone="amber"
        />
        <StatCard
          icon={TrendingUp}
          label="Sub ₹"
          value={acpFmt(subRev)}
          tone="good"
        />
      </div>

      {/* Top performers + Fire list */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <div className="flex items-center gap-2 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <Star className="h-4 w-4 text-emerald-500" aria-hidden />
            <span className="text-sm font-semibold">Top performers</span>
          </div>
          {members.isLoading && topPerformers.length === 0 ? (
            <div className="p-6 text-center text-sm text-zinc-500">Loading…</div>
          ) : topPerformers.length === 0 ? (
            <div className="p-6 text-center text-sm text-zinc-500">
              No active members yet.
            </div>
          ) : (
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {topPerformers.map((p, i) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => openRep(p.id)}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/60"
                  >
                    <span className="w-4 text-sm font-semibold text-zinc-400 tabular-nums">
                      {i + 1}
                    </span>
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="text-[10px]">
                        {getInitials(p.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {p.name}
                    </span>
                    <span className="text-sm font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                      {acpFmt(p.total)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="overflow-hidden">
          <div className="flex items-center gap-2 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <Flame className="h-4 w-4 text-rose-500" aria-hidden />
            <span className="text-sm font-semibold">Attention / Fire list</span>
          </div>
          {members.isLoading && fireList.length === 0 ? (
            <div className="p-6 text-center text-sm text-zinc-500">Loading…</div>
          ) : fireList.length === 0 ? (
            <div className="p-6 text-center text-sm text-zinc-500">
              No active members yet.
            </div>
          ) : (
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {fireList.map((p, i) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => openRep(p.id)}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/60"
                  >
                    <span className="w-4 text-sm font-semibold text-zinc-400 tabular-nums">
                      {i + 1}
                    </span>
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="text-[10px]">
                        {getInitials(p.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {p.name}
                    </span>
                    <span className="text-sm font-semibold tabular-nums text-rose-600 dark:text-rose-400">
                      {acpFmt(p.total)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* All members — full roster, fixed height + internal scroll so a large
          batch doesn't stretch the page. */}
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-violet-500" aria-hidden />
              <span className="text-sm font-semibold">All members</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-zinc-500">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
                Total{" "}
                <span className="font-semibold tabular-nums text-zinc-700 dark:text-zinc-200">
                  {memberStats.total}
                </span>
              </span>
              <span className="h-3 w-px bg-zinc-200 dark:bg-zinc-700" />
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Active{" "}
                <span className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {memberStats.active}
                </span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                Fired{" "}
                <span className="font-semibold tabular-nums text-rose-600 dark:text-rose-400">
                  {memberStats.fired}
                </span>
              </span>
            </div>
          </div>
          <span className="text-xs tabular-nums text-zinc-500">
            {memberStats.total}
          </span>
        </div>

        {/* Filter pills + search */}
        <div className="flex flex-col gap-3 border-b border-zinc-100 px-4 py-3 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {memberFilters.map((f) => {
              const active = memberFilter === f.key;
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setMemberFilter(f.key)}
                  aria-pressed={active}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
                    active
                      ? "border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-300"
                      : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800/60",
                  )}
                >
                  {f.dot ? (
                    <span className={cn("h-1.5 w-1.5 rounded-full", f.dot)} />
                  ) : null}
                  {f.label}
                  <span
                    className={cn(
                      "rounded-md px-1.5 py-0.5 text-xs tabular-nums",
                      active
                        ? "bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-200"
                        : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
                    )}
                  >
                    {f.count}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="relative w-full sm:w-64">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
              aria-hidden
            />
            <Input
              type="search"
              value={memberQuery}
              onChange={(e) => setMemberQuery(e.target.value)}
              placeholder="Search members"
              aria-label="Search members"
              className="pl-9"
            />
          </div>
        </div>

        {members.isLoading && memberList.length === 0 ? (
          <div className="p-6 text-center text-sm text-zinc-500">Loading…</div>
        ) : memberList.length === 0 ? (
          <div className="p-6 text-center text-sm text-zinc-500">
            No members yet.
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="p-6 text-center text-sm text-zinc-500">
            No members match{" "}
            {memberQuery.trim() ? `“${memberQuery.trim()}”` : "this filter"}.
          </div>
        ) : (
          <ul className="max-h-96 divide-y divide-zinc-100 overflow-y-auto dark:divide-zinc-800">
            {filteredMembers.map((m, i) => {
              const fired = m.status === "inactive" || m.tag === "fired";
              return (
                <li
                  key={m.id}
                  className="group flex items-center pr-2 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/60"
                >
                  <button
                    type="button"
                    onClick={() => openRep(m.id)}
                    className={cn(
                      "flex min-w-0 flex-1 items-center gap-3 px-4 py-2.5 text-left",
                      fired && "opacity-60",
                    )}
                  >
                    <span className="w-4 shrink-0 text-sm font-semibold tabular-nums text-zinc-400">
                      {i + 1}
                    </span>
                    <Avatar className="h-7 w-7">
                      <AvatarFallback
                        className={cn(
                          "text-[10px]",
                          fired
                            ? "bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500"
                            : "bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300",
                        )}
                      >
                        {getInitials(m.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "block truncate text-sm font-medium",
                          fired && "text-zinc-500 dark:text-zinc-400",
                        )}
                      >
                        {m.name}
                      </span>
                      <span className="block truncate text-xs text-zinc-500">
                        {fired
                          ? `Fired ${fmtJoinDate(m.ending_at ?? m.joined_at)}`
                          : `Joined ${fmtJoinDate(m.joined_at)}`}
                      </span>
                    </span>
                    {fired ? (
                      <span className="rounded-md bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                        Fired
                      </span>
                    ) : (
                      <span className="rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                        Active
                      </span>
                    )}
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        aria-label={`Actions for ${m.name}`}
                        className="ml-1 shrink-0 rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-200/70 hover:text-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-zinc-200/70 dark:hover:bg-zinc-700/60 dark:hover:text-zinc-200 dark:data-[state=open]:bg-zinc-700/60"
                      >
                        <MoreHorizontal className="h-4 w-4" aria-hidden />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => openRep(m.id)}>
                        <UserCircle className="text-zinc-500" aria-hidden />
                        Open profile
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        // Defer so the menu finishes closing before the confirm
                        // dialog opens (avoids a Radix overlay focus clash).
                        onSelect={() => setTimeout(() => setRemoveTarget(m), 0)}
                        className="text-rose-600 focus:bg-rose-50 focus:text-rose-700 dark:text-rose-400 dark:focus:bg-rose-950/40 dark:focus:text-rose-300"
                      >
                        <Trash2 aria-hidden />
                        Remove from program
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* Weekly board */}
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Weekly board</h2>
        <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-8">
          {WEEK_CONFIG.map((w) => {
            const active = selectedWeek === w.n;
            return (
              <button
                key={w.n}
                type="button"
                onClick={() => selectWeek(w.n)}
                className={cn(
                  "rounded-lg border p-2 text-center transition-colors",
                  active
                    ? "border-violet-400 bg-violet-50 dark:border-violet-700 dark:bg-violet-950/30"
                    : "border-zinc-200 bg-white hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800/60",
                )}
              >
                <div className="text-sm font-bold">W{w.n}</div>
                <div className="mt-0.5 truncate text-[10px] text-zinc-500">
                  {w.title}
                </div>
                <div
                  className={cn(
                    "mt-1 text-sm font-bold tabular-nums",
                    (weekCounts[w.n] ?? 0) > 0
                      ? "text-violet-600 dark:text-violet-400"
                      : "text-zinc-300 dark:text-zinc-700",
                  )}
                >
                  {weekCounts[w.n] ?? 0}
                </div>
              </button>
            );
          })}
        </div>

        {selectedWeek != null ? (
          <div className="mt-4 space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-violet-600 dark:text-violet-400">
                W{selectedWeek}
              </span>
              <span className="text-sm text-zinc-500">
                {WEEK_SUBTITLE[selectedWeek] ?? weekTitle(selectedWeek)}
              </span>
            </div>

            {/* Review summary cards */}
            <div className="grid grid-cols-3 gap-3">
              {REVIEW_KEYS.map((key) => {
                const meta = REVIEW_META[key];
                const Icon = meta.icon;
                const count = reviewCounts[key];
                const lit = count > 0;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setReviewSheet(key)}
                    className={cn(
                      "rounded-xl border p-4 text-center transition-colors hover:border-zinc-300 dark:hover:border-zinc-700",
                      lit
                        ? meta.card
                        : "border-zinc-200 bg-white text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900",
                    )}
                  >
                    <Icon className="mx-auto h-4 w-4" aria-hidden />
                    <div className="mt-2 text-2xl font-bold tabular-nums">
                      {count}
                    </div>
                    <div className="mt-1 text-[10px] font-semibold uppercase tracking-wider">
                      {meta.label}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Day tiles */}
            {weekView.isLoading && !weekView.data ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Card key={i} className="h-24 animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                {weekDays.map((d) => {
                  const isTraining = d.activity_type === "training";
                  return (
                    <DayTile
                      key={d.day}
                      day={d}
                      memberCount={(membersByDayInWeek.get(d.day) ?? []).length}
                      selected={
                        isTraining
                          ? rosterDay === d.day
                          : selectedDay === d.day
                      }
                      onClick={() =>
                        isTraining
                          ? setRosterDay((prev) =>
                              prev === d.day ? null : d.day,
                            )
                          : selectDay(d.day)
                      }
                    />
                  );
                })}
              </div>
            )}

            {/* Day rep table */}
            {selectedDayData &&
            selectedDayData.activity_type !== "training" ? (
              <Card className="overflow-hidden">
                <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
                  <span className="text-sm font-semibold">
                    Day {selectedDayData.day}{" "}
                    <span className="font-normal text-zinc-500">
                      {selectedDayReps.length} rep
                      {selectedDayReps.length === 1 ? "" : "s"}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedDay(null)}
                    className="rounded-md p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800"
                    aria-label="Collapse"
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                </div>

                {selectedDayReps.length === 0 ? (
                  <div className="p-8 text-center text-sm text-zinc-500">
                    No reps logged this day.
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 border-b border-zinc-100 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:border-zinc-800">
                      <span>Rep</span>
                      <span className="text-right">Review</span>
                      <span className="text-right">Sprint ₹</span>
                      <span className="text-right">Audio</span>
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {selectedDayReps.map((rep) => {
                        const member = memberById.get(rep.member_id);
                        const review = member
                          ? latestReviewFor(member)
                          : rep.review;
                        const meta = review ? REVIEW_META[review] : null;
                        return (
                          <button
                            key={rep.member_id}
                            type="button"
                            onClick={() => openRep(rep.member_id)}
                            className="grid w-full grid-cols-[1fr_auto_auto_auto] items-center gap-3 border-b border-zinc-100 px-4 py-2.5 text-left transition-colors last:border-b-0 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/60"
                          >
                            <span className="flex min-w-0 items-center gap-2.5">
                              <span
                                className={cn(
                                  "h-8 w-1 shrink-0 rounded-full",
                                  reviewBar(review),
                                )}
                              />
                              <Avatar className="h-7 w-7">
                                <AvatarFallback className="text-[10px]">
                                  {getInitials(rep.name)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-medium">
                                  {rep.name}
                                </span>
                                <span className="block truncate text-xs text-zinc-500">
                                  {rep.visited_count} visited
                                  {rep.sprint_accepted_count > 0
                                    ? ` · ${rep.sprint_accepted_count} accepted`
                                    : ""}
                                </span>
                              </span>
                            </span>
                            <span className="text-right">
                              {meta ? (
                                <span
                                  className={cn(
                                    "rounded px-1.5 py-0.5 text-[11px] font-semibold",
                                    meta.badge,
                                  )}
                                >
                                  {meta.label}
                                </span>
                              ) : (
                                <span className="text-xs text-zinc-400">
                                  No review
                                </span>
                              )}
                            </span>
                            <span className="text-right text-sm font-semibold tabular-nums">
                              {rep.sprint_revenue > 0
                                ? acpFmt(rep.sprint_revenue)
                                : "—"}
                            </span>
                            <span className="flex justify-end">
                              {rep.has_audio ? (
                                <Mic
                                  className="h-3.5 w-3.5 text-violet-500"
                                  aria-hidden
                                />
                              ) : (
                                <span className="text-xs text-zinc-400">—</span>
                              )}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </Card>
            ) : null}
          </div>
        ) : (
          <Card className="mt-4 p-8 text-center text-sm text-zinc-500">
            Select a week above to view the daily review board.
          </Card>
        )}
      </div>

      <AddMemberModal
        open={showAddMember}
        onOpenChange={setShowAddMember}
        batchId={batchId}
        batchName={b?.name ?? "this batch"}
        onAdded={() => {
          members.refetch();
          stats.refetch();
        }}
      />

      {/* Confirm un-enrolling a rep from the program. */}
      <Dialog
        open={removeTarget != null}
        onOpenChange={(o) => {
          if (!o && !removing) setRemoveTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
              <Trash2 className="h-4 w-4" aria-hidden />
              Remove from program
            </DialogTitle>
            <DialogDescription>
              Remove{" "}
              <span className="font-medium text-zinc-800 dark:text-zinc-100">
                {removeTarget?.name}
              </span>{" "}
              from the Accelerator? Their sales account and pipeline leads are
              preserved — only their ACP membership, daily logs and sprints are
              removed. This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRemoveTarget(null)}
              disabled={removing}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleRemoveMember}
              disabled={removing}
            >
              {removing ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Trash2 className="h-4 w-4" aria-hidden />
              )}
              Remove from program
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <RosterSheet
        open={rosterDay != null}
        title={`Day ${rosterDay} · Training`}
        subtitle={(() => {
          const n =
            rosterDay != null ? (membersByDayInWeek.get(rosterDay) ?? []).length : 0;
          return `${n} member${n === 1 ? "" : "s"} in training`;
        })()}
        emptyText="No members on this day yet."
        members={
          rosterDay != null ? (membersByDayInWeek.get(rosterDay) ?? []) : []
        }
        onClose={() => setRosterDay(null)}
      />

      <RosterSheet
        open={reviewSheet != null}
        title={reviewSheet ? REVIEW_META[reviewSheet].label : ""}
        subtitle={`${reviewSheetMembers.length} rep${
          reviewSheetMembers.length === 1 ? "" : "s"
        }`}
        emptyText="No reps with this review yet."
        members={reviewSheetMembers}
        onClose={() => setReviewSheet(null)}
      />
    </div>
  );
}

/** Joining date, e.g. "May 22, 2026". Falls back to the raw YMD prefix. */
function fmtJoinDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Minimal roster sidebar — lists members as rows (index · name · joining
 * date) with no extra detail. Reused for the training-day cohort and the
 * review-summary breakdown.
 */
function RosterSheet({
  open,
  title,
  subtitle,
  emptyText,
  members,
  onClose,
}: {
  open: boolean;
  title: string;
  subtitle: string;
  emptyText: string;
  members: AcpMember[];
  onClose: () => void;
}) {
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:w-[420px] sm:max-w-none"
      >
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <p className="text-sm text-zinc-500">{subtitle}</p>
        </SheetHeader>

        {members.length === 0 ? (
          <div className="p-8 text-center text-sm text-zinc-500">
            {emptyText}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-[2rem_1fr_auto] gap-3 border-b border-zinc-100 px-6 py-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:border-zinc-800">
              <span>#</span>
              <span>Rep</span>
              <span className="text-right">Joined</span>
            </div>
            <div className="flex-1 overflow-y-auto">
              {members.map((m, i) => (
                <div
                  key={m.id}
                  className="grid grid-cols-[2rem_1fr_auto] items-center gap-3 border-b border-zinc-100 px-6 py-3 last:border-b-0 dark:border-zinc-800"
                >
                  <span className="text-sm font-semibold tabular-nums text-zinc-400">
                    {i + 1}
                  </span>
                  <span className="flex min-w-0 items-center gap-2.5">
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="text-[10px]">
                        {getInitials(m.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="min-w-0 truncate text-sm font-medium">
                      {m.name}
                    </span>
                  </span>
                  <span className="text-right text-xs tabular-nums text-zinc-500">
                    {fmtJoinDate(m.joined_at)}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function DayTile({
  day,
  selected,
  memberCount,
  onClick,
}: {
  day: AcpWeekDay;
  selected: boolean;
  /** Active members whose current day-in-week lands on this tile (cohort
   *  position today). Used on every day type so the per-day counts sum to the
   *  week button's count — a field day where the cohort currently sits reads
   *  the cohort size, not just reps who have already logged field activity. */
  memberCount: number;
  onClick: () => void;
}) {
  const meta = ACTIVITY_META[day.activity_type];
  const Icon = meta.icon;
  const isTraining = day.activity_type === "training";

  if (isTraining) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "rounded-xl border border-dashed p-4 text-center transition-colors",
          selected
            ? "border-violet-400 bg-violet-100 dark:border-violet-600 dark:bg-violet-950/40"
            : "border-violet-200 bg-violet-50/40 hover:bg-violet-50 dark:border-violet-900/50 dark:bg-violet-950/10 dark:hover:bg-violet-950/30",
        )}
      >
        <Icon
          className="mx-auto h-5 w-5 text-violet-400 dark:text-violet-500"
          aria-hidden
        />
        <div className="mt-2 text-sm font-semibold text-zinc-500">
          Day {day.day}
        </div>
        <div className="mt-0.5 text-[10px] uppercase tracking-wider text-violet-500/80">
          Training day
        </div>
        <div className="mt-1 text-2xl font-bold tabular-nums text-violet-600 dark:text-violet-400">
          {memberCount}
        </div>
        <div className="text-[10px] text-zinc-400">members</div>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-xl border p-4 text-center transition-colors",
        selected
          ? "border-violet-400 bg-violet-50 dark:border-violet-700 dark:bg-violet-950/30"
          : "border-zinc-200 bg-white hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800/60",
      )}
    >
      <div className="text-sm font-semibold">Day {day.day}</div>
      <div className="mt-0.5 text-[10px] uppercase tracking-wider text-zinc-400">
        {meta.label}
      </div>
      <div className="mt-1 text-2xl font-bold tabular-nums">
        {memberCount}
      </div>
      <div className="text-[10px] text-zinc-400">reps</div>
    </button>
  );
}
