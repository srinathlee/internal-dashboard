"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Award,
  Bell,
  CheckCircle2,
  Eye,
  Loader2,
  Megaphone,
  Send,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/layout/page-header";
import { useAuth } from "@/lib/auth";
import { isSalesAdminOrSuperAdmin } from "@/lib/access";
import { getInitials } from "@/lib/format";
import { timeAgo } from "@/lib/format-metric";
import { errorMessage } from "@/lib/hooks/use-async";
import { useSubadmins } from "@/lib/hooks/use-subadmins";
import { useTeamBroadcasts } from "@/lib/hooks/use-broadcasts";
import {
  broadcastToTeam,
  type BroadcastType,
  type TeamBroadcast,
} from "@/lib/api/sales-overview";
import { cn } from "@/lib/utils";

const MAX_LENGTH = 280;

const QUICK_TEMPLATES = [
  "Team meeting at 5 PM today",
  "New target set for this month",
  "Please update your lead status by EOD",
];

interface TypeMeta {
  label: string;
  icon: LucideIcon;
  /** Solid fill applied to the selected type button. */
  active: string;
  /** Subtle tint used by the type tag + recent-feed icon box. */
  tint: string;
}

const TYPE_META: Record<BroadcastType, TypeMeta> = {
  ANNOUNCEMENT: {
    label: "Announcement",
    icon: Bell,
    active: "border-transparent bg-blue-600 text-white hover:bg-blue-600",
    tint: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  },
  MOTIVATION: {
    label: "Motivation",
    icon: Zap,
    active: "border-transparent bg-violet-600 text-white hover:bg-violet-600",
    tint: "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
  },
  ALERT: {
    label: "Alert",
    icon: AlertTriangle,
    active: "border-transparent bg-rose-600 text-white hover:bg-rose-600",
    tint: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
  },
  KUDOS: {
    label: "Kudos",
    icon: Award,
    active: "border-transparent bg-amber-500 text-white hover:bg-amber-500",
    tint: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  },
};

const TYPE_ORDER: BroadcastType[] = [
  "ANNOUNCEMENT",
  "MOTIVATION",
  "ALERT",
  "KUDOS",
];

/**
 * /sales/broadcast — compose and send an in-app broadcast to the team's reps,
 * with a categorized message type, recipient picker (defaults to everyone),
 * quick templates, and a recent-broadcasts feed.
 *
 * Wraps POST /api/v1/sales/team/broadcast. When all reps are selected we omit
 * `user_ids` so the backend fans out to "all active team members"; otherwise
 * we send the explicit subset.
 */
