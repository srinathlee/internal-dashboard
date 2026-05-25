"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, Clock, MessageSquare, X, type LucideIcon } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/lib/auth";
import { isOnSales } from "@/lib/access";
import { cn } from "@/lib/utils";
import { errorMessage } from "@/lib/hooks/use-async";
import {
  useNotificationCount,
  useNotificationMutations,
  useNotifications,
} from "@/lib/hooks/use-notifications";
import type { ApiNotification } from "@/lib/api/sales-notifications";

/**
 * Header notification bell.
 *
 * Only sales users (members + sales admins) have a notification feed
 * (`/api/v1/sales/notifications` is sales-scoped), so the bell renders for
 * them alone — everyone else gets no bell rather than a polling 403. The
 * feed surfaces every server-generated notification: follow-up reminders,
 * and Accelerator messages once the backend emits a notification for them.
 */
export function NotificationsButton() {
  const auth = useAuth();
  // Gate before mounting the polling hooks so non-sales users never hit the
  // sales-only endpoint. The inner component owns all notification state.
  if (!isOnSales(auth)) return null;
  return <NotificationsBell />;
}

type NotifVisual = { icon: LucideIcon; iconClass: string; tileClass: string };

/** Icon + tile colour keyed off the notification type (forward-compatible). */
function visualFor(type: string): NotifVisual {
  const t = type.toUpperCase();
  if (t.includes("MESSAGE")) {
    return {
      icon: MessageSquare,
      iconClass: "text-violet-600 dark:text-violet-400",
      tileClass: "bg-violet-100 dark:bg-violet-950/40",
    };
  }
  if (t.includes("FOLLOW_UP") || t.includes("REMINDER")) {
    return {
      icon: Clock,
      iconClass: "text-amber-600 dark:text-amber-400",
      tileClass: "bg-amber-100 dark:bg-amber-950/40",
    };
  }
  return {
    icon: Bell,
    iconClass: "text-zinc-600 dark:text-zinc-300",
    tileClass: "bg-zinc-100 dark:bg-zinc-800/60",
  };
}

/**
 * Bell + dropdown, wired to the real notifications API.
 *
 * - `useNotificationCount` polls every 60s and on tab focus to drive the badge.
 * - The list endpoint is only hit when the dropdown opens, so the header
 *   doesn't pay for it on every render.
 * - Clicking an unread row PATCHes it read and decrements the badge optimistically.
 */
function NotificationsBell() {
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

  const handleDelete = async (
    e: React.MouseEvent<HTMLButtonElement>,
    n: ApiNotification,
  ) => {
    e.stopPropagation();
    // Optimistic removal — drop the row + decrement counts immediately.
    const prevData = listQuery.data;
    const wasUnread = !n.is_read;
    listQuery.setData(
      prevData
        ? {
            ...prevData,
            total: Math.max(0, prevData.total - 1),
            unread_count: Math.max(
              0,
              prevData.unread_count - (wasUnread ? 1 : 0),
            ),
            notifications: prevData.notifications.filter((x) => x.id !== n.id),
          }
        : null,
    );
    if (wasUnread) {
      countQuery.setCount(Math.max(0, unreadCount - 1));
    }
    try {
      await mutations.remove(n.id);
    } catch (err) {
      toast.error("Couldn't delete notification", {
        description: errorMessage(err),
      });
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

  const handleClearAll = async () => {
    if (notifications.length === 0) return;
    // Optimistic: empty the list + zero the badge now (§6.1 server-side clear).
    countQuery.setCount(0);
    listQuery.setData(
      listQuery.data
        ? { ...listQuery.data, total: 0, unread_count: 0, notifications: [] }
        : null,
    );
    try {
      await mutations.clearAll();
    } catch (err) {
      toast.error("Couldn't clear notifications", {
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
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-50"
      >
        <Bell className="h-4 w-4" aria-hidden />
        {unreadCount > 0 ? (
          <span
            aria-hidden
            className="absolute right-0.5 top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-violet-500 px-1 text-[10px] font-semibold text-white"
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
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleMarkAllRead}
                disabled={unreadCount === 0}
                className="text-xs font-semibold text-violet-600 transition-colors hover:text-violet-500 disabled:cursor-not-allowed disabled:opacity-50 dark:text-violet-400 dark:hover:text-violet-300"
              >
                Mark all read
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                disabled={notifications.length === 0}
                className="text-xs font-semibold text-zinc-500 transition-colors hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-400 dark:hover:text-rose-400"
              >
                Clear all
              </button>
            </div>
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
                const visual = visualFor(n.type);
                const Icon = visual.icon;
                return (
                  <div
                    key={n.id}
                    className={cn(
                      "group relative flex items-start gap-3 px-4 py-3 transition-colors",
                      !n.is_read &&
                        "bg-violet-50/40 hover:bg-violet-50/60 dark:bg-violet-950/20 dark:hover:bg-violet-950/30",
                      n.is_read && "hover:bg-zinc-50 dark:hover:bg-zinc-900/60",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => void handleRowClick(n)}
                      aria-label={n.is_read ? n.title : `Mark "${n.title}" read`}
                      className="absolute inset-0 z-0"
                    />
                    <span
                      aria-hidden
                      className={cn(
                        "relative z-10 mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-md",
                        visual.tileClass,
                      )}
                    >
                      <Icon className={cn("h-4 w-4", visual.iconClass)} />
                    </span>
                    <div className="relative z-10 min-w-0 flex-1">
                      <div className="text-sm font-semibold leading-tight">
                        {n.title}
                      </div>
                      <p className="mt-1 whitespace-pre-line text-xs leading-snug text-zinc-500">
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
                        onClick={(e) => void handleDelete(e, n)}
                        aria-label={`Delete "${n.title}"`}
                        className="rounded p-0.5 text-zinc-400 opacity-0 transition hover:bg-zinc-200/60 hover:text-rose-500 focus:opacity-100 group-hover:opacity-100 dark:hover:bg-zinc-800/60 dark:hover:text-rose-400"
                      >
                        <X className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </div>
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
