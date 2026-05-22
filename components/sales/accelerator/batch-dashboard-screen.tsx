"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronRight,
  Flame,
  IndianRupee,
  MapPin,
  Mic,
  Plus,
  Star,
  TrendingUp,
  Users,
  X,
  Zap,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
  useAcpWeekView,
} from "@/lib/hooks/use-accelerator";
import type {
  AcpMember,
  AcpReview,
  AcpWeekDay,
} from "@/lib/api/sales-accelerator";
import { REVIEW_KEYS } from "@/lib/api/sales-accelerator";
import { cn } from "@/lib/utils";

import {
  acpFmt,
  ACTIVITY_META,
  getRepWeek,
  REVIEW_META,
  reviewBar,
  SectionLabel,
  StatCard,
  TAG_META,
  WEEK_CONFIG,
  weekTitle,
} from "./acp-shared";
import { AddMemberModal } from "./add-member-modal";
import { RepDetailPanel } from "./rep-detail-panel";

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
  const batch = useAcpBatch(batchId);
  const stats = useAcpBatchStats(batchId);
  const members = useAcpMembers(batchId);

  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  // Training days have no per-day rep logs, so clicking one opens a roster
  // sidebar of the week's members instead of the field-day detail table.
  const [rosterDay, setRosterDay] = useState<number | null>(null);
  const [selectedRepId, setSelectedRepId] = useState<string | null>(null);
  const [showAddMember, setShowAddMember] = useState(false);
  // Lifted review state: "repId:date" -> review. Keeps the week summary cards
  // and day table in sync the instant a review is changed in the rep panel.
  const [reviewOverrides, setReviewOverrides] = useState<
    Record<string, AcpReview>
  >({});

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

  // Most recent review for a rep. A review changed this session (an override)
  // always reflects the admin's latest action, so the newest override wins;
  // otherwise fall back to the server's `latest_review`.
  const latestReviewFor = useMemo(() => {
    return (member: AcpMember): AcpReview | null => {
      let bestDate: string | null = null;
      let bestReview: AcpReview | null = null;
      const prefix = `${member.id}:`;
      for (const [key, val] of Object.entries(reviewOverrides)) {
        if (!key.startsWith(prefix)) continue;
        const date = key.slice(prefix.length);
        if (!bestDate || date >= bestDate) {
          bestDate = date;
          bestReview = val;
        }
      }
      return bestReview ?? member.current_review ?? null;
    };
  }, [reviewOverrides]);

  const reviewCounts = useMemo(() => {
    const counts: Record<AcpReview, number> = {
      working_fine: 0,
      observation: 0,
      needs_improvement: 0,
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

  const fireList = useMemo(
    () =>
      memberList.filter(
        (m) =>
          m.tag === "fired" ||
          m.tag === "firing_zone" ||
          m.tag === "at_risk" ||
          m.tag === "close_monitoring",
      ),
    [memberList],
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

  const onReviewChange = (repId: string, date: string, review: AcpReview) =>
    setReviewOverrides((prev) => ({ ...prev, [`${repId}:${date}`]: review }));

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
  const activeCount = stats.data?.active_members ?? activeMembers.length;
  const totalCount = stats.data?.total_members ?? memberList.length;

  const selectedDayData =
    selectedDay != null
      ? weekView.data?.days.find((d) => d.day === selectedDay) ?? null
      : null;

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
          <Button onClick={() => setShowAddMember(true)}>
            <Plus className="h-4 w-4" aria-hidden />
            Add member
          </Button>
        }
      />

      {batch.error ? (
        <Card className="p-6 text-center text-sm text-rose-600 dark:text-rose-400">
          Couldn&apos;t load batch: {errorMessage(batch.error)}
        </Card>
      ) : null}

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Users}
          label="Members"
          value={`${activeCount}/${totalCount}`}
        />
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
                    onClick={() => setSelectedRepId(p.id)}
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
          {fireList.length === 0 ? (
            <div className="p-6 text-center text-sm text-zinc-500">
              Everyone&apos;s on track. 🎉
            </div>
          ) : (
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {fireList.map((m) => {
                const meta = TAG_META[m.tag];
                return (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedRepId(m.id)}
                      className={cn(
                        "flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/60",
                        meta.rowTint,
                      )}
                    >
                      <Avatar className="h-7 w-7">
                        <AvatarFallback className="text-[10px]">
                          {getInitials(m.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">
                        {m.name}
                      </span>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[11px] font-medium",
                          meta.badge,
                        )}
                      >
                        {meta.label}
                      </span>
                    </button>
                  </li>
                );
              })}
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
        {members.isLoading && memberList.length === 0 ? (
          <div className="p-6 text-center text-sm text-zinc-500">Loading…</div>
        ) : memberList.length === 0 ? (
          <div className="p-6 text-center text-sm text-zinc-500">
            No members yet.
          </div>
        ) : (
          <ul className="max-h-96 divide-y divide-zinc-100 overflow-y-auto dark:divide-zinc-800">
            {memberList.map((m, i) => {
              const fired = m.status === "inactive" || m.tag === "fired";
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedRepId(m.id)}
                    className={cn(
                      "flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/60",
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
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {REVIEW_KEYS.map((key) => {
                const meta = REVIEW_META[key];
                const Icon = meta.icon;
                const count = reviewCounts[key];
                const lit = count > 0;
                return (
                  <div
                    key={key}
                    className={cn(
                      "rounded-xl border p-4 text-center transition-colors",
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
                  </div>
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
                {(weekView.data?.days ?? []).map((d) => {
                  const isTraining = d.activity_type === "training";
                  return (
                    <DayTile
                      key={d.day}
                      day={d}
                      trainingCount={(membersByDayInWeek.get(d.day) ?? []).length}
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
                      {selectedDayData.reps.length} rep
                      {selectedDayData.reps.length === 1 ? "" : "s"}
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

                {selectedDayData.reps.length === 0 ? (
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
                      {selectedDayData.reps.map((rep) => {
                        const member = memberById.get(rep.member_id);
                        const review = member
                          ? latestReviewFor(member)
                          : rep.review;
                        const meta = review ? REVIEW_META[review] : null;
                        return (
                          <button
                            key={rep.member_id}
                            type="button"
                            onClick={() => setSelectedRepId(rep.member_id)}
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

      <RepDetailPanel
        memberId={selectedRepId}
        onClose={() => setSelectedRepId(null)}
        onReviewChange={onReviewChange}
        onMemberChanged={() => {
          members.refetch();
          stats.refetch();
        }}
      />

      <DayRosterSheet
        day={rosterDay}
        members={
          rosterDay != null ? (membersByDayInWeek.get(rosterDay) ?? []) : []
        }
        onClose={() => setRosterDay(null)}
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
 * Training-day roster — a minimal right sidebar listing the week's members as
 * rows (index · name · joining date). Training days carry no per-rep activity,
 * so this is intentionally just the cohort, not the field-day detail table.
 */
function DayRosterSheet({
  day,
  members,
  onClose,
}: {
  day: number | null;
  members: AcpMember[];
  onClose: () => void;
}) {
  return (
    <Sheet open={day != null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:w-[420px] sm:max-w-none"
      >
        <SheetHeader>
          <SheetTitle>Day {day} · Training</SheetTitle>
          <p className="text-sm text-zinc-500">
            {members.length} member{members.length === 1 ? "" : "s"} in training
          </p>
        </SheetHeader>

        {members.length === 0 ? (
          <div className="p-8 text-center text-sm text-zinc-500">
            No members on this day yet.
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
  trainingCount,
  onClick,
}: {
  day: AcpWeekDay;
  selected: boolean;
  trainingCount: number;
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
          {trainingCount}
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
        {day.reps.length}
      </div>
      <div className="text-[10px] text-zinc-400">reps</div>
    </button>
  );
}
