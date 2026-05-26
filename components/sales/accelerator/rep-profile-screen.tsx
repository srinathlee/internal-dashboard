"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronRight,
  Clock,
  Loader2,
  MessageSquare,
  Send,
  TrendingUp,
  UserCog,
  Zap,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { LeadDetailSheet } from "@/components/sales/leads/lead-detail-sheet";
import { useAuth } from "@/lib/auth";
import { isSalesAdminOrSuperAdmin } from "@/lib/access";
import { getInitials } from "@/lib/format";
import { errorMessage, useRefetchOnFocus } from "@/lib/hooks/use-async";
import {
  useAcpMember,
  useAcpMemberDailyLogs,
  useAcpMemberSprints,
  useAcpMutations,
} from "@/lib/hooks/use-accelerator";
import { useLead, useLeadMutations } from "@/lib/hooks/use-leads";
import { adaptLeadDetail, toApiStage } from "@/lib/api/adapters";
import type {
  AcpDailyLog,
  AcpReview,
  AcpSprint,
  AcpTag,
} from "@/lib/api/sales-accelerator";
import type { LeadStage } from "@/lib/types";
import { cn } from "@/lib/utils";

import {
  acpFmt,
  getRepWeek,
  REVIEW_META,
  SectionLabel,
  TAG_KEYS,
  TAG_META,
  weekDayForDate,
  weekTitle,
} from "./acp-shared";
import { DayLogCard } from "./rep-detail-panel";

/** Readable "last saved" stamp for the admin note (e.g. "May 22, 10:15 AM"). */
function formatSavedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/**
 * Full-page rep profile for the Accelerator program — the page replacement for
 * the old side-panel. Only renders sections backed by real data (header,
 * stats, quick actions, hospitals & sprints, daily work log, admin note);
 * the mockup's trajectory chart / rank / conversion / milestones / activity
 * log are intentionally left out until the backend exposes them.
 */
