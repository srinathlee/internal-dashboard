"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Bell,
  Calendar as CalendarIcon,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Mail,
  MapPin,
  MoreHorizontal,
  Phone,
  Plus,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/layout/page-header";
import { useAuth } from "@/lib/auth";
import { isSalesMember } from "@/lib/access";
import { cn } from "@/lib/utils";
import { errorMessage } from "@/lib/hooks/use-async";
import {
  useFollowUpMutations,
  useFollowUpsCalendar,
  useFollowUpsList,
  useUpcomingFollowUps,
} from "@/lib/hooks/use-follow-ups";
import {
  useNotificationCount,
  useNotificationMutations,
  useNotifications,
} from "@/lib/hooks/use-notifications";
import type {
  ApiFollowUp,
  ApiFollowUpStatus,
  ApiFollowUpType,
  CalendarFollowUp,
} from "@/lib/api/sales-follow-ups";
import type { ApiNotification } from "@/lib/api/sales-notifications";

// =================================================================
// UI ⇄ API adapters
// =================================================================
//
// The API uses uppercase enums; the UI keeps lowercase identifiers so
// existing styling lookups (TYPE_META / STATUS_META) keep working without
// a sweeping rename.

type FollowUpType = "call" | "meeting" | "visit" | "email" | "other";
type FollowUpStatus = "pending" | "done" | "missed";
type Filter = "all" | "pending" | "done" | "missed";

interface FollowUp {
  id: string;
  type: FollowUpType;
  /** Mirrors the API status for round-tripping (mutations need it). */
  apiStatus: ApiFollowUpStatus;
  title: string;
  /** Secondary line — description from the API, "—" when empty. */
  location: string;
  note?: string;
  scheduledAt: string;
  status: FollowUpStatus;
}

function apiTypeToUi(t: ApiFollowUpType): FollowUpType {
  switch (t) {
    case "CALL":
      return "call";
    case "MEETING":
      return "meeting";
    case "VISIT":
      return "visit";
    case "EMAIL":
      return "email";
    default:
      return "other";
  }
}

function uiTypeToApi(t: FollowUpType): ApiFollowUpType {
  switch (t) {
    case "call":
      return "CALL";
    case "meeting":
      return "MEETING";
    case "visit":
      return "VISIT";
    case "email":
      return "EMAIL";
    default:
      return "OTHER";
  }
}

/**
 * COMPLETED → "done". PENDING → "pending". Everything else (CANCELLED,
 * MISSED) collapses to "missed" — the design only has three status pills,
 * and a rep-cancelled item reads the same as a server-marked-missed one in
 * the All table filter.
 */
function apiStatusToUi(s: ApiFollowUpStatus): FollowUpStatus {
  if (s === "COMPLETED") return "done";
  if (s === "PENDING") return "pending";
  return "missed";
}

function uiStatusFilterToApi(f: Filter): ApiFollowUpStatus[] | undefined {
  switch (f) {
    case "pending":
      return ["PENDING"];
    case "done":
      return ["COMPLETED"];
    case "missed":
      return ["MISSED", "CANCELLED"];
    default:
      return undefined;
  }
}

function adaptFollowUp(api: ApiFollowUp): FollowUp {
  return {
    id: api.id,
    type: apiTypeToUi(api.type),
    apiStatus: api.status,
    title: api.title,
    location: api.description?.trim() ? api.description : "—",
    note: api.description?.trim() ? api.description : undefined,
    scheduledAt: api.follow_up_at,
    status: apiStatusToUi(api.status),
  };
}

function adaptCalendarFollowUp(api: CalendarFollowUp): FollowUp {
  return {
    id: api.id,
    type: apiTypeToUi(api.type),
    apiStatus: api.status,
    title: api.title,
    location: "—",
    scheduledAt: api.follow_up_at,
    status: apiStatusToUi(api.status),
  };
}

// =================================================================
// Helpers
// =================================================================