export function BroadcastScreen() {
  const auth = useAuth();

  const subadminsQuery = useSubadmins({ limit: 200, status: "ACTIVE" });
  const reps = useMemo(
    () => subadminsQuery.data?.sales_subadmins ?? [],
    [subadminsQuery.data],
  );

  const recent = useTeamBroadcasts({ limit: 10 });

  const [type, setType] = useState<BroadcastType>("ANNOUNCEMENT");
  const [message, setMessage] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  // Holds details of the just-sent broadcast to drive the success popup;
  // null while there's nothing to confirm.
  const [sentResult, setSentResult] = useState<{
    count: number;
    type: BroadcastType;
  } | null>(null);

  // Default to everyone selected once reps load (mirrors the screenshot where
  // every member is pre-checked). The ref guards against re-selecting all
  // after the admin deliberately clears the list.
  const seeded = useRef(false);
  useEffect(() => {
    if (!seeded.current && reps.length > 0) {
      setSelectedIds(new Set(reps.map((r) => r.id)));
      seeded.current = true;
    }
  }, [reps]);

  const allSelected = reps.length > 0 && selectedIds.size === reps.length;
  const remaining = MAX_LENGTH - message.length;

  const canSubmit =
    message.trim().length > 0 && selectedIds.size > 0 && !submitting;

  const toggleRep = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelectedIds((prev) =>
      prev.size === reps.length ? new Set() : new Set(reps.map((r) => r.id)),
    );

  const applyTemplate = (text: string) =>
    setMessage(text.slice(0, MAX_LENGTH));

  const handleSend = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    const trimmed = message.trim();
    const recipientCount = selectedIds.size;
    try {
      const res = await broadcastToTeam({
        message: trimmed,
        type,
        user_ids: allSelected ? undefined : Array.from(selectedIds),
      });

      const sent = res.sent_count || recipientCount;

      // Prepend the just-sent broadcast so the feed updates immediately even
      // before (or without) the list endpoint being live.
      const optimistic: TeamBroadcast = {
        id: res.id ?? `local-${Date.now()}`,
        message: trimmed,
        type: res.type ?? type,
        recipient_count: sent,
        created_at: res.created_at ?? new Date().toISOString(),
      };
      recent.setData([optimistic, ...(recent.data ?? [])]);

      setMessage("");
      // Surface a clear, explicit confirmation popup that the broadcast went out.
      setSentResult({ count: sent, type });
    } catch (err) {
      toast.error("Couldn't send broadcast", {
        description: errorMessage(err),
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!auth.isLoaded) {
    return (
      <div className="space-y-6">
        <Card className="h-20 animate-pulse" />
        <Card className="h-96 animate-pulse" />
      </div>
    );
  }

  if (!isSalesAdminOrSuperAdmin(auth)) {
    return (
      <div className="space-y-6">
        <PageHeader title="Broadcast to team" />
        <Card className="p-12 text-center text-sm text-zinc-500">
          Broadcasting is for sales admins and super admins.
        </Card>
      </div>
    );
  }

  const sendLabel = allSelected
    ? "Send to all team"
    : `Send to ${selectedIds.size} member${selectedIds.size === 1 ? "" : "s"}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Broadcast to team"
        description="Send an in-app announcement to your sales reps. They'll see it in their notifications instantly."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ---- Compose column ------------------------------------------- */}
        <div className="space-y-6 lg:col-span-2">
          {/* Message type */}
          <Card className="p-4">
            <SectionLabel>Message type</SectionLabel>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {TYPE_ORDER.map((t) => {
                const meta = TYPE_META[t];
                const Icon = meta.icon;
                const active = t === type;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    aria-pressed={active}
                    className={cn(
                      "flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors",
                      active
                        ? meta.active
                        : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900",
                    )}
                  >
                    <Icon className="h-4 w-4" aria-hidden />
                    {meta.label}
                  </button>
                );
              })}
            </div>
          </Card>

          {/* Recipients */}
          <Card className="overflow-hidden">
            <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
              <SectionLabel>Recipients</SectionLabel>
            </div>

            {subadminsQuery.isLoading && reps.length === 0 ? (
              <div className="p-8 text-center text-sm text-zinc-500">
                Loading team…
              </div>
            ) : subadminsQuery.error ? (
              <div className="p-6 text-center text-sm text-rose-600 dark:text-rose-400">
                Couldn&apos;t load the team: {errorMessage(subadminsQuery.error)}
              </div>
            ) : reps.length === 0 ? (
              <div className="p-8 text-center text-sm text-zinc-500">
                No active reps in your team to broadcast to.
              </div>
            ) : (
              <>
                {/* All team row */}
                <label className="flex cursor-pointer items-center gap-3 border-b border-zinc-100 px-4 py-3 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/60">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="h-4 w-4 accent-violet-600"
                  />
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-300">
                    <Users className="h-4 w-4" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold">All Team</div>
                    <div className="text-xs text-zinc-500">
                      {reps.length} member{reps.length === 1 ? "" : "s"}
                    </div>
                  </div>
                  <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                    Everyone
                  </span>
                </label>

                {/* Individual reps */}
                <div className="max-h-72 overflow-y-auto">
                  {reps.map((r) => {
                    const checked = selectedIds.has(r.id);
                    return (
                      <label
                        key={r.id}
                        className={cn(
                          "flex cursor-pointer items-center gap-3 border-b border-zinc-100 px-4 py-2.5 text-sm transition-colors last:border-b-0 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/60",
                          checked && "bg-violet-50/40 dark:bg-violet-950/20",
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleRep(r.id)}
                          className="h-4 w-4 accent-violet-600"
                        />
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-[11px]">
                            {getInitials(r.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium">{r.name}</div>
                          <div className="truncate text-xs text-zinc-500">
                            {r.email}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </>
            )}
          </Card>

          {/* Compose */}
          <Card className="p-4">
            <SectionLabel>Quick templates</SectionLabel>
            <div className="mt-3 flex flex-wrap gap-2">
              {QUICK_TEMPLATES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => applyTemplate(t)}
                  className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900"
                >
                  {t}
                </button>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-between">
              <Label htmlFor="broadcast-message">Message</Label>
              <span
                className={cn(
                  "text-xs tabular-nums",
                  remaining <= 20 ? "text-amber-600" : "text-zinc-400",
                )}
              >
                {remaining} left
              </span>
            </div>
            <div className="mt-1.5 rounded-lg border border-zinc-200 bg-white p-3 focus-within:ring-2 focus-within:ring-ring dark:border-zinc-800 dark:bg-zinc-950">
              <TypeTag type={type} />
              <Textarea
                id="broadcast-message"
                value={message}
                maxLength={MAX_LENGTH}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type your broadcast message…"
                rows={4}
                className="mt-2 min-h-[88px] resize-none border-0 bg-transparent p-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
              />
              <div className="mt-2 flex items-center gap-1.5 border-t border-zinc-100 pt-2 text-xs text-zinc-500 dark:border-zinc-800">
                <Users className="h-3.5 w-3.5" aria-hidden />
                {selectedIds.size} recipient{selectedIds.size === 1 ? "" : "s"}
              </div>
            </div>

            <Button
              type="button"
              className="mt-4 w-full"
              size="lg"
              disabled={!canSubmit}
              onClick={handleSend}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Send className="h-4 w-4" aria-hidden />
              )}
              {sendLabel}
            </Button>
          </Card>
        </div>

        {/* ---- Recent broadcasts ---------------------------------------- */}
        <div className="lg:col-span-1">
          <Card className="overflow-hidden">
            <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
              <SectionLabel>Recent broadcasts</SectionLabel>
            </div>
            <RecentBroadcasts
              loading={recent.isLoading}
              error={recent.error}
              broadcasts={recent.data ?? []}
            />
          </Card>
        </div>
      </div>

      <BroadcastSentDialog
        result={sentResult}
        onClose={() => setSentResult(null)}
      />
    </div>
  );
}

function BroadcastSentDialog({
  result,
  onClose,
}: {
  result: { count: number; type: BroadcastType } | null;
  onClose: () => void;
}) {
  const meta = result ? TYPE_META[result.type] : null;
  return (
    <Dialog open={result !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm text-center sm:max-w-sm">
        <DialogHeader className="items-center">
          <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/40">
            <CheckCircle2
              className="h-8 w-8 text-emerald-600 dark:text-emerald-400"
              aria-hidden
            />
          </div>
          <DialogTitle className="text-center">Broadcast sent!</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-zinc-500">
          Your {meta?.label.toLowerCase() ?? "message"} was delivered to{" "}
          <span className="font-semibold text-zinc-900 dark:text-zinc-100">
            {result?.count ?? 0} team member
            {(result?.count ?? 0) === 1 ? "" : "s"}
          </span>
          . They&apos;ll see it in their notifications instantly.
        </p>
        <DialogFooter className="sm:justify-center">
          <Button type="button" onClick={onClose} className="w-full sm:w-auto">
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
      {children}
    </span>
  );
}

function TypeTag({ type }: { type: BroadcastType }) {
  const meta = TYPE_META[type];
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold uppercase tracking-wide",
        meta.tint,
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {meta.label}
    </span>
  );
}

function RecentBroadcasts({
  loading,
  error,
  broadcasts,
}: {
  loading: boolean;
  error: Error | null;
  broadcasts: TeamBroadcast[];
}) {
  if (loading && broadcasts.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-zinc-500">Loading…</div>
    );
  }
  if (error) {
    return (
      <div className="p-6 text-center text-sm text-rose-600 dark:text-rose-400">
        Couldn&apos;t load recent broadcasts: {errorMessage(error)}
      </div>
    );
  }
  if (broadcasts.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 p-10 text-center">
        <Megaphone className="h-8 w-8 text-zinc-300 dark:text-zinc-600" aria-hidden />
        <p className="text-sm text-zinc-500">No broadcasts yet.</p>
        <p className="text-xs text-zinc-400">
          Messages you send to the team will show up here.
        </p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
      {broadcasts.map((b) => {
        const meta = TYPE_META[b.type] ?? TYPE_META.ANNOUNCEMENT;
        const Icon = meta.icon;
        return (
          <li key={b.id} className="flex gap-3 px-4 py-3">
            <div
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                meta.tint,
              )}
            >
              <Icon className="h-4 w-4" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-sm text-zinc-800 dark:text-zinc-100">
                {b.message}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
                <span
                  className={cn(
                    "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                    meta.tint,
                  )}
                >
                  {meta.label}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Users className="h-3 w-3" aria-hidden />
                  {b.recipient_count}
                </span>
                {b.read_count !== undefined ? (
                  <span className="inline-flex items-center gap-1">
                    <Eye className="h-3 w-3" aria-hidden />
                    {b.read_count} read
                  </span>
                ) : null}
                <span>{timeAgo(b.created_at)}</span>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
