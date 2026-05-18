"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

// =================================================================
// Types — mirror the API shape we'll ask the backend for.
// =================================================================

type FollowUpType = "call" | "meeting" | "visit" | "email" | "other";
type FollowUpStatus = "pending" | "done" | "missed";
type Filter = "all" | "pending" | "done" | "missed";

interface FollowUp {
  id: string;
  type: FollowUpType;
  title: string;
  /** Hospital / clinic / contact location, shown as the secondary line. */
  location: string;
  /** Optional short note shown in the Today section. */
  note?: string;
  /** ISO-8601 scheduled timestamp. */
  scheduledAt: string;
  status: FollowUpStatus;
}

// =================================================================
// Placeholder data — replace with `useFollowUps()` once the backend
// endpoint lands. See FOLLOW_UPS_API.md for the spec.
// =================================================================

/**
 * Today is 2026-05-18 (Monday). These mock entries are arranged around
 * that anchor so the calendar, "Today", "Upcoming next 7 days", and the
 * overdue banner all light up meaningfully.
 */
const MOCK_FOLLOW_UPS: FollowUp[] = [
  // Overdue (pending + past) → drives the red banner
  { id: "fu-101", type: "call",    title: "Call Dr. Mehta",          location: "Apollo Clinic",     scheduledAt: "2026-05-14T10:00:00", status: "pending" },
  { id: "fu-102", type: "email",   title: "Send quote to Manipal",   location: "Manipal Hospital",  scheduledAt: "2026-05-15T15:00:00", status: "pending" },

  // Today (2026-05-18)
  { id: "fu-001", type: "call",    title: "Call Dr. Sharma",         location: "Apollo Clinic",     note: "Follow up on lab equipment quote", scheduledAt: "2026-05-18T09:00:00", status: "pending" },
  { id: "fu-002", type: "meeting", title: "Meeting with Fortis team", location: "Fortis Hospital",  note: "Discuss renewal and new branch setup", scheduledAt: "2026-05-18T14:00:00", status: "pending" },

  // Upcoming next 7 days
  { id: "fu-003", type: "visit",   title: "Visit Max Healthcare",     location: "Max Healthcare",    scheduledAt: "2026-05-19T10:30:00", status: "pending" },
  { id: "fu-004", type: "email",   title: "Email proposal to Medanta", location: "Medanta",          scheduledAt: "2026-05-19T16:00:00", status: "pending" },
  { id: "fu-005", type: "call",    title: "Call Dr. Patel",           location: "City Hospital",     scheduledAt: "2026-05-20T11:00:00", status: "pending" },
  { id: "fu-006", type: "meeting", title: "Meeting with procurement", location: "AIIMS",             scheduledAt: "2026-05-21T09:30:00", status: "pending" },
  { id: "fu-007", type: "call",    title: "Follow up with Dr. Gupta", location: "Narayana Health",   scheduledAt: "2026-05-22T15:00:00", status: "pending" },
  { id: "fu-008", type: "email",   title: "Email contract to Yashoda", location: "Yashoda Hospital", scheduledAt: "2026-05-24T10:00:00", status: "pending" },

  // Past completed (history, drives the "Done" filter)
  { id: "fu-201", type: "call",    title: "Call Dr. Reddy",           location: "KIMS",              scheduledAt: "2026-05-12T11:00:00", status: "done" },
  { id: "fu-202", type: "meeting", title: "Meeting with billing",     location: "Apollo Clinic",     scheduledAt: "2026-05-10T15:30:00", status: "done" },

  // Past missed (drives the "Missed" filter)
  { id: "fu-301", type: "visit",   title: "Visit Care Hospitals",     location: "Care Hospitals",    scheduledAt: "2026-05-09T12:00:00", status: "missed" },
];

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

// =================================================================
// Screen
// =================================================================

