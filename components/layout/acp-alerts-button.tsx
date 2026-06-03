"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock,
  MessageSquare,
  Target,
  Trophy,
  X,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/lib/auth";
import { isSalesMember } from "@/lib/access";
import { ApiError } from "@/lib/api/client";
import { errorMessage } from "@/lib/hooks/use-async";
import {
  useMyAcpDailyLogs,
  useMyAcpMessages,
} from "@/lib/hooks/use-accelerator";
import {
  useNotificationCount,
  useNotificationMutations,
  useNotifications,
} from "@/lib/hooks/use-notifications";
import type { ApiNotification } from "@/lib/api/sales-notifications";
import type { AcpMessage } from "@/lib/api/sales-accelerator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  generateRepSelfAlerts,
  type AcpRepAlert,
  type AcpRepAlertCategory,
} from "@/lib/acp/alerts";

/**
 * Header alert bell for Accelerator reps.
 *
 * Mirrors {@link PitchUploadButton} / {@link MessagesButton}: only sales
 * `member` accounts mount it, and enrollment is confirmed via the proven
 * `GET /acp/me/messages` signal (a 404 = "not an Accelerator member" hides the
 * bell). Alerts are computed on the fly from the rep's own daily logs and coach
 * inbox by {@link generateRepSelfAlerts} — there's no stored-alert endpoint.
 */
export function AcpAlertsButton() {
  const auth = useAuth();
  // Gate before mounting the data hooks so non-rep users never fetch.
  if (!isSalesMember(auth) || !auth.user) return null;
  return <AcpAlertsGate userId={auth.user.id} />;
}

/**
 * Lightweight enrollment probe. Only the `/acp/me/messages` signal runs for
 * non-enrolled members; the heavier daily-logs + notification polling lives in
 * {@link RepAlerts}, which mounts only once enrollment is confirmed — so a
 * member who isn't an Accelerator rep never pays for it (and their standalone
 * notification bell stays the single bell). Polls + refetches on focus so the
 * bell self-heals the moment the rep is enrolled and tracks new coach messages.
 */
function AcpAlertsGate({ userId }: { userId: string }) {
  const enrollment = useMyAcpMessages();
  const { refetch: refetchMsgs } = enrollment;
  const notAcpMember =
    enrollment.error instanceof ApiError &&
    (enrollment.error.status === 404 ||
      enrollment.error.status === 401 ||
      enrollment.error.status === 403);

  useEffect(() => {
    const onFocus = () => void refetchMsgs();
    window.addEventListener("focus", onFocus);
    const id = notAcpMember
      ? null
      : window.setInterval(() => void refetchMsgs(), 60_000);
    return () => {
      if (id !== null) window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [refetchMsgs, notAcpMember]);

  // Render nothing until a successful response confirms enrollment (`data` is
  // then an array, even if empty); 404/401/403 keeps `data` null → hidden.
  if (notAcpMember || !Array.isArray(enrollment.data)) return null;
  return (
    <RepAlerts
      userId={userId}
      messages={enrollment.data}
      refetchMsgs={refetchMsgs}
    />
  );
}

const SEEN_PREFIX = "nyra:acp-alerts-seen:";

function readSeen(userId: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(SEEN_PREFIX + userId);
  } catch {
    return null;
  }
}

function writeSeen(userId: string, iso: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SEEN_PREFIX + userId, iso);
  } catch {
    // localStorage may be blocked — non-fatal, the badge just won't persist.
  }
}

function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

type Filter = "all" | AcpRepAlertCategory;

const CATEGORY_META: Record<
  AcpRepAlertCategory,
  { label: string; tab: string }
> = {
  daily_task: { label: "Action needed", tab: "Action" },
  target: { label: "Targets", tab: "Targets" },
  feedback: { label: "Feedback", tab: "Feedback" },
};

function severityVisual(severity: AcpRepAlert["severity"]): {
  Icon: LucideIcon;
  iconClass: string;
  tileClass: string;
} {
  switch (severity) {
    case "action":
      return {
        Icon: AlertCircle,
        iconClass: "text-rose-500",
        tileClass: "bg-rose-50 dark:bg-rose-950/30",
      };
    case "warning":
      return {
        Icon: AlertTriangle,
        iconClass: "text-amber-500",
        tileClass: "bg-amber-50 dark:bg-amber-950/30",
      };
    case "milestone":
      return {
        Icon: Trophy,
        iconClass: "text-emerald-500",
        tileClass: "bg-emerald-50 dark:bg-emerald-950/30",
      };
    case "feedback":
    default:
      return {
        Icon: MessageSquare,
        iconClass: "text-violet-500",
        tileClass: "bg-violet-50 dark:bg-violet-950/30",
      };
  }
}