const TYPE_META: Record<FollowUpType, { label: string; icon: LucideIcon; iconClass: string; tileClass: string }> = {
  call:    { label: "Call",    icon: Phone, iconClass: "text-violet-500", tileClass: "bg-violet-50 dark:bg-violet-950/40" },
  meeting: { label: "Meeting", icon: Users, iconClass: "text-violet-500", tileClass: "bg-violet-50 dark:bg-violet-950/40" },
  visit:   { label: "Visit",   icon: MapPin, iconClass: "text-amber-500", tileClass: "bg-amber-50 dark:bg-amber-950/40" },
  email:   { label: "Email",   icon: Mail,   iconClass: "text-sky-500",   tileClass: "bg-sky-50 dark:bg-sky-950/40" },
  other:   { label: "Other",   icon: MoreHorizontal, iconClass: "text-zinc-500", tileClass: "bg-zinc-100 dark:bg-zinc-900" },
};

const STATUS_META: Record<FollowUpStatus, { label: string; badgeClass: string }> = {
  pending: { label: "Pending", badgeClass: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" },
  done:    { label: "Done",    badgeClass: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" },
  missed:  { label: "Missed",  badgeClass: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300" },
};

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function diffInDays(from: Date, to: Date): number {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatRelativeDate(iso: string, today: Date): string {
  const d = new Date(iso);
  const days = diffInDays(today, d);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Local `YYYY-MM-DD` — matches the spec's date param format. */
function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// =================================================================
// Screen
// =================================================================

export function FollowUpsScreen() {
  const auth = useAuth();

  // Pinning "now" per render keeps every derived list referring to the same
  // instant — otherwise an entry could land in two buckets at a ms boundary.
  const now = useMemo(() => new Date(), []);

  const [calendarMonth, setCalendarMonth] = useState(
    () => new Date(now.getFullYear(), now.getMonth(), 1),
  );
  // Day the right-hand card is currently focused on. Defaults to today.
  // Clicking a date in the calendar updates this and triggers a per-day
  // fetch via `useFollowUpsList({ date })` (spec workflow #2).
  const [selectedDate, setSelectedDate] = useState<Date>(() => now);
  const [filter, setFilter] = useState<Filter>("all");
  const [createOpen, setCreateOpen] = useState(false);

  const selectedYmd = toYmd(selectedDate);
  const isSelectedToday = isSameDay(selectedDate, now);

  // ---------- Data ----------
  const calendarQuery = useFollowUpsCalendar(
    calendarMonth.getFullYear(),
    calendarMonth.getMonth() + 1,
  );
  const upcomingQuery = useUpcomingFollowUps(7);
  const listQuery = useFollowUpsList({
    status: uiStatusFilterToApi(filter),
    limit: 200,
  });
  // Per-day items for the right-hand card. Refetches whenever the user
  // clicks a different date in the calendar.
  const selectedDayQuery = useFollowUpsList({
    date: selectedYmd,
    limit: 200,
  });

  const mutations = useFollowUpMutations();

  // Calendar dots — flatten the per-day payload into a FollowUp[] shaped
  // for the existing CalendarCard component (which only reads scheduledAt +
  // status to decide which days light up).
  const calendarItems = useMemo<FollowUp[]>(() => {
    const map = calendarQuery.data?.calendar;
    if (!map) return [];
    const out: FollowUp[] = [];
    for (const list of Object.values(map)) {
      for (const f of list) out.push(adaptCalendarFollowUp(f));
    }
    return out;
  }, [calendarQuery.data]);

  // Selected-day items (all statuses, chronological by time of day).
  const selectedDayItems = useMemo<FollowUp[]>(
    () =>
      (selectedDayQuery.data?.follow_ups ?? [])
        .map(adaptFollowUp)
        .sort(
          (a, b) =>
            +new Date(a.scheduledAt) - +new Date(b.scheduledAt),
        ),
    [selectedDayQuery.data],
  );

  // Upcoming card — pending items in the next 7 days, excluding today since
  // today already has its own card. Drives the "Next 7 days" panel.
  const upcomingTabItems = useMemo<FollowUp[]>(
    () =>
      (upcomingQuery.data?.upcoming ?? [])
        .map(adaptFollowUp)
        .filter((f) => !isSameDay(new Date(f.scheduledAt), now))
        .sort(
          (a, b) =>
            +new Date(a.scheduledAt) - +new Date(b.scheduledAt),
        ),
    [upcomingQuery.data, now],
  );

  const overdueCount = upcomingQuery.data?.overdue_count ?? 0;
  const allItems = useMemo<FollowUp[]>(
    () => listQuery.data?.follow_ups.map(adaptFollowUp) ?? [],
    [listQuery.data],
  );

  // After any mutation, refresh whichever caches are visibly affected. Each
  // hook tracks its own loading state, so individual cards keep rendering
  // their last good data while the background refetch is in flight.
  const refreshAll = useCallback(() => {
    void calendarQuery.refetch();
    void upcomingQuery.refetch();
    void listQuery.refetch();
    void selectedDayQuery.refetch();
  }, [calendarQuery, upcomingQuery, listQuery, selectedDayQuery]);

  // ---------- Mutations ----------
  const markDone = async (id: string) => {
    try {
      await mutations.complete(id);
      refreshAll();
    } catch (err) {
      toast.error("Couldn't mark complete", { description: errorMessage(err) });
    }
  };

  /** UI "X" dismiss. Maps to CANCELLED on the wire (rep-driven, not server-detected). */
  const markMissed = async (id: string) => {
    try {
      await mutations.update(id, { status: "CANCELLED" });
      refreshAll();
    } catch (err) {
      toast.error("Couldn't dismiss follow-up", {
        description: errorMessage(err),
      });
    }
  };

  const createFollowUp = async (draft: NewFollowUpDraft) => {
    try {
      await mutations.create({
        title: draft.title,
        description: draft.description || undefined,
        follow_up_at: new Date(draft.scheduledAt).toISOString(),
        type: uiTypeToApi(draft.type),
      });
      toast.success("Follow-up scheduled");
      refreshAll();
    } catch (err) {
      toast.error("Couldn't create follow-up", {
        description: errorMessage(err),
      });
    }
  };

  if (!auth.isLoaded) {
    return (
      <div className="space-y-4">
        <Card className="h-20 animate-pulse" />
        <Card className="h-96 animate-pulse" />
      </div>
    );
  }

  if (!isSalesMember(auth)) {
    return (
      <Card className="p-12 text-center text-sm text-zinc-500">
        Follow-ups is a sales-rep workspace.
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Follow-ups"
        description="Schedule and track your calls, meetings, and visits."
        actions={
          <>
            <NotificationsPopover />
            <Button
              onClick={() => setCreateOpen(true)}
              className="bg-violet-600 hover:bg-violet-500"
            >
              <Plus className="h-4 w-4" />
              New follow-up
            </Button>
          </>
        }
      />

      <NewFollowUpDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaultDate={selectedDate}
        onCreate={createFollowUp}
      />

      {overdueCount > 0 ? <OverdueBanner count={overdueCount} /> : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CalendarCard
          month={calendarMonth}
          onPrev={() => {
            setCalendarMonth(
              (m) => new Date(m.getFullYear(), m.getMonth() - 1, 1),
            );
          }}
          onNext={() => {
            setCalendarMonth(
              (m) => new Date(m.getFullYear(), m.getMonth() + 1, 1),
            );
          }}
          today={now}
          items={calendarItems}
          selectedDate={selectedDate}
          onSelectDate={(d) => {
            setSelectedDate(d);
            // Picking a day in a different month should also pull that
            // month into view — otherwise the highlight would vanish.
            if (
              d.getFullYear() !== calendarMonth.getFullYear() ||
              d.getMonth() !== calendarMonth.getMonth()
            ) {
              setCalendarMonth(new Date(d.getFullYear(), d.getMonth(), 1));
            }
          }}
        />
        <SelectedDayCard
          items={selectedDayItems}
          selectedDate={selectedDate}
          isToday={isSelectedToday}
          isLoading={selectedDayQuery.isLoading}
          onDone={markDone}
          onMissed={markMissed}
          onAdd={() => setCreateOpen(true)}
        />
      </div>

      <UpcomingCard
        items={upcomingTabItems}
        today={now}
        onDone={markDone}
      />

      <AllFollowUpsCard
        items={allItems}
        today={now}
        filter={filter}
        onFilterChange={setFilter}
      />
    </div>
  );
}

// =================================================================
// Overdue banner
// =================================================================

function OverdueBanner({ count }: { count: number }) {
  return (
    <Card className="flex items-center gap-3 border-rose-200 bg-rose-50/60 p-4 dark:border-rose-900/50 dark:bg-rose-950/30">
      <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" aria-hidden />
      <p className="text-sm text-rose-700 dark:text-rose-300">
        <span className="font-semibold">{count} overdue</span>{" "}
        <span className="text-rose-600/80 dark:text-rose-300/80">
          follow-up{count === 1 ? "" : "s"} need your attention
        </span>
      </p>
    </Card>
  );
}

// =================================================================
// Calendar
// =================================================================

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function CalendarCard({
  month,
  onPrev,
  onNext,
  today,
  items,
  selectedDate,
  onSelectDate,
}: {
  month: Date;
  onPrev: () => void;
  onNext: () => void;
  today: Date;
  items: FollowUp[];
  selectedDate: Date;
  onSelectDate: (d: Date) => void;
}) {
  const monthLabel = month.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  const firstWeekday = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  const daysInMonth = new Date(
    month.getFullYear(),
    month.getMonth() + 1,
    0,
  ).getDate();

  // YYYY-M-D → number of pending follow-ups on that day (in this month).
  const counts = useMemo(() => {
    const map = new Map<number, number>();
    for (const f of items) {
      const d = new Date(f.scheduledAt);
      if (
        d.getFullYear() === month.getFullYear() &&
        d.getMonth() === month.getMonth() &&
        f.status === "pending"
      ) {
        map.set(d.getDate(), (map.get(d.getDate()) ?? 0) + 1);
      }
    }
    return map;
  }, [items, month]);

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onPrev}
            aria-label="Previous month"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-500 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900"
          >
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
          </button>
          <span className="text-sm font-semibold">{monthLabel}</span>
          <button
            type="button"
            onClick={onNext}
            aria-label="Next month"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-500 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900"
          >
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-y-2 text-center text-xs">
        {WEEKDAYS.map((d) => (
          <div key={d} className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
            {d}
          </div>
        ))}
        {cells.map((day, i) => {
          if (day === null) {
            return <div key={`pad-${i}`} aria-hidden />;
          }
          const cellDate = new Date(month.getFullYear(), month.getMonth(), day);
          const isToday = isSameDay(cellDate, today);
          const isSelected = isSameDay(cellDate, selectedDate);
          const count = counts.get(day) ?? 0;
          const hasItems = count > 0;
          return (
            <button
              key={day}
              type="button"
              onClick={() => onSelectDate(cellDate)}
              aria-pressed={isSelected}
              className={cn(
                "mx-auto grid h-7 w-7 place-items-center rounded-full text-sm tabular-nums transition-colors",
                // Today stays solid violet. Selected (but-not-today) gets a
                // ring so both highlights can coexist on the same cell.
                isToday
                  ? "bg-violet-500 font-semibold text-white"
                  : hasItems
                    ? "font-medium text-violet-600 hover:bg-violet-50 dark:text-violet-400 dark:hover:bg-violet-950/40"
                    : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900",
                isSelected && !isToday &&
                  "ring-2 ring-violet-500 ring-offset-1 ring-offset-white dark:ring-offset-zinc-950",
              )}
              aria-label={
                hasItems
                  ? `${cellDate.toDateString()}, ${count} follow-up${count === 1 ? "" : "s"}`
                  : cellDate.toDateString()
              }
            >
              {day}
            </button>
          );
        })}
      </div>
    </Card>
  );
}

// =================================================================
// Selected-day card
// =================================================================

function SelectedDayCard({
  items,
  selectedDate,
  isToday,
  isLoading,
  onDone,
  onMissed,
  onAdd,
}: {
  items: FollowUp[];
  selectedDate: Date;
  isToday: boolean;
  isLoading: boolean;
  onDone: (id: string) => void;
  onMissed: (id: string) => void;
  onAdd: () => void;
}) {
  const title = isToday
    ? "Today"
    : selectedDate.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
  const emptyMsg = isToday
    ? "Nothing scheduled for today."
    : `Nothing scheduled for ${selectedDate.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
      })}.`;

  return (
    <Card className="overflow-hidden p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400">
            <CalendarIcon className="h-4 w-4" aria-hidden />
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold">{title}</span>
            <span className="text-xs text-zinc-500">
              {items.length} follow-up{items.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          Add
        </button>
      </div>

      <div className="mt-4 space-y-3">
        {isLoading && items.length === 0 ? (
          <div className="py-8 text-center text-sm text-zinc-500">Loading…</div>
        ) : items.length === 0 ? (
          <div className="py-8 text-center text-sm text-zinc-500">
            {emptyMsg}
          </div>
        ) : (
          items.map((f) => (
            <TodayRow
              key={f.id}
              item={f}
              onDone={() => onDone(f.id)}
              onMissed={() => onMissed(f.id)}
            />
          ))
        )}
      </div>
    </Card>
  );
}

function TodayRow({
  item,
  onDone,
  onMissed,
}: {
  item: FollowUp;
  onDone: () => void;
  onMissed: () => void;
}) {
  const meta = TYPE_META[item.type];
  const Icon = meta.icon;
  const time = formatTime(item.scheduledAt);
  return (
    <div className="flex items-start gap-3">
      <span
        aria-hidden
        className={cn("mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-md", meta.tileClass)}
      >
        <Icon className={cn("h-4 w-4", meta.iconClass)} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-semibold">{item.title}</span>
          <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium", STATUS_META[item.status].badgeClass)}>
            {STATUS_META[item.status].label}
          </span>
        </div>
        <div className="text-xs text-zinc-500">
          {time} · {item.location}
        </div>
        {item.note ? (
          <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">{item.note}</p>
        ) : null}
      </div>
      {item.status === "pending" ? (
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onDone}
            aria-label={`Mark "${item.title}" done`}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 bg-white text-emerald-600 transition-colors hover:border-emerald-200 hover:bg-emerald-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-emerald-400 dark:hover:border-emerald-900/40 dark:hover:bg-emerald-950/40"
          >
            <Check className="h-3.5 w-3.5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={onMissed}
            aria-label={`Mark "${item.title}" missed`}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-500 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-rose-900/40 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      ) : null}
    </div>
  );
}

// =================================================================
// Upcoming next 7 days
// =================================================================

function UpcomingCard({
  items,
  today,
  onDone,
}: {
  items: FollowUp[];
  today: Date;
  onDone: (id: string) => void;
}) {
  const pendingCount = items.filter((i) => i.status === "pending").length;
  return (
    <Card className="overflow-hidden p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400">
            <Clock className="h-4 w-4" aria-hidden />
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold">Upcoming</span>
            <span className="text-xs text-zinc-500">Next 7 days</span>
          </div>
        </div>
        <span className="text-xs text-zinc-500">{pendingCount} pending</span>
      </div>

      <div className="mt-4 divide-y divide-zinc-100 dark:divide-zinc-800">
        {items.length === 0 ? (
          <div className="py-8 text-center text-sm text-zinc-500">
            No follow-ups in the next 7 days.
          </div>
        ) : (
          items.map((f) => (
            <UpcomingRow
              key={f.id}
              item={f}
              today={today}
              onDone={() => onDone(f.id)}
            />
          ))
        )}
      </div>
    </Card>
  );
}

function UpcomingRow({
  item,
  today,
  onDone,
}: {
  item: FollowUp;
  today: Date;
  onDone: () => void;
}) {
  const meta = TYPE_META[item.type];
  const Icon = meta.icon;
  return (
    <div className="flex items-center gap-3 py-3">
      <span
        aria-hidden
        className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-md", meta.tileClass)}
      >
        <Icon className={cn("h-4 w-4", meta.iconClass)} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">{item.title}</div>
        <div className="truncate text-xs text-zinc-500">{item.location}</div>
      </div>
      <div className="hidden text-right text-xs sm:block">
        <div className="font-medium text-zinc-700 dark:text-zinc-300">
          {formatRelativeDate(item.scheduledAt, today)}
        </div>
        <div className="text-zinc-500">{formatTime(item.scheduledAt)}</div>
      </div>
      {item.status === "pending" ? (
        <button
          type="button"
          onClick={onDone}
          aria-label={`Mark "${item.title}" done`}
          className="ml-2 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-white text-emerald-600 transition-colors hover:border-emerald-200 hover:bg-emerald-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-emerald-400 dark:hover:border-emerald-900/40 dark:hover:bg-emerald-950/40"
        >
          <Check className="h-3.5 w-3.5" aria-hidden />
        </button>
      ) : (
        <span
          className={cn(
            "ml-2 inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
            STATUS_META[item.status].badgeClass,
          )}
        >
          {STATUS_META[item.status].label}
        </span>
      )}
    </div>
  );
}

// =================================================================
// All follow-ups table
// =================================================================

const FILTER_TABS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "done", label: "Done" },
  { id: "missed", label: "Missed" },
];

function AllFollowUpsCard({
  items,
  today,
  filter,
  onFilterChange,
}: {
  items: FollowUp[];
  today: Date;
  filter: Filter;
  onFilterChange: (next: Filter) => void;
}) {
  // Newest-first; preserve the per-day clock order so the table reads
  // chronologically within the same day.
  const filtered = useMemo(() => {
    const list = filter === "all" ? items : items.filter((f) => f.status === filter);
    return list
      .slice()
      .sort(
        (a, b) =>
          new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime(),
      );
  }, [items, filter]);

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 px-4 py-4 dark:border-zinc-800 sm:px-5">
        <h2 className="text-sm font-semibold">All follow-ups</h2>
        <div className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-950">
          {FILTER_TABS.map((t) => {
            const active = t.id === filter;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onFilterChange(t.id)}
                aria-pressed={active}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                  active
                    ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
                    : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50",
                )}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50/40 text-[10px] uppercase tracking-wider text-zinc-500 dark:bg-zinc-900/40">
            <tr className="text-left">
              <th className="px-4 py-2 font-semibold sm:px-5">Follow-up</th>
              <th className="px-4 py-2 font-semibold">Type</th>
              <th className="px-4 py-2 font-semibold">Date</th>
              <th className="px-4 py-2 font-semibold">Time</th>
              <th className="px-4 py-2 font-semibold sm:pr-5">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-sm text-zinc-500">
                  No follow-ups match this filter.
                </td>
              </tr>
            ) : (
              filtered.map((f) => (
                <AllRow key={f.id} item={f} today={today} />
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function AllRow({ item, today }: { item: FollowUp; today: Date }) {
  const meta = TYPE_META[item.type];
  const TypeIcon = meta.icon;
  return (
    <tr className="border-t border-zinc-100 dark:border-zinc-800">
      <td className="px-4 py-3 sm:px-5">
        <div className="text-sm font-semibold">{item.title}</div>
        <div className="text-xs text-zinc-500">{item.location}</div>
      </td>
      <td className="px-4 py-3">
        <span className={cn("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium", meta.tileClass, meta.iconClass)}>
          <TypeIcon className="h-3 w-3" aria-hidden />
          {meta.label}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-zinc-700 dark:text-zinc-300">
        {formatRelativeDate(item.scheduledAt, today)}
      </td>
      <td className="px-4 py-3 text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
        {formatTime(item.scheduledAt)}
      </td>
      <td className="px-4 py-3 sm:pr-5">
        <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium", STATUS_META[item.status].badgeClass)}>
          {STATUS_META[item.status].label}
        </span>
      </td>
    </tr>
  );
}

// =================================================================
// Notifications
// =================================================================

/**
 * Bell + dropdown, wired to the real notifications API.
 *
 * - `useNotificationCount` polls every 60s and on tab focus to drive the badge.
 * - The list endpoint is only hit when the dropdown opens, so the screen
 *   doesn't pay for it on every render.
 * - Clicking an unread row PATCHes it read and decrements the badge optimistically.
 */
function NotificationsPopover() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const countQuery = useNotificationCount();
  const listQuery = useNotifications({ limit: 20 });
  const mutations = useNotificationMutations();

  // Re-fetch the list whenever the dropdown opens so the rep always sees
  // fresh entries — the 60s count poll doesn't refetch the bodies.
  useEffect(() => {
    if (open) void listQuery.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Close on outside-click / Escape. The project doesn't ship the Radix
  // Popover primitive, so this is the minimum to feel native.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const notifications = listQuery.data?.notifications ?? [];
  const unreadCount = countQuery.count;

  const handleRowClick = async (n: ApiNotification) => {
    if (n.is_read) return;
    // Optimistic: update count + cached list so the badge moves now.
    countQuery.setCount(Math.max(0, unreadCount - 1));
    listQuery.setData(
      listQuery.data
        ? {
            ...listQuery.data,
            unread_count: Math.max(0, listQuery.data.unread_count - 1),
            notifications: listQuery.data.notifications.map((x) =>
              x.id === n.id
                ? { ...x, is_read: true, read_at: new Date().toISOString() }
                : x,
            ),
          }
        : null,
    );
    try {
      await mutations.markRead(n.id);
    } catch (err) {
      toast.error("Couldn't mark read", { description: errorMessage(err) });
      void countQuery.refetch();
      void listQuery.refetch();
    }
  };

  const handleMarkAllRead = async () => {
    if (unreadCount === 0) return;
    countQuery.setCount(0);
    listQuery.setData(
      listQuery.data
        ? {
            ...listQuery.data,
            unread_count: 0,
            notifications: listQuery.data.notifications.map((x) => ({
              ...x,
              is_read: true,
              read_at: x.read_at ?? new Date().toISOString(),
            })),
          }
        : null,
    );
    try {
      await mutations.markAllRead();
    } catch (err) {
      toast.error("Couldn't mark all read", {
        description: errorMessage(err),
      });
      void countQuery.refetch();
      void listQuery.refetch();
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`${unreadCount} unread notifications`}
        aria-expanded={open}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900"
      >
        <Bell className="h-4 w-4" aria-hidden />
        {unreadCount > 0 ? (
          <span
            aria-hidden
            className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-violet-500 px-1 text-[10px] font-semibold text-white"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 top-[calc(100%+8px)] z-50 w-[360px] origin-top-right overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl animate-in fade-in-0 zoom-in-95 slide-in-from-top-1 duration-150 dark:border-zinc-800 dark:bg-zinc-950"
        >
          <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
            <h3 className="text-sm font-semibold">Notifications</h3>
            <button
              type="button"
              onClick={handleMarkAllRead}
              disabled={unreadCount === 0}
              className="text-xs font-semibold text-violet-600 transition-colors hover:text-violet-500 disabled:cursor-not-allowed disabled:opacity-50 dark:text-violet-400 dark:hover:text-violet-300"
            >
              Mark all read
            </button>
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            {listQuery.isLoading && !listQuery.data ? (
              <div className="px-4 py-10 text-center text-sm text-zinc-500">
                Loading…
              </div>
            ) : listQuery.error ? (
              <div className="px-4 py-10 text-center text-sm text-rose-500">
                {errorMessage(listQuery.error)}
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-zinc-500">
                You&apos;re all caught up.
              </div>
            ) : (
              notifications.map((n) => {
                const uiType: FollowUpType = n.meta?.follow_up_type
                  ? apiTypeToUi(n.meta.follow_up_type)
                  : "other";
                const meta = TYPE_META[uiType];
                const Icon = meta.icon;
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => void handleRowClick(n)}
                    className={cn(
                      "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors",
                      !n.is_read &&
                        "bg-violet-50/40 hover:bg-violet-50/60 dark:bg-violet-950/20 dark:hover:bg-violet-950/30",
                      n.is_read && "hover:bg-zinc-50 dark:hover:bg-zinc-900/60",
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-md",
                        meta.tileClass,
                      )}
                    >
                      <Icon className={cn("h-4 w-4", meta.iconClass)} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold leading-tight">
                        {n.title}
                      </div>
                      <p className="mt-1 whitespace-pre-line text-xs leading-snug text-zinc-500">
                        {n.body}
                      </p>
                    </div>
                    {!n.is_read ? (
                      <span
                        aria-label="Unread"
                        className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500"
                      />
                    ) : null}
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// =================================================================
// New follow-up dialog
// =================================================================

interface NewFollowUpDraft {
  title: string;
  type: FollowUpType;
  scheduledAt: string;
  description: string;
}

const TYPE_PICKER: FollowUpType[] = ["call", "meeting", "visit", "email", "other"];

function NewFollowUpDialog({
  open,
  onOpenChange,
  defaultDate,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  defaultDate: Date;
  onCreate: (draft: NewFollowUpDraft) => void;
}) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<FollowUpType>("call");
  const [date, setDate] = useState(() => toYmd(defaultDate));
  const [time, setTime] = useState("10:00");
  const [description, setDescription] = useState("");

  // Re-seed the form whenever the dialog reopens — keeps a stale draft from
  // appearing the second time the rep clicks "New follow-up".
  useEffect(() => {
    if (!open) return;
    setTitle("");
    setType("call");
    setDate(toYmd(defaultDate));
    setTime("10:00");
    setDescription("");
  }, [open, defaultDate]);

  const canSubmit = title.trim().length > 0 && date && time;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    onCreate({
      title: title.trim(),
      type,
      scheduledAt: `${date}T${time}:00`,
      description: description.trim(),
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="border-b border-zinc-100 px-6 py-4 dark:border-zinc-800">
            <DialogTitle>New follow-up</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 px-6 py-5">
            <div className="space-y-1.5">
              <Label
                htmlFor="fu-title"
                className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500"
              >
                Title <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="fu-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Call Dr. Sharma"
                autoFocus
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                Type <span className="text-rose-500">*</span>
              </Label>
              <div className="grid grid-cols-5 gap-2">
                {TYPE_PICKER.map((t) => {
                  const meta = TYPE_META[t];
                  const Icon = meta.icon;
                  const active = type === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setType(t)}
                      aria-pressed={active}
                      className={cn(
                        "flex flex-col items-center justify-center gap-1 rounded-lg border px-2 py-3 text-xs font-medium transition-colors",
                        active
                          ? "border-violet-500 bg-violet-50 text-violet-700 ring-1 ring-violet-500/40 dark:border-violet-400 dark:bg-violet-950/40 dark:text-violet-300"
                          : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900",
                      )}
                    >
                      <Icon className="h-4 w-4" aria-hidden />
                      {meta.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label
                  htmlFor="fu-date"
                  className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500"
                >
                  Date <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="fu-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label
                  htmlFor="fu-time"
                  className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500"
                >
                  Time <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="fu-time"
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="fu-desc"
                className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500"
              >
                Description
              </Label>
              <Textarea
                id="fu-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional notes..."
                rows={3}
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-zinc-100 px-6 py-4 dark:border-zinc-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!canSubmit}
              className="bg-violet-600 hover:bg-violet-500"
            >
              Create
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