export function FollowUpsScreen() {
  const auth = useAuth();

  // Fixing "now" once per render keeps every derived list (today / upcoming
  // / overdue / calendar) referring to the same instant — otherwise an
  // entry could appear in two buckets on a millisecond boundary.
  const now = useMemo(() => new Date(), []);

  const [calendarMonth, setCalendarMonth] = useState(
    () => new Date(now.getFullYear(), now.getMonth(), 1),
  );
  const [filter, setFilter] = useState<Filter>("all");
  const [items, setItems] = useState<FollowUp[]>(MOCK_FOLLOW_UPS);
  const [createOpen, setCreateOpen] = useState(false);
  // Notification IDs the rep has acknowledged. Initialized with the last
  // entry so the bell badge reads "3 unread" out of 4 like the design.
  const [readNotifIds, setReadNotifIds] = useState<Set<string>>(
    () => new Set(["fu-003"]),
  );

  const buckets = useMemo(() => bucketize(items, now), [items, now]);

  const notifications = useMemo(
    () => buildNotifications(items, now, readNotifIds),
    [items, now, readNotifIds],
  );
  const unreadCount = notifications.filter((n) => !n.read).length;

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

  // Optimistic-only handlers; the API mutations will replace them once
  // the backend lands. Each one is keyed off the follow-up id so the
  // backend can wire them straight to a status-update endpoint.
  const markDone = (id: string) =>
    setItems((arr) => arr.map((f) => (f.id === id ? { ...f, status: "done" } : f)));
  const markMissed = (id: string) =>
    setItems((arr) => arr.map((f) => (f.id === id ? { ...f, status: "missed" } : f)));

  const createFollowUp = (draft: NewFollowUpDraft) => {
    setItems((arr) => [
      ...arr,
      {
        id: `fu-${Date.now()}`,
        type: draft.type,
        title: draft.title,
        location: draft.description || "—",
        note: draft.description || undefined,
        scheduledAt: draft.scheduledAt,
        status: "pending",
      },
    ]);
  };

  const markAllNotificationsRead = () =>
    setReadNotifIds(new Set(notifications.map((n) => n.id.replace("notif-", ""))));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Follow-ups"
        description="Schedule and track your calls, meetings, and visits."
        actions={
          <>
            <NotificationsPopover
              notifications={notifications}
              unreadCount={unreadCount}
              onMarkAllRead={markAllNotificationsRead}
            />
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
        defaultDate={now}
        onCreate={createFollowUp}
      />

      {buckets.overdue.length > 0 ? (
        <OverdueBanner count={buckets.overdue.length} />
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CalendarCard
          month={calendarMonth}
          onPrev={() =>
            setCalendarMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))
          }
          onNext={() =>
            setCalendarMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))
          }
          today={now}
          items={items}
        />
        <TodayCard
          items={buckets.today}
          onDone={markDone}
          onMissed={markMissed}
          onAdd={() => setCreateOpen(true)}
        />
      </div>

      <UpcomingCard
        items={buckets.upcoming}
        today={now}
        onDone={markDone}
      />

      <AllFollowUpsCard
        items={items}
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
}: {
  month: Date;
  onPrev: () => void;
  onNext: () => void;
  today: Date;
  items: FollowUp[];
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
          const count = counts.get(day) ?? 0;
          const hasItems = count > 0;
          return (
            <button
              key={day}
              type="button"
              className={cn(
                "mx-auto grid h-7 w-7 place-items-center rounded-full text-sm tabular-nums transition-colors",
                isToday
                  ? "bg-violet-500 font-semibold text-white"
                  : hasItems
                    ? "font-medium text-violet-600 hover:bg-violet-50 dark:text-violet-400 dark:hover:bg-violet-950/40"
                    : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900",
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
// Today
// =================================================================

function TodayCard({
  items,
  onDone,
  onMissed,
  onAdd,
}: {
  items: FollowUp[];
  onDone: (id: string) => void;
  onMissed: (id: string) => void;
  onAdd: () => void;
}) {
  return (
    <Card className="overflow-hidden p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400">
            <CalendarIcon className="h-4 w-4" aria-hidden />
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold">Today</span>
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
        {items.length === 0 ? (
          <div className="py-8 text-center text-sm text-zinc-500">
            Nothing scheduled for today.
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

interface Notification {
  /** "notif-<followUpId>" so we can map back to the source follow-up. */
  id: string;
  type: FollowUpType;
  title: string;
  body: string;
  read: boolean;
}

/**
 * Derive notifications from the follow-up list. Surfaces:
 *   - Pending follow-ups happening within the next few hours today
 *   - Pending follow-ups for tomorrow
 *   - Pending follow-ups that slipped past their scheduled time yesterday
 *     (rendered as "Missed:" — turns into an actual `missed` status only
 *     when the rep acts on it, so we still drive this off `pending` items)
 */
function buildNotifications(
  items: FollowUp[],
  now: Date,
  readIds: Set<string>,
): Notification[] {
  const notifs: Notification[] = [];
  for (const f of items) {
    if (f.status !== "pending") continue;
    const when = new Date(f.scheduledAt);
    const dayDiff = diffInDays(now, when);
    const typeLabel = TYPE_META[f.type].label.toLowerCase();
    const dateStr = when.toLocaleDateString("en-GB"); // DD/MM/YYYY
    const timeStr = formatTime(f.scheduledAt);

    if (dayDiff === 0 && when.getTime() > now.getTime()) {
      const hours = Math.max(1, Math.round((when.getTime() - now.getTime()) / 3_600_000));
      notifs.push({
        id: `notif-${f.id}`,
        type: f.type,
        title: `Reminder: ${f.title}`,
        body: `You have a ${typeLabel} follow-up scheduled in ${hours} hour${hours === 1 ? "" : "s"}\n(${dateStr}, ${timeStr})`,
        read: readIds.has(f.id),
      });
    } else if (dayDiff === 1) {
      notifs.push({
        id: `notif-${f.id}`,
        type: f.type,
        title: `Reminder: ${f.title}`,
        body: `You have a ${typeLabel} scheduled tomorrow at ${timeStr}`,
        read: readIds.has(f.id),
      });
    } else if (dayDiff === -1) {
      notifs.push({
        id: `notif-${f.id}`,
        type: f.type,
        title: `Missed: ${f.title}`,
        body: `You missed a scheduled ${typeLabel} yesterday`,
        read: readIds.has(f.id),
      });
    }
  }
  // Unread first, then by recency of the source follow-up (most-imminent first).
  return notifs.sort((a, b) => {
    if (a.read !== b.read) return a.read ? 1 : -1;
    return 0;
  });
}

function NotificationsPopover({
  notifications,
  unreadCount,
  onMarkAllRead,
}: {
  notifications: Notification[];
  unreadCount: number;
  onMarkAllRead: () => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside-click / Escape. Radix would handle this for us via the
  // Popover primitive, but the project doesn't currently install it — this
  // is the minimum needed to feel native.
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
            {unreadCount}
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
              onClick={onMarkAllRead}
              disabled={unreadCount === 0}
              className="text-xs font-semibold text-violet-600 transition-colors hover:text-violet-500 disabled:cursor-not-allowed disabled:opacity-50 dark:text-violet-400 dark:hover:text-violet-300"
            >
              Mark all read
            </button>
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-zinc-500">
                You're all caught up.
              </div>
            ) : (
              notifications.map((n) => {
                const meta = TYPE_META[n.type];
                const Icon = meta.icon;
                return (
                  <div
                    key={n.id}
                    className={cn(
                      "flex items-start gap-3 px-4 py-3 transition-colors",
                      !n.read &&
                        "bg-violet-50/40 hover:bg-violet-50/60 dark:bg-violet-950/20 dark:hover:bg-violet-950/30",
                      n.read && "hover:bg-zinc-50 dark:hover:bg-zinc-900/60",
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
                    {!n.read ? (
                      <span
                        aria-label="Unread"
                        className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500"
                      />
                    ) : null}
                  </div>
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

function toDateInputValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

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
  const [date, setDate] = useState(() => toDateInputValue(defaultDate));
  const [time, setTime] = useState("10:00");
  const [description, setDescription] = useState("");

  // Re-seed the form whenever the dialog reopens — keeps a stale draft from
  // appearing the second time the rep clicks "New follow-up".
  useEffect(() => {
    if (!open) return;
    setTitle("");
    setType("call");
    setDate(toDateInputValue(defaultDate));
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

// =================================================================
// Bucketing
// =================================================================

function bucketize(items: FollowUp[], now: Date) {
  const today: FollowUp[] = [];
  const upcoming: FollowUp[] = [];
  const overdue: FollowUp[] = [];

  for (const f of items) {
    const when = new Date(f.scheduledAt);
    const dayDiff = diffInDays(now, when);
    if (f.status === "pending" && when.getTime() < now.getTime() && dayDiff < 0) {
      overdue.push(f);
      continue;
    }
    if (isSameDay(when, now)) {
      today.push(f);
      continue;
    }
    if (dayDiff > 0 && dayDiff <= 7) {
      upcoming.push(f);
    }
  }

  // Stable per-bucket ordering: chronological for the forward-looking ones,
  // oldest-overdue-first for the banner-driving list so the most-stale item
  // is what the rep sees first if we ever surface them inline.
  today.sort((a, b) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt));
  upcoming.sort((a, b) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt));
  overdue.sort((a, b) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt));

  return { today, upcoming, overdue };
}