const CATEGORY_ICON: Record<AcpRepAlertCategory, LucideIcon> = {
  daily_task: AlertCircle,
  target: Target,
  feedback: MessageSquare,
};

/** Icon + tile colour for a general (non-ACP) notification, keyed off type. */
function notifVisual(type: string): {
  Icon: LucideIcon;
  iconClass: string;
  tileClass: string;
} {
  const t = type.toUpperCase();
  if (t.includes("MESSAGE")) {
    return {
      Icon: MessageSquare,
      iconClass: "text-violet-500",
      tileClass: "bg-violet-50 dark:bg-violet-950/30",
    };
  }
  if (t.includes("FOLLOW_UP") || t.includes("REMINDER")) {
    return {
      Icon: Clock,
      iconClass: "text-amber-500",
      tileClass: "bg-amber-50 dark:bg-amber-950/30",
    };
  }
  return {
    Icon: Bell,
    iconClass: "text-zinc-500 dark:text-zinc-300",
    tileClass: "bg-zinc-100 dark:bg-zinc-800/60",
  };
}

function RepAlerts({
  userId,
  messages,
  refetchMsgs,
}: {
  userId: string;
  /** The rep's coach inbox (proven enrolled) from the gate above. */
  messages: AcpMessage[];
  refetchMsgs: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [seenAt, setSeenAt] = useState<string | null>(() => readSeen(userId));

  const logsQuery = useMyAcpDailyLogs();
  const { refetch: refetchLogs } = logsQuery;

  // The (rare) general sales-notification feed, folded into this bell so reps
  // see a single bell instead of two. Admins/non-enrolled members still get
  // the standalone bell (see {@link NotificationsButton}). Mounted here — i.e.
  // only for confirmed reps — so non-members don't double-poll notifications.
  const notifList = useNotifications({ limit: 20 });
  const notifCount = useNotificationCount();
  const notifMutations = useNotificationMutations();
  const notifications = useMemo(
    () => notifList.data?.notifications ?? [],
    [notifList.data],
  );
  const unreadNotif = notifCount.count;
  // Latest unread-notification count for the open-handler, kept in a ref so the
  // effect doesn't re-run on every 60s count poll.
  const unreadNotifRef = useRef(unreadNotif);
  unreadNotifRef.current = unreadNotif;

  // Keep the daily logs fresh without a reload (the gate polls messages; the
  // notification hooks poll themselves). 60s interval + refetch on tab focus.
  useEffect(() => {
    const onFocus = () => void refetchLogs();
    window.addEventListener("focus", onFocus);
    const id = window.setInterval(() => void refetchLogs(), 60_000);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [refetchLogs]);

  const logs = useMemo(() => logsQuery.data ?? [], [logsQuery.data]);

  const unreadCount = useMemo(() => {
    if (!seenAt) return messages.length;
    const seen = new Date(seenAt).getTime();
    return messages.filter((m) => new Date(m.created_at).getTime() > seen)
      .length;
  }, [messages, seenAt]);

  const alerts = useMemo(
    () =>
      generateRepSelfAlerts({
        logs,
        unreadMessageCount: unreadCount,
        latestMessage: messages[0] ?? null,
      }),
    [logs, unreadCount, messages],
  );

  // Action / warning alerts the rep should act on (red / amber). Milestones and
  // standing feedback never light the bell.
  const actionableAlertCount = useMemo(
    () =>
      alerts.filter((a) => a.severity === "action" || a.severity === "warning")
        .length,
    [alerts],
  );

  // The badge is a "something new since you last looked" signal. Opening the
  // bell stamps `seenAt`, which:
  //   - clears the coach-message portion immediately (messages newer than
  //     `seenAt` are what `unreadCount` counts), and
  //   - suppresses the standing action/warning alerts for the rest of *today*
  //     (they re-surface tomorrow so daily tasks aren't forgotten forever).
  // New coach messages and general notifications still raise it right away, so
  // an opened-then-closed bell reliably tells the rep when something new lands.
  const seenToday =
    seenAt != null && isSameLocalDay(new Date(seenAt), new Date());
  const badgeCount =
    (seenToday ? 0 : actionableAlertCount) + unreadCount + unreadNotif;

  // Optimistic mark-read / delete for the folded-in notifications, mirroring
  // the standalone bell so the count moves immediately.
  const handleNotifClick = async (n: ApiNotification) => {
    if (n.is_read) return;
    notifCount.setCount(Math.max(0, notifCount.count - 1));
    notifList.setData(
      notifList.data
        ? {
            ...notifList.data,
            unread_count: Math.max(0, notifList.data.unread_count - 1),
            notifications: notifList.data.notifications.map((x) =>
              x.id === n.id
                ? { ...x, is_read: true, read_at: new Date().toISOString() }
                : x,
            ),
          }
        : null,
    );
    try {
      await notifMutations.markRead(n.id);
    } catch (err) {
      toast.error("Couldn't mark read", { description: errorMessage(err) });
      void notifCount.refetch();
      void notifList.refetch();
    }
  };

  const handleNotifDelete = async (
    e: React.MouseEvent<HTMLButtonElement>,
    n: ApiNotification,
  ) => {
    e.stopPropagation();
    const prev = notifList.data;
    const wasUnread = !n.is_read;
    notifList.setData(
      prev
        ? {
            ...prev,
            total: Math.max(0, prev.total - 1),
            unread_count: Math.max(0, prev.unread_count - (wasUnread ? 1 : 0)),
            notifications: prev.notifications.filter((x) => x.id !== n.id),
          }
        : null,
    );
    if (wasUnread) notifCount.setCount(Math.max(0, notifCount.count - 1));
    try {
      await notifMutations.remove(n.id);
    } catch (err) {
      toast.error("Couldn't delete notification", {
        description: errorMessage(err),
      });
      void notifCount.refetch();
      void notifList.refetch();
    }
  };

  const counts = useMemo(() => {
    const c: Record<AcpRepAlertCategory, number> = {
      daily_task: 0,
      target: 0,
      feedback: 0,
    };
    for (const a of alerts) c[a.category] += 1;
    return c;
  }, [alerts]);

  const visible = useMemo(
    () => (filter === "all" ? alerts : alerts.filter((a) => a.category === filter)),
    [alerts, filter],
  );

  // Notifications live under the default "All" view, as their own section
  // below any Accelerator alerts.
  const showNotifSection = filter === "all" && notifications.length > 0;
  const nothingToShow = visible.length === 0 && !showNotifSection;
  const totalItems = alerts.length + notifications.length;

  // Opening the panel acknowledges everything currently in it so the badge
  // clears: it stamps `seenAt` (messages + standing alerts) and marks the
  // folded-in general notifications read on the server (so the count poll keeps
  // the badge at 0 until a genuinely new one arrives). Also refetches so the
  // rep always sees the freshest state.
  const { refetch: refetchNotif } = notifList;
  const { setCount: setNotifCount, refetch: refetchNotifCount } = notifCount;
  const { markAllRead: markAllNotifRead } = notifMutations;
  useEffect(() => {
    if (!open) return;
    void refetchMsgs();
    void refetchLogs();
    const iso = new Date().toISOString();
    setSeenAt(iso);
    writeSeen(userId, iso);
    // Acknowledge unread general notifications on open. Guarded so an empty
    // inbox doesn't POST on every open; reverts to the server truth on failure.
    if (unreadNotifRef.current > 0) {
      setNotifCount(0);
      void markAllNotifRead()
        .then(() => void refetchNotif())
        .catch(() => {
          void refetchNotifCount();
          void refetchNotif();
        });
    } else {
      void refetchNotif();
    }
  }, [
    open,
    refetchMsgs,
    refetchLogs,
    refetchNotif,
    refetchNotifCount,
    setNotifCount,
    markAllNotifRead,
    userId,
  ]);

  const filters: { key: Filter; label: string; count: number }[] = [
    { key: "all", label: "All", count: alerts.length },
    { key: "daily_task", label: CATEGORY_META.daily_task.tab, count: counts.daily_task },
    { key: "target", label: CATEGORY_META.target.tab, count: counts.target },
    { key: "feedback", label: CATEGORY_META.feedback.tab, count: counts.feedback },
  ];

  // Red only while unacknowledged action alerts are actually counted; once
  // seen today the badge (driven by new messages/notifications) goes amber.
  const hasAction = !seenToday && alerts.some((a) => a.severity === "action");

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`${badgeCount} alert${badgeCount === 1 ? "" : "s"}`}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-50"
      >
        <Bell className="h-4 w-4" aria-hidden />
        {badgeCount > 0 ? (
          <span
            aria-hidden
            className={cn(
              "absolute right-0.5 top-0.5 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[10px] font-semibold text-white",
              hasAction ? "bg-rose-500" : "bg-amber-500",
            )}
          >
            {badgeCount > 99 ? "99+" : badgeCount}
          </span>
        ) : null}
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 p-0 sm:w-[420px] sm:max-w-none"
        >
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-violet-500" aria-hidden />
              My alerts
            </SheetTitle>
            <p className="text-sm text-zinc-500">
              {totalItems === 0
                ? "You're all caught up."
                : `${totalItems} item${totalItems === 1 ? "" : "s"}`}
            </p>
          </SheetHeader>

          {/* Filter tabs */}
          <div className="flex flex-wrap items-center gap-2 border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
            {filters.map((f) => {
              const active = filter === f.key;
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFilter(f.key)}
                  aria-pressed={active}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors",
                    active
                      ? "border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-300"
                      : "border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800/60",
                  )}
                >
                  {f.label}
                  <span
                    className={cn(
                      "rounded px-1 tabular-nums",
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

          {nothingToShow ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-500" aria-hidden />
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
                All caught up!
              </p>
              <p className="text-sm text-zinc-500">
                {alerts.length === 0 && notifications.length === 0
                  ? "Nothing needs your attention right now."
                  : "No alerts in this category."}
              </p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              {visible.length > 0 ? (
                <div className="space-y-2 p-4">
                  {visible.map((a) => {
                    const { Icon, iconClass, tileClass } = severityVisual(
                      a.severity,
                    );
                    const CategoryIcon = CATEGORY_ICON[a.category];
                    return (
                      <div
                        key={a.id}
                        className="flex items-start gap-3 rounded-lg border border-zinc-100 px-3 py-2.5 dark:border-zinc-800"
                      >
                        <span
                          aria-hidden
                          className={cn(
                            "mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-md",
                            tileClass,
                          )}
                        >
                          <Icon className={cn("h-4 w-4", iconClass)} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold leading-snug">
                            {a.message}
                          </div>
                          {a.detail ? (
                            <p className="mt-0.5 text-xs leading-snug text-zinc-500">
                              {a.detail}
                            </p>
                          ) : null}
                          <div className="mt-1 flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-zinc-400">
                            <CategoryIcon className="h-3 w-3" aria-hidden />
                            {CATEGORY_META[a.category].label}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}

              {/* General notifications — folded in here (rare), shown in the
                  default "All" view below any Accelerator alerts. */}
              {showNotifSection ? (
                <div
                  className={cn(
                    visible.length > 0 &&
                      "border-t border-zinc-100 dark:border-zinc-800",
                  )}
                >
                  <div className="px-4 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                    Notifications
                  </div>
                  <div className="pb-2">
                    {notifications.map((n) => {
                      const v = notifVisual(n.type);
                      const NotifIcon = v.Icon;
                      return (
                        <div
                          key={n.id}
                          className={cn(
                            "group relative flex items-start gap-3 px-4 py-2.5 transition-colors",
                            !n.is_read
                              ? "bg-violet-50/40 hover:bg-violet-50/60 dark:bg-violet-950/20 dark:hover:bg-violet-950/30"
                              : "hover:bg-zinc-50 dark:hover:bg-zinc-900/60",
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => void handleNotifClick(n)}
                            aria-label={
                              n.is_read ? n.title : `Mark "${n.title}" read`
                            }
                            className="absolute inset-0 z-0"
                          />
                          <span
                            aria-hidden
                            className={cn(
                              "relative z-10 mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-md",
                              v.tileClass,
                            )}
                          >
                            <NotifIcon className={cn("h-4 w-4", v.iconClass)} />
                          </span>
                          <div className="relative z-10 min-w-0 flex-1">
                            <div className="text-sm font-semibold leading-tight">
                              {n.title}
                            </div>
                            <p className="mt-0.5 whitespace-pre-line text-xs leading-snug text-zinc-500">
                              {n.body}
                            </p>
                          </div>
                          <div className="relative z-10 flex shrink-0 flex-col items-end gap-1.5">
                            {!n.is_read ? (
                              <span
                                aria-label="Unread"
                                className="h-1.5 w-1.5 rounded-full bg-violet-500"
                              />
                            ) : (
                              <span className="h-1.5 w-1.5" aria-hidden />
                            )}
                            <button
                              type="button"
                              onClick={(e) => void handleNotifDelete(e, n)}
                              aria-label={`Delete "${n.title}"`}
                              className="rounded p-0.5 text-zinc-400 opacity-0 transition hover:bg-zinc-200/60 hover:text-rose-500 focus:opacity-100 group-hover:opacity-100 dark:hover:bg-zinc-800/60 dark:hover:text-rose-400"
                            >
                              <X className="h-3.5 w-3.5" aria-hidden />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
