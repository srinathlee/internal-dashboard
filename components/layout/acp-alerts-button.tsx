"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Bell,
  CheckCircle2,
  MessageSquare,
  Target,
  Trophy,
  type LucideIcon,
} from "lucide-react";

import { useAuth } from "@/lib/auth";
import { isSalesMember } from "@/lib/access";
import { ApiError } from "@/lib/api/client";
import {
  useMyAcpDailyLogs,
  useMyAcpMessages,
} from "@/lib/hooks/use-accelerator";
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
  return <RepAlerts userId={auth.user.id} />;
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

function RepAlerts({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [seenAt, setSeenAt] = useState<string | null>(() => readSeen(userId));

  // Enrollment gate keys off the PROVEN `/acp/me/messages` signal (same as the
  // pitch-upload control); a 404/401/403 means "not an Accelerator rep".
  const enrollment = useMyAcpMessages();
  const logsQuery = useMyAcpDailyLogs();
  const { refetch: refetchMsgs } = enrollment;
  const { refetch: refetchLogs } = logsQuery;

  const notAcpMember =
    enrollment.error instanceof ApiError &&
    (enrollment.error.status === 404 ||
      enrollment.error.status === 401 ||
      enrollment.error.status === 403);

  // Keep fresh without a reload: poll every 60s + refetch on tab focus. The
  // focus retry stays on even for non-members so it self-heals on enrollment.
  useEffect(() => {
    const onFocus = () => {
      void refetchMsgs();
      void refetchLogs();
    };
    window.addEventListener("focus", onFocus);
    const id = notAcpMember
      ? null
      : window.setInterval(() => {
          void refetchMsgs();
          void refetchLogs();
        }, 60_000);
    return () => {
      if (id !== null) window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [refetchMsgs, refetchLogs, notAcpMember]);

  const messages = useMemo(() => enrollment.data ?? [], [enrollment.data]);
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

  // Badge counts the things the rep should act on (red / amber) plus any new
  // coach messages — milestones and standing feedback don't light the bell.
  const badgeCount = useMemo(
    () =>
      alerts.filter((a) => a.severity === "action" || a.severity === "warning")
        .length + unreadCount,
    [alerts, unreadCount],
  );

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

  // Opening the panel marks alerts seen up to now (clears the message portion
  // of the badge). Also refetch so the rep always sees the freshest state.
  useEffect(() => {
    if (!open) return;
    void refetchMsgs();
    void refetchLogs();
    const iso = new Date().toISOString();
    setSeenAt(iso);
    writeSeen(userId, iso);
  }, [open, refetchMsgs, refetchLogs, userId]);

  // Accelerator-only: render nothing until a successful /me/messages response
  // confirms enrollment (`data` is then an array, even if empty).
  if (notAcpMember || !Array.isArray(enrollment.data)) return null;

  const filters: { key: Filter; label: string; count: number }[] = [
    { key: "all", label: "All", count: alerts.length },
    { key: "daily_task", label: CATEGORY_META.daily_task.tab, count: counts.daily_task },
    { key: "target", label: CATEGORY_META.target.tab, count: counts.target },
    { key: "feedback", label: CATEGORY_META.feedback.tab, count: counts.feedback },
  ];

  const hasAction = alerts.some((a) => a.severity === "action");

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
              {alerts.length === 0
                ? "You're all caught up."
                : `${alerts.length} item${alerts.length === 1 ? "" : "s"}`}
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

          {visible.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-500" aria-hidden />
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
                All caught up!
              </p>
              <p className="text-sm text-zinc-500">
                {alerts.length === 0
                  ? "Nothing needs your attention right now."
                  : "No alerts in this category."}
              </p>
            </div>
          ) : (
            <div className="flex-1 space-y-2 overflow-y-auto p-4">
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
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
