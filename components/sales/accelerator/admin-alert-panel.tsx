"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  X,
  XCircle,
  type LucideIcon,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { getInitials } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AcpMember } from "@/lib/api/sales-accelerator";
import {
  getBatchAlerts,
  type AcpAdminAlert,
  type AcpAdminAlertCategory,
} from "@/lib/acp/alerts";

import { getRepWeek } from "./acp-shared";

type Filter = "all" | "critical" | "warning";

const CATEGORY_LABEL: Record<AcpAdminAlertCategory, string> = {
  attendance: "Attendance",
  activity: "Activity",
  audio: "Audio",
  performance: "Performance",
  target: "Target",
  admin_action: "Action",
};

/** Severity icon + accent colour for an alert row. */
function severityVisual(severity: AcpAdminAlert["severity"]): {
  Icon: LucideIcon;
  className: string;
} {
  return severity === "critical"
    ? { Icon: XCircle, className: "text-rose-500" }
    : { Icon: AlertTriangle, className: "text-amber-500" };
}

// ---------------------------------------------------------------------------
// Dismissed-alert persistence
//
// Alerts are recomputed from the roster each render, so "acknowledged" state
// lives client-side: a set of `${repId}:${alertId}` keys per batch in
// localStorage. Because alert ids are condition-specific (e.g. "w3-below-50"),
// a dismissal clears itself once the rep's situation changes and a *different*
// rule fires — the new alert has a new key and shows again.
// ---------------------------------------------------------------------------

const DISMISS_PREFIX = "myteamflow:acp-batch-alerts-dismissed:";

function dismissKey(repId: string, alertId: string): string {
  return `${repId}:${alertId}`;
}

function readDismissed(batchId: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(DISMISS_PREFIX + batchId);
    const arr = raw ? (JSON.parse(raw) as unknown) : null;
    return Array.isArray(arr) ? new Set(arr.filter((x) => typeof x === "string")) : new Set();
  } catch {
    return new Set();
  }
}

function writeDismissed(batchId: string, set: Set<string>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      DISMISS_PREFIX + batchId,
      JSON.stringify([...set]),
    );
  } catch {
    // localStorage may be blocked — non-fatal, dismissals just won't persist.
  }
}

/**
 * Admin alert bell + slide-in panel for a batch.
 *
 * Computes alerts on the fly from the loaded roster (no extra fetches) via
 * {@link getBatchAlerts}, so the badge and list stay in sync with the member
 * data the dashboard already holds. Clicking an alert dismisses it (decrements
 * the badge); clicking a rep's name opens their profile and closes the panel.
 */