export function RepProfileScreen({
  batchId,
  repId,
}: {
  batchId: string;
  repId: string;
}) {
  const auth = useAuth();
  const member = useAcpMember(repId);
  const logsQuery = useAcpMemberDailyLogs(repId);
  const sprints = useAcpMemberSprints(repId);
  const { setReview, setTag, sendMessage, setNote: persistNote } =
    useAcpMutations();

  // When a rep deletes a lead (or moves one to/out of a sprint) on their own
  // app, this admin page won't know until it re-reads. Refetch on tab focus so
  // the lead count, SPRINT ₹ and sprints list reflect those changes when the
  // admin returns to the dashboard, without a manual reload.
  useRefetchOnFocus([member.refetch, logsQuery.refetch, sprints.refetch]);

  // A sprint card that came from a pipeline lead opens that lead in the shared
  // detail sheet (same component the pipeline / rep-leads tab use).
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const leadDetail = useLead(selectedLeadId);
  const leadMutations = useLeadMutations();
  const selectedLead = leadDetail.data ? adaptLeadDetail(leadDetail.data) : null;

  const handleLeadStage = async (leadId: string, next: LeadStage) => {
    try {
      await leadMutations.setStage(leadId, toApiStage(next));
      toast.success("Stage updated");
      // The move may change which bucket the sprint sits in (or its revenue).
      sprints.refetch();
      member.refetch();
      leadDetail.refetch();
    } catch (err) {
      toast.error("Couldn't update stage", { description: errorMessage(err) });
    }
  };

  // Local working copy of logs so review edits reflect instantly.
  const [logs, setLogs] = useState<AcpDailyLog[]>([]);
  useEffect(() => setLogs(logsQuery.data ?? []), [logsQuery.data]);

  const [note, setNote] = useState("");
  // `savedNote` mirrors what's persisted on the server, so we only PATCH on
  // blur when the text actually changed; `noteSavedAt` drives the "saved …" line.
  const [savedNote, setSavedNote] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteSavedAt, setNoteSavedAt] = useState<string | null>(null);
  const [msgOpen, setMsgOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [tagging, setTagging] = useState(false);

  const m = member.data;
  useEffect(() => {
    setNote(m?.note ?? "");
    setSavedNote(m?.note ?? "");
    setNoteSavedAt(m?.note_updated_at ?? null);
  }, [m?.note, m?.note_updated_at]);

  const repWeek = m
    ? m.current_week != null
      ? {
          week: m.current_week,
          dayInWeek: m.current_day ?? 1,
          month: m.current_month ?? (m.current_week <= 4 ? 1 : 2),
        }
      : getRepWeek(m.joined_at)
    : null;

  // Decorate logs with week/day computed from joined_at + date.
  const decoratedLogs = useMemo(() => {
    if (!m) return logs;
    return logs.map((l) => {
      if (l.week && l.day_in_week) return l;
      const wd = weekDayForDate(m.joined_at, l.date);
      return { ...l, week: l.week || wd.week, day_in_week: l.day_in_week || wd.dayInWeek };
    });
  }, [logs, m]);

  const weekGroups = useMemo(() => {
    const map = new Map<number, AcpDailyLog[]>();
    for (const l of decoratedLogs) {
      const arr = map.get(l.week) ?? [];
      arr.push(l);
      map.set(l.week, arr);
    }
    return [...map.entries()].sort((a, b) => b[0] - a[0]);
  }, [decoratedLogs]);

  // Latest review drives the header badge; logs are newest-first.
  const currentReview = logs[0]?.admin_review ?? m?.current_review ?? null;

  // Drop "orphaned" sprints left behind when a rep deletes the lead that
  // created them. The backend currently nulls the sprint's lead link instead of
  // deleting the sprint, so it lingers as a ₹0 row with no `lead_id` (no
  // chevron, no doctor/phone subtitle). Hiding those keeps the list + count in
  // sync with reality. Restricted to ₹0 so we never disagree with the backend's
  // SPRINT ₹ total (a non-zero orphan still needs the backend cascade — see
  // docs/backend-acp-delete-rep-and-lead.md). No-op once the backend deletes
  // orphaned sprints on lead delete.
  const rawSprintList = sprints.data?.sprints ?? [];
  const sprintList = rawSprintList.filter(
    (s) => s.lead_id != null || s.amount > 0,
  );
  const activeSprints = sprintList.filter(
    (s) => s.status === "active" || s.status === "confirmed",
  );
  const subscriptions = sprintList.filter((s) => s.status === "converted");
  const runningSprints = activeSprints.length;
  const convertedSprints = subscriptions.length;
  // M2 progress mirrors month1_pct: subscription revenue toward the ₹1.1L
  // revenue target, the way M1 tracks sprint ₹ toward the ₹10K sprint target.
  // Both bars stay on screen in every month so the M2 goal isn't missed once
  // the rep crosses into month 2.
  const month2Pct =
    m && m.revenue_target > 0
      ? Math.min(
          100,
          Math.round((m.subscription_revenue / m.revenue_target) * 100),
        )
      : 0;

  const handleReview = async (log: AcpDailyLog, value: AcpReview) => {
    const prev = log.admin_review;
    setLogs((cur) =>
      cur.map((l) => (l.id === log.id ? { ...l, admin_review: value } : l)),
    );
    try {
      await setReview(log.id, value);
    } catch (err) {
      setLogs((cur) =>
        cur.map((l) => (l.id === log.id ? { ...l, admin_review: prev } : l)),
      );
      toast.error("Couldn't save review", { description: errorMessage(err) });
    }
  };

  const handleTag = async (tag: AcpTag) => {
    if (!m || tag === m.tag || tagging) return;
    if (tag === "fired" && !window.confirm(`Fire ${m.name}?`)) return;
    setTagging(true);
    try {
      // The backend syncs the login status to the tag and echoes it back, so we
      // can tell the admin exactly what happened to the rep's sign-in access.
      const res = await setTag(repId, tag);
      toast.success(
        res.status === "inactive"
          ? `${m.name} fired — login disabled`
          : `${m.name} set to ${TAG_META[res.tag].label} — login enabled`,
      );
      member.refetch();
    } catch (err) {
      toast.error("Couldn't update status", { description: errorMessage(err) });
    } finally {
      setTagging(false);
    }
  };

  // Persist the admin note on blur, but only when it changed. An empty string
  // clears the note server-side (per the note API).
  const handleSaveNote = async () => {
    if (noteSaving || note === savedNote) return;
    setNoteSaving(true);
    try {
      const res = await persistNote(repId, note);
      setSavedNote(res.note);
      setNoteSavedAt(res.note_updated_at ?? new Date().toISOString());
      toast.success("Note saved");
    } catch (err) {
      toast.error("Couldn't save note", { description: errorMessage(err) });
    } finally {
      setNoteSaving(false);
    }
  };

  const handleSend = async () => {
    const text = message.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      await sendMessage(repId, text);
      toast.success("Message sent", { description: `Delivered to ${m?.name}` });
      setMessage("");
      setMsgOpen(false);
    } catch (err) {
      toast.error("Couldn't send message", { description: errorMessage(err) });
    } finally {
      setSending(false);
    }
  };

  if (!auth.isLoaded) {
    return (
      <div className="space-y-6">
        <Card className="h-24 animate-pulse" />
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

  const fired = m?.status === "inactive" || m?.tag === "fired";

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
        <Link
          href={`/sales/accelerator/${batchId}`}
          className="transition-colors hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          {m?.batch_name ?? "Batch"}
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        <span className="font-medium text-zinc-900 dark:text-zinc-100">
          {m?.name ?? "Rep"}
        </span>
      </div>

      {member.error ? (
        <Card className="p-8 text-center text-sm text-rose-600 dark:text-rose-400">
          Couldn&apos;t load rep: {errorMessage(member.error)}
        </Card>
      ) : !m ? (
        <div className="space-y-6">
          <Card className="h-24 animate-pulse" />
          <Card className="h-40 animate-pulse" />
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-14 w-14">
                <AvatarFallback className="bg-violet-100 text-base text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">
                  {getInitials(m.name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="text-2xl font-bold tracking-tight">{m.name}</h1>
                  <span
                    className={cn(
                      "flex items-center gap-1.5 text-sm font-medium",
                      fired
                        ? "text-rose-600 dark:text-rose-400"
                        : "text-emerald-600 dark:text-emerald-400",
                    )}
                  >
                    <span
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        fired ? "bg-rose-500" : "bg-emerald-500",
                      )}
                    />
                    {fired ? "Fired" : "Active"}
                  </span>
                  {currentReview ? (
                    <span
                      className={cn(
                        "rounded-md px-2 py-0.5 text-xs font-semibold",
                        REVIEW_META[currentReview].badge,
                      )}
                    >
                      {REVIEW_META[currentReview].label}
                    </span>
                  ) : null}
                </div>
                <div className="mt-1 text-sm text-zinc-500">
                  Joined {m.joined_at.slice(0, 10)}
                  {repWeek ? ` · M${repWeek.month} · W${repWeek.week} Day ${repWeek.dayInWeek}` : ""}
                  {m.batch_name ? ` · ${m.batch_name}` : ""}
                  {m.phone ? ` · ${m.phone}` : ""}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Select
                value={m.tag === "fired" ? "fired" : "active"}
                onValueChange={(v) => handleTag(v as AcpTag)}
              >
                <SelectTrigger
                  className="h-9 w-[120px]"
                  disabled={tagging}
                  aria-label="Change status"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TAG_KEYS.map((key) => (
                    <SelectItem key={key} value={key}>
                      {TAG_META[key].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" asChild>
                <Link href={`/sales/accelerator/${batchId}/${repId}/profile`}>
                  <UserCog className="h-4 w-4" aria-hidden />
                  Profile
                </Link>
              </Button>
              <Button variant="outline" onClick={() => setMsgOpen(true)}>
                <MessageSquare className="h-4 w-4" aria-hidden />
                Message
              </Button>
            </div>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatTile
              label="Sprint ₹"
              value={acpFmt(m.sprint_revenue)}
              tone={
                m.sprint_revenue >= m.sprint_target
                  ? "good"
                  : m.sprint_revenue > 0
                    ? "amber"
                    : "muted"
              }
              caption={
                m.lead_count != null
                  ? `${runningSprints} running · ${m.lead_count} ${m.lead_count === 1 ? "lead" : "leads"}`
                  : `${runningSprints} running · ${sprintList.length} total`
              }
            />
            <StatTile
              label="Subs ₹"
              value={acpFmt(m.subscription_revenue)}
              tone={m.subscription_revenue > 0 ? "good" : "muted"}
              caption={
                convertedSprints > 0
                  ? `${convertedSprints} converted`
                  : "No conversion yet"
              }
            />
            <Card className="col-span-2 p-4 sm:col-span-1 sm:p-5">
              <SectionLabel>Progress</SectionLabel>
              <div className="mt-2 space-y-3">
                <ProgressRow
                  label="M1 · sprint"
                  pct={m.month1_pct}
                  caption={`${acpFmt(m.sprint_revenue)} of ${acpFmt(m.sprint_target || 10000)}`}
                  active={repWeek?.month === 1}
                />
                <ProgressRow
                  label="M2 · revenue"
                  pct={month2Pct}
                  caption={`${acpFmt(m.subscription_revenue)} of ${acpFmt(m.revenue_target || 110000)}`}
                  active={repWeek?.month === 2}
                />
              </div>
            </Card>
          </div>

          {/* Body: log (left) + side rail (right) */}
          <div className="grid gap-4 lg:grid-cols-3">
            {/* Daily work log */}
            <Card className="overflow-hidden lg:col-span-2">
              <div className="flex items-center gap-2 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
                <Clock className="h-4 w-4 text-violet-500" aria-hidden />
                <span className="text-sm font-semibold">Daily work log</span>
                {repWeek ? (
                  <span className="ml-auto text-xs text-zinc-500">
                    W{repWeek.week} {weekTitle(repWeek.week)}
                  </span>
                ) : null}
              </div>
              <div className="p-4">
                {logsQuery.isLoading && logs.length === 0 ? (
                  <div className="h-24 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900" />
                ) : logs.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-zinc-200 p-6 text-center text-sm text-zinc-500 dark:border-zinc-800">
                    No daily logs yet.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {weekGroups.map(([week, weekLogs]) => (
                      <div key={week}>
                        <div className="mb-2 flex items-center gap-2">
                          <span className="text-xs font-semibold text-violet-600 dark:text-violet-400">
                            W{week}
                          </span>
                          <span className="text-xs text-zinc-500">
                            {weekTitle(week)}
                          </span>
                          {repWeek?.week === week ? (
                            <span className="rounded bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold text-violet-600 dark:bg-violet-950/40 dark:text-violet-300">
                              Current
                            </span>
                          ) : null}
                        </div>
                        <div className="space-y-2">
                          {weekLogs.map((log) => (
                            <DayLogCard
                              key={log.id}
                              log={log}
                              onReview={(v) => handleReview(log, v)}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>

            {/* Side rail */}
            <div className="space-y-4">
              {/* Sprints */}
              <Card className="overflow-hidden">
                <div className="flex items-center gap-2 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
                  <Zap className="h-4 w-4 text-amber-500" aria-hidden />
                  <span className="text-sm font-semibold">Sprints</span>
                  <span className="ml-auto text-xs tabular-nums text-zinc-500">
                    {activeSprints.length}
                  </span>
                </div>
                {activeSprints.length === 0 ? (
                  <div className="p-6 text-center text-sm text-zinc-500">
                    No active sprints.
                  </div>
                ) : (
                  <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {activeSprints.map((s) => (
                      <SprintRow
                        key={s.id}
                        name={s.hospital_name}
                        subtitle={leadSubtitle(s)}
                        amount={s.amount}
                        status={s.status}
                        date={s.started_at}
                        onOpen={
                          s.lead_id
                            ? () => setSelectedLeadId(s.lead_id!)
                            : undefined
                        }
                      />
                    ))}
                  </div>
                )}
              </Card>

              {/* Subscriptions */}
              <Card className="overflow-hidden">
                <div className="flex items-center gap-2 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
                  <TrendingUp className="h-4 w-4 text-emerald-500" aria-hidden />
                  <span className="text-sm font-semibold">Subscriptions</span>
                  <span className="ml-auto text-xs tabular-nums text-zinc-500">
                    {subscriptions.length}
                  </span>
                </div>
                {subscriptions.length === 0 ? (
                  <div className="p-6 text-center text-sm text-zinc-500">
                    No subscriptions yet.
                  </div>
                ) : (
                  <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {subscriptions.map((s) => (
                      <SprintRow
                        key={s.id}
                        name={s.plan_name ?? s.hospital_name}
                        subtitle={leadSubtitle(s)}
                        amount={s.plan_value ?? s.amount}
                        status={s.status}
                        date={s.confirmed_at ?? s.started_at}
                        onOpen={
                          s.lead_id
                            ? () => setSelectedLeadId(s.lead_id!)
                            : undefined
                        }
                      />
                    ))}
                  </div>
                )}
              </Card>

              {/* Admin note */}
              <Card className="p-4">
                <SectionLabel>Admin note</SectionLabel>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Private notes about this rep…"
                  className="mt-2 min-h-24 resize-y"
                />
                <div className="mt-2 flex items-center justify-between gap-2">
                  <p className="text-[11px] text-zinc-400">
                    {noteSaving
                      ? "Saving…"
                      : note !== savedNote
                        ? "Unsaved changes"
                        : noteSavedAt
                          ? `Saved · ${formatSavedAt(noteSavedAt)}`
                          : "Private — visible to admins only."}
                  </p>
                  <Button
                    size="sm"
                    onClick={handleSaveNote}
                    disabled={noteSaving || note === savedNote}
                  >
                    {noteSaving ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    ) : null}
                    Save note
                  </Button>
                </div>
              </Card>
            </div>
          </div>
        </>
      )}

      {/* Message dialog */}
      <Dialog open={msgOpen} onOpenChange={setMsgOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Message {m?.name ?? "rep"}</DialogTitle>
          </DialogHeader>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type a message…"
            className="min-h-28"
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setMsgOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSend} disabled={message.trim().length === 0 || sending}>
              <Send className="h-4 w-4" aria-hidden />
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lead detail — opened from a lead-sourced sprint/subscription card */}
      <LeadDetailSheet
        lead={selectedLead}
        open={selectedLeadId !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedLeadId(null);
        }}
        onChangeStage={handleLeadStage}
        onMutated={() => {
          sprints.refetch();
          member.refetch();
          leadDetail.refetch();
        }}
      />
    </div>
  );
}

/** "Dr. Rao · 98765 43210" line for a lead-sourced sprint card, or null. */
function leadSubtitle(s: AcpSprint): string | null {
  const parts = [s.doctor_name, s.phone].filter(
    (v): v is string => typeof v === "string" && v.length > 0,
  );
  return parts.length > 0 ? parts.join(" · ") : null;
}

function StatTile({
  label,
  value,
  tone,
  caption,
}: {
  label: string;
  value: string;
  tone: "good" | "amber" | "bad" | "muted";
  caption?: string;
}) {
  const toneClass = {
    good: "text-emerald-600 dark:text-emerald-400",
    amber: "text-amber-600 dark:text-amber-400",
    bad: "text-rose-600 dark:text-rose-400",
    muted: "text-zinc-400",
  }[tone];
  return (
    <Card className="p-4 sm:p-5">
      <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
        {label}
      </div>
      <div className={cn("mt-1 text-2xl font-bold tabular-nums", toneClass)}>
        {value}
      </div>
      {caption ? (
        <div className="mt-1.5 text-[11px] text-zinc-500">{caption}</div>
      ) : null}
    </Card>
  );
}

/**
 * One labelled progress bar inside the program-progress card. Rendered twice —
 * M1 (sprint ₹) and M2 (revenue) — so both months stay visible regardless of
 * where the rep is. `active` marks the rep's current month with a "Now" pill;
 * a completed bar (≥100%) turns emerald, otherwise it's violet.
 */
function ProgressRow({
  label,
  pct,
  caption,
  active,
}: {
  label: string;
  pct: number;
  caption: string;
  active?: boolean;
}) {
  const done = pct >= 100;
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-500">
          {label}
          {active ? (
            <span className="rounded bg-violet-100 px-1 py-px text-[9px] font-semibold uppercase tracking-wide text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
              Now
            </span>
          ) : null}
        </span>
        <span
          className={cn(
            "text-sm font-bold tabular-nums",
            done
              ? "text-emerald-600 dark:text-emerald-400"
              : active
                ? "text-violet-600 dark:text-violet-400"
                : "text-zinc-400 dark:text-zinc-500",
          )}
        >
          {pct}%
        </span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
        <div
          className={cn(
            "h-full rounded-full",
            done ? "bg-emerald-500" : "bg-violet-500",
          )}
          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
        />
      </div>
      <div className="mt-1 text-[11px] text-zinc-500">{caption}</div>
    </div>
  );
}

const SPRINT_STATUS_DOT: Record<AcpSprint["status"], string> = {
  active: "bg-amber-500",
  confirmed: "bg-emerald-500",
  converted: "bg-emerald-500",
  refunded: "bg-zinc-400",
};

function SprintRow({
  name,
  subtitle,
  amount,
  status,
  date,
  onOpen,
}: {
  name: string;
  subtitle?: string | null;
  amount: number;
  status: AcpSprint["status"];
  date?: string;
  /** When set, the row becomes a button that opens the source lead. */
  onOpen?: () => void;
}) {
  const inner = (
    <>
      <span className="flex min-w-0 items-start gap-2">
        <span
          className={cn(
            "mt-1.5 h-2 w-2 shrink-0 rounded-full",
            SPRINT_STATUS_DOT[status],
          )}
        />
        <span className="min-w-0">
          <span className="block truncate">{name}</span>
          {subtitle ? (
            <span className="block truncate text-xs text-zinc-500">
              {subtitle}
            </span>
          ) : null}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        <span className="text-right">
          <span className="block font-semibold tabular-nums">
            {acpFmt(amount)}
          </span>
          {date ? (
            <span className="block text-xs text-zinc-500">
              {date.slice(5, 10)}
            </span>
          ) : null}
        </span>
        {onOpen ? (
          <ChevronRight
            className="h-4 w-4 shrink-0 text-zinc-300 dark:text-zinc-600"
            aria-hidden
          />
        ) : null}
      </span>
    </>
  );

  if (onOpen) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/60"
      >
        {inner}
      </button>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
      {inner}
    </div>
  );
}