export function BatchAlerts({
  batchId,
  members,
  onOpenRep,
}: {
  batchId: string;
  members: AcpMember[];
  onOpenRep: (repId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [dismissed, setDismissed] = useState<Set<string>>(() =>
    readDismissed(batchId),
  );

  // Re-sync if the panel is ever reused for a different batch.
  useEffect(() => setDismissed(readDismissed(batchId)), [batchId]);

  const computed = useMemo(() => getBatchAlerts(members), [members]);

  // Drop acknowledged alerts, then re-derive the counts/grouping from what's
  // left so the badge, tabs and list all agree.
  const alerts = useMemo(() => {
    const all = computed.all.filter(
      (a) => !dismissed.has(dismissKey(a.rep.id, a.id)),
    );
    const byRep = computed.byRep
      .map(({ rep, alerts: a }) => ({
        rep,
        alerts: a.filter((x) => !dismissed.has(dismissKey(rep.id, x.id))),
      }))
      .filter((g) => g.alerts.length > 0);
    return {
      all,
      critical: all.filter((a) => a.severity === "critical"),
      warning: all.filter((a) => a.severity === "warning"),
      byRep,
    };
  }, [computed, dismissed]);

  const total = alerts.all.length;
  const criticalCount = alerts.critical.length;
  const warningCount = alerts.warning.length;
  const hasCritical = criticalCount > 0;

  const visibleReps = useMemo(() => {
    if (filter === "all") return alerts.byRep;
    return alerts.byRep
      .map(({ rep, alerts: a }) => ({
        rep,
        alerts: a.filter((x) => x.severity === filter),
      }))
      .filter((g) => g.alerts.length > 0);
  }, [alerts.byRep, filter]);

  const dismiss = (repId: string, alertId: string) => {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(dismissKey(repId, alertId));
      writeDismissed(batchId, next);
      return next;
    });
  };

  const dismissAll = () => {
    setDismissed((prev) => {
      const next = new Set(prev);
      for (const a of alerts.all) next.add(dismissKey(a.rep.id, a.id));
      writeDismissed(batchId, next);
      return next;
    });
  };

  const filters: { key: Filter; label: string; count: number }[] = [
    { key: "all", label: "All", count: total },
    { key: "critical", label: "Critical", count: criticalCount },
    { key: "warning", label: "Warning", count: warningCount },
  ];

  const openRep = (repId: string) => {
    setOpen(false);
    onOpenRep(repId);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`${total} alert${total === 1 ? "" : "s"}`}
        className={cn(
          "relative inline-flex h-9 w-9 items-center justify-center rounded-full border transition-colors",
          hasCritical
            ? "border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-400 dark:hover:bg-rose-950/50"
            : "border-zinc-200 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-50",
        )}
      >
        <Bell className="h-4 w-4" aria-hidden />
        {total > 0 ? (
          <span
            aria-hidden
            className={cn(
              "absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[10px] font-semibold text-white",
              hasCritical ? "bg-rose-500" : "bg-amber-500",
            )}
          >
            {total > 99 ? "99+" : total}
          </span>
        ) : null}
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 p-0 sm:w-[460px] sm:max-w-none"
        >
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Bell
                className={cn(
                  "h-4 w-4",
                  hasCritical ? "text-rose-500" : "text-zinc-400",
                )}
                aria-hidden
              />
              Alerts
            </SheetTitle>
            <p className="text-sm text-zinc-500">
              {total === 0
                ? "Nothing needs attention."
                : [
                    criticalCount > 0 ? `${criticalCount} critical` : null,
                    warningCount > 0 ? `${warningCount} warning` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
            </p>
          </SheetHeader>

          {/* Filter tabs + clear-all */}
          <div className="flex items-center justify-between gap-2 border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
            <div className="flex items-center gap-2">
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
            <button
              type="button"
              onClick={dismissAll}
              disabled={total === 0}
              className="shrink-0 text-xs font-semibold text-zinc-500 transition-colors hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-400 dark:hover:text-rose-400"
            >
              Clear all
            </button>
          </div>

          {/* List grouped by rep */}
          {visibleReps.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-500" aria-hidden />
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
                All clear!
              </p>
              <p className="text-sm text-zinc-500">
                {total === 0
                  ? "No reps need attention right now."
                  : "No alerts match this filter."}
              </p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              {visibleReps.map(({ rep, alerts: repAlerts }) => {
                const pos = getRepWeek(rep.joined_at);
                const repCritical = repAlerts.some(
                  (a) => a.severity === "critical",
                );
                return (
                  <div
                    key={rep.id}
                    className="border-b border-zinc-100 last:border-b-0 dark:border-zinc-800"
                  >
                    <button
                      type="button"
                      onClick={() => openRep(rep.id)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/60"
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarFallback
                          className={cn(
                            "text-[10px]",
                            repCritical
                              ? "bg-rose-100 text-rose-700 ring-2 ring-rose-300 dark:bg-rose-950/50 dark:text-rose-300 dark:ring-rose-800"
                              : "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
                          )}
                        >
                          {getInitials(rep.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">
                          {rep.name}
                        </span>
                        <span className="block text-xs text-zinc-500">
                          W{pos.week} · Day {pos.dayInWeek}
                        </span>
                      </span>
                      <span
                        className={cn(
                          "shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums",
                          repCritical
                            ? "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                            : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
                        )}
                      >
                        {repAlerts.length}
                      </span>
                    </button>

                    <ul className="space-y-2 px-4 pb-3">
                      {repAlerts.map((a) => {
                        const { Icon, className } = severityVisual(a.severity);
                        return (
                          <li key={a.id}>
                            <button
                              type="button"
                              onClick={() => dismiss(rep.id, a.id)}
                              aria-label={`Dismiss: ${a.message}`}
                              title="Click to dismiss"
                              className="group flex w-full items-start gap-2.5 rounded-lg border border-zinc-100 bg-zinc-50/60 px-3 py-2 text-left transition-colors hover:border-zinc-200 hover:bg-zinc-100/80 dark:border-zinc-800 dark:bg-zinc-900/40 dark:hover:border-zinc-700 dark:hover:bg-zinc-900/80"
                            >
                              <Icon
                                className={cn(
                                  "mt-0.5 h-4 w-4 shrink-0",
                                  className,
                                )}
                                aria-hidden
                              />
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-medium leading-snug">
                                  {a.message}
                                </div>
                                {a.detail ? (
                                  <div className="mt-0.5 text-xs text-zinc-500">
                                    {a.detail}
                                  </div>
                                ) : null}
                                <div className="mt-1 text-[10px] font-medium uppercase tracking-wide text-zinc-400">
                                  {CATEGORY_LABEL[a.category]}
                                </div>
                              </div>
                              <X
                                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-300 transition-colors group-hover:text-rose-500 dark:text-zinc-600"
                                aria-hidden
                              />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
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
