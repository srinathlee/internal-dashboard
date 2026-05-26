"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Building2,
  Clock,
  FastForward,
  MapPin,
  MessageSquare,
  Pause,
  Play,
  Rewind,
  Send,
  TrendingUp,
  Volume2,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { getInitials } from "@/lib/format";
import { errorMessage } from "@/lib/hooks/use-async";
import {
  useAcpMember,
  useAcpMemberDailyLogs,
  useAcpMutations,
} from "@/lib/hooks/use-accelerator";
import type {
  AcpDailyLog,
  AcpReview,
  AcpTag,
} from "@/lib/api/sales-accelerator";
import { REVIEW_KEYS } from "@/lib/api/sales-accelerator";
import { cn } from "@/lib/utils";

import {
  acpFmt,
  ACTIVITY_META,
  getRepWeek,
  REVIEW_META,
  SectionLabel,
  TAG_KEYS,
  TAG_META,
  weekDayForDate,
  weekTitle,
} from "./acp-shared";

const TODAY = new Date().toISOString().slice(0, 10);

interface RepDetailPanelProps {
  memberId: string | null;
  onClose: () => void;
  /** Bubble a review change up so the batch board's summary cards recompute. */
  onReviewChange: (repId: string, date: string, review: AcpReview) => void;
  /** Fired after a tag change so the batch lists (fire list, etc.) refresh. */
  onMemberChanged?: () => void;
}

export function RepDetailPanel({
  memberId,
  onClose,
  onReviewChange,
  onMemberChanged,
}: RepDetailPanelProps) {
  const member = useAcpMember(memberId);
  const logsQuery = useAcpMemberDailyLogs(memberId);
  const { setReview, setTag, sendMessage } = useAcpMutations();

  // Local working copy of logs so review dropdown edits reflect instantly.
  const [logs, setLogs] = useState<AcpDailyLog[]>([]);
  useEffect(() => {
    setLogs(logsQuery.data ?? []);
  }, [logsQuery.data]);

  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [tagging, setTagging] = useState(false);

  const m = member.data;
  // Prefer the server-computed program position; fall back to client calc.
  const repWeek = m
    ? m.current_week != null
      ? {
          week: m.current_week,
          dayInWeek: m.current_day ?? 1,
          month: (m.current_month ?? (m.current_week <= 4 ? 1 : 2)) as 1 | 2,
        }
      : getRepWeek(m.joined_at)
    : null;

  const handleTag = async (tag: AcpTag) => {
    if (!memberId || !m || tag === m.tag) return;
    setTagging(true);
    try {
      await setTag(memberId, tag);
      toast.success("Tag updated", { description: TAG_META[tag].label });
      member.refetch();
      onMemberChanged?.();
    } catch (err) {
      toast.error("Couldn't update tag", { description: errorMessage(err) });
    } finally {
      setTagging(false);
    }
  };

  const handleSend = async () => {
    const text = message.trim();
    if (!text || !memberId || sending) return;
    setSending(true);
    try {
      await sendMessage(memberId, text);
      setMessage("");
      setSent(true);
      setTimeout(() => setSent(false), 2000);
    } catch (err) {
      toast.error("Couldn't send message", { description: errorMessage(err) });
    } finally {
      setSending(false);
    }
  };

  const handleReview = async (log: AcpDailyLog, value: AcpReview) => {
    const prev = log.admin_review;
    // Optimistic local update.
    setLogs((cur) =>
      cur.map((l) => (l.id === log.id ? { ...l, admin_review: value } : l)),
    );
    if (memberId) onReviewChange(memberId, log.date, value);
    try {
      await setReview(log.id, value);
    } catch (err) {
      // Revert on failure.
      setLogs((cur) =>
        cur.map((l) => (l.id === log.id ? { ...l, admin_review: prev } : l)),
      );
      toast.error("Couldn't save review", { description: errorMessage(err) });
    }
  };

  // Aggregate hospitals visited + sprints accepted across all logs.
  const { consulted, accepted } = useMemo(() => {
    const consultedMap = new Map<string, { date: string; sprinted: boolean }>();
    const acceptedMap = new Map<string, string>();
    // Walk oldest→newest so the stored date is the first visit/acceptance.
    for (const l of [...logs].reverse()) {
      for (const h of l.visited) {
        if (!consultedMap.has(h)) {
          consultedMap.set(h, { date: l.date, sprinted: false });
        }
      }
      for (const h of l.sprint_accepted) {
        if (!consultedMap.has(h)) {
          consultedMap.set(h, { date: l.date, sprinted: true });
        } else {
          consultedMap.get(h)!.sprinted = true;
        }
        if (!acceptedMap.has(h)) acceptedMap.set(h, l.date);
      }
    }
    return {
      consulted: [...consultedMap.entries()].map(([name, v]) => ({
        name,
        date: v.date,
        sprinted: v.sprinted,
      })),
      accepted: [...acceptedMap.entries()].map(([name, date]) => ({
        name,
        date,
      })),
    };
  }, [logs]);

  // Decorate logs with week/day computed from joined_at + date — the live API
  // doesn't always echo `week`/`day_in_week` on the per-member log feed.
  const decoratedLogs = useMemo(() => {
    if (!m) return logs;
    return logs.map((l) => {
      if (l.week && l.day_in_week) return l;
      const wd = weekDayForDate(m.joined_at, l.date);
      return {
        ...l,
        week: l.week || wd.week,
        day_in_week: l.day_in_week || wd.dayInWeek,
      };
    });
  }, [logs, m]);

  // Group logs by week (most recent week first), preserving newest-first order.
  const weekGroups = useMemo(() => {
    const map = new Map<number, AcpDailyLog[]>();
    for (const l of decoratedLogs) {
      const arr = map.get(l.week) ?? [];
      arr.push(l);
      map.set(l.week, arr);
    }
    return [...map.entries()].sort((a, b) => b[0] - a[0]);
  }, [decoratedLogs]);

  return (
    <Sheet open={memberId !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:w-[460px] sm:max-w-none"
      >
        <SheetTitle className="sr-only">
          {m?.name ?? "Member detail"}
        </SheetTitle>

        {/* Sticky header */}
        <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
            aria-label="Close"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
          </button>
          <Avatar className="h-9 w-9">
            <AvatarFallback className="text-xs">
              {getInitials(m?.name ?? "?")}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-semibold">
                {m?.name ?? "Loading…"}
              </span>
              {m ? (
                <span
                  className={cn(
                    "rounded px-1.5 py-0.5 text-[10px] font-semibold",
                    TAG_META[m.tag].badge,
                  )}
                >
                  {TAG_META[m.tag].label}
                </span>
              ) : null}
            </div>
            {m && repWeek ? (
              <div className="truncate text-xs text-zinc-500">
                Joined {m.joined_at.slice(0, 10)} · M{repWeek.month} W
                {repWeek.week} Day {repWeek.dayInWeek}
              </div>
            ) : null}
          </div>
          {m ? (
            <Select value={m.tag} onValueChange={(v) => handleTag(v as AcpTag)}>
              <SelectTrigger
                className="h-8 w-[124px] shrink-0 text-xs"
                disabled={tagging}
                aria-label="Change tag"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TAG_KEYS.map((key) => (
                  <SelectItem key={key} value={key} className="text-xs">
                    {TAG_META[key].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
        </div>

        {member.error ? (
          <div className="p-6 text-center text-sm text-rose-600 dark:text-rose-400">
            Couldn&apos;t load member: {errorMessage(member.error)}
          </div>
        ) : !m ? (
          <div className="space-y-3 p-4">
            <div className="h-20 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900" />
            <div className="h-40 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900" />
          </div>
        ) : (
          <div className="space-y-5 p-4">
            {/* Revenue stats */}
            <div className="grid grid-cols-3 gap-2">
              <MiniStat
                label="Sprint"
                value={acpFmt(m.sprint_revenue)}
                tone={
                  m.sprint_revenue >= 10000
                    ? "good"
                    : m.sprint_revenue > 0
                      ? "amber"
                      : "muted"
                }
              />
              <MiniStat
                label="Subs"
                value={acpFmt(m.subscription_revenue)}
                tone={m.subscription_revenue > 0 ? "good" : "muted"}
              />
              <MiniStat
                label="M1"
                value={`${m.month1_pct}%`}
                tone={
                  m.month1_pct >= 100
                    ? "good"
                    : m.month1_pct >= 50
                      ? "amber"
                      : "bad"
                }
              />
            </div>
            <div className="space-y-2.5">
              <ProgressBar
                label="M1 · sprint"
                pct={Math.round(
                  (m.sprint_revenue / (m.sprint_target || 10000)) * 100,
                )}
                caption={`${acpFmt(m.sprint_revenue)} of ${acpFmt(m.sprint_target || 10000)}`}
                active={repWeek?.month === 1}
              />
              <ProgressBar
                label="M2 · revenue"
                pct={Math.round(
                  (m.subscription_revenue / (m.revenue_target || 110000)) * 100,
                )}
                caption={`${acpFmt(m.subscription_revenue)} of ${acpFmt(m.revenue_target || 110000)}`}
                active={repWeek?.month === 2}
              />
            </div>

            {/* Message */}
            <div>
              <div className="mb-2 flex items-center gap-1.5">
                <MessageSquare
                  className="h-4 w-4 text-violet-500"
                  aria-hidden
                />
                <SectionLabel>Message</SectionLabel>
              </div>
              <div className="flex gap-2">
                <input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSend();
                  }}
                  placeholder="Type a message…"
                  className="h-9 flex-1 rounded-lg border border-zinc-200 bg-white px-3 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-ring dark:border-zinc-800 dark:bg-zinc-950"
                />
                <Button
                  type="button"
                  size="icon"
                  onClick={handleSend}
                  disabled={message.trim().length === 0 || sending}
                  variant={message.trim().length > 0 ? "default" : "secondary"}
                >
                  <Send className="h-4 w-4" aria-hidden />
                </Button>
              </div>
              {sent ? (
                <div className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
                  Sent!
                </div>
              ) : null}
            </div>

            {/* Hospitals consulted */}
            {consulted.length > 0 ? (
              <div>
                <div className="mb-2 flex items-center gap-1.5">
                  <Building2 className="h-4 w-4 text-amber-500" aria-hidden />
                  <SectionLabel>
                    Hospitals consulted ({consulted.length})
                  </SectionLabel>
                </div>
                <div className="divide-y divide-zinc-100 overflow-hidden rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
                  {consulted.map((h) => (
                    <HospitalRow
                      key={h.name}
                      name={h.name}
                      date={h.date}
                      green={h.sprinted}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            {/* Sprint accepted */}
            {accepted.length > 0 ? (
              <div>
                <div className="mb-2 flex items-center gap-1.5">
                  <Zap className="h-4 w-4 text-emerald-500" aria-hidden />
                  <SectionLabel>Sprint accepted ({accepted.length})</SectionLabel>
                </div>
                <div className="space-y-1.5">
                  {accepted.map((h) => (
                    <div
                      key={h.name}
                      className="flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2 text-sm dark:bg-emerald-950/20"
                    >
                      <span className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        {h.name}
                      </span>
                      <span className="text-xs text-zinc-500">
                        {h.date.slice(5)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Daily work log */}
            <div>
              <div className="mb-2 flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-violet-500" aria-hidden />
                <SectionLabel>Daily work log</SectionLabel>
              </div>

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
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

export function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "good" | "amber" | "bad" | "muted";
}) {
  const toneClass = {
    good: "text-emerald-600 dark:text-emerald-400",
    amber: "text-amber-600 dark:text-amber-400",
    bad: "text-rose-600 dark:text-rose-400",
    muted: "text-zinc-400",
  }[tone];
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">
        {label}
      </div>
      <div className={cn("mt-1 text-lg font-bold tabular-nums", toneClass)}>
        {value}
      </div>
    </div>
  );
}

/**
 * Labelled program-progress bar in the rep side panel. Shown twice — M1 (sprint
 * ₹ / ₹10K) and M2 (revenue / ₹1.1L) — so both months stay visible. `active`
 * tags the rep's current month; a completed bar (≥100%) turns emerald.
 */
function ProgressBar({
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
      <div className="flex items-center justify-between text-[11px] text-zinc-500">
        <span className="flex items-center gap-1.5 font-medium">
          {label}
          {active ? (
            <span className="rounded bg-violet-100 px-1 py-px text-[9px] font-semibold uppercase tracking-wide text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
              Now
            </span>
          ) : null}
        </span>
        <span className="tabular-nums">{pct}%</span>
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

export function HospitalRow({
  name,
  date,
  green,
}: {
  name: string;
  date: string;
  green: boolean;
}) {
  return (
    <div className="flex items-center justify-between px-3 py-2 text-sm">
      <span className="flex items-center gap-2">
        <span
          className={cn(
            "h-2 w-2 rounded-full",
            green ? "bg-emerald-500" : "bg-amber-500",
          )}
        />
        {name}
      </span>
      <span className="text-xs text-zinc-500">{date.slice(5)}</span>
    </div>
  );
}

/** Per-lead activity for one day: visited and/or sprint-accepted, with notes. */
interface LeadActivity {
  name: string;
  /** True when the rep started/accepted a sprint at this lead. */
  sprinted: boolean;
  /** Sentences from the day's note that name this lead. */
  notes: string[];
}

/**
 * Split a day's free-text note into sentences and attach each to the lead it
 * names, so each per-lead card can show what the rep actually did at that stop.
 * Sentences that don't name any lead are returned separately as a day-level note.
 */
function attributeNote(
  note: string,
  leads: string[],
): { byLead: Map<string, string[]>; general: string[] } {
  const byLead = new Map<string, string[]>();
  const general: string[] = [];
  const sentences =
    note.match(/[^.!?\n]+[.!?]*/g)?.map((s) => s.trim()).filter(Boolean) ?? [];
  for (const sentence of sentences) {
    const lower = sentence.toLowerCase();
    const owners = leads.filter((l) => l && lower.includes(l.toLowerCase()));
    if (owners.length === 0) {
      general.push(sentence);
      continue;
    }
    for (const owner of owners) {
      const arr = byLead.get(owner) ?? [];
      arr.push(sentence);
      byLead.set(owner, arr);
    }
  }
  return { byLead, general };
}

/**
 * Turn a daily log into one entry per lead (visited ∪ sprint-accepted), so the
 * admin sees each lead as its own card instead of three names lumped on one row.
 */
function buildLeadActivities(log: AcpDailyLog): {
  leads: LeadActivity[];
  generalNotes: string[];
} {
  const sprinted = new Set(log.sprint_accepted);
  // Union of visited + sprint-accepted leads, preserving first-seen order.
  const order: string[] = [];
  for (const name of [...log.visited, ...log.sprint_accepted]) {
    if (name && !order.includes(name)) order.push(name);
  }
  const { byLead, general } = attributeNote(log.note ?? "", order);
  const leads = order.map((name) => ({
    name,
    sprinted: sprinted.has(name),
    notes: byLead.get(name) ?? [],
  }));
  return { leads, generalNotes: general };
}

export function DayLogCard({
  log,
  onReview,
}: {
  log: AcpDailyLog;
  onReview: (value: AcpReview) => void;
}) {
  const activity = ACTIVITY_META[log.activity_type];
  const review = log.admin_review ? REVIEW_META[log.admin_review] : null;
  const isToday = log.date === TODAY;
  const { leads, generalNotes } = buildLeadActivities(log);
  // With per-lead cards, the day note shows only sentences not tied to a lead.
  // On days with no leads (e.g. a training day) the note is the whole story.
  const dayNote = leads.length > 0 ? generalNotes.join(" ") : log.note;

  return (
    <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold">Day {log.day_in_week}</span>
          <span className="text-xs text-zinc-500">{log.date}</span>
          {isToday ? (
            <span className="rounded bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold text-violet-600 dark:bg-violet-950/40 dark:text-violet-300">
              Today
            </span>
          ) : null}
          {review ? (
            <span
              className={cn(
                "rounded px-1.5 py-0.5 text-[10px] font-semibold",
                review.badge,
              )}
            >
              {review.label}
            </span>
          ) : null}
        </div>
        <span
          className={cn(
            "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold",
            activity.badge,
          )}
        >
          {activity.label}
        </span>
      </div>

      {dayNote ? (
        <p className="mt-1.5 text-sm text-zinc-700 dark:text-zinc-200">
          {dayNote}
        </p>
      ) : null}

      {/* One card per lead so the admin can tell each visit/sprint apart. */}
      {leads.length > 0 ? (
        <div className="mt-2 space-y-1.5">
          {leads.map((lead) => (
            <div
              key={lead.name}
              className={cn(
                "rounded-md border px-2.5 py-2",
                lead.sprinted
                  ? "border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/50 dark:bg-emerald-950/20"
                  : "border-zinc-200 bg-zinc-50/70 dark:border-zinc-800 dark:bg-zinc-900/40",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5 text-sm font-medium">
                  {lead.sprinted ? (
                    <Zap
                      className="h-3.5 w-3.5 shrink-0 text-emerald-500"
                      aria-hidden
                    />
                  ) : (
                    <MapPin
                      className="h-3.5 w-3.5 shrink-0 text-amber-500"
                      aria-hidden
                    />
                  )}
                  <span className="truncate">{lead.name}</span>
                </span>
                <span
                  className={cn(
                    "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold",
                    lead.sprinted
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                      : "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
                  )}
                >
                  {lead.sprinted ? "Sprint accepted" : "Visited"}
                </span>
              </div>
              {lead.notes.length > 0 ? (
                <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                  {lead.notes.join(" ")}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {log.sprint_revenue && log.sprint_revenue > 0 ? (
        <p className="mt-2 flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
          <TrendingUp className="h-3 w-3" aria-hidden />
          <span>
            <span className="font-medium">
              {leads.length > 1 ? "Day total:" : "Sprint revenue:"}
            </span>{" "}
            <span className="tabular-nums">{acpFmt(log.sprint_revenue)}</span>
          </span>
        </p>
      ) : null}

      {log.audio_url || log.audio_filename ? (
        <AudioBar
          url={log.audio_url ?? null}
          filename={log.audio_filename ?? "Pitch recording"}
          duration={log.audio_duration ?? null}
        />
      ) : null}

      {/* Admin review dropdown — present on every day */}
      <div className="mt-3">
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
          Admin review
        </div>
        <Select
          value={log.admin_review ?? undefined}
          onValueChange={(v) => onReview(v as AcpReview)}
        >
          <SelectTrigger className="h-8">
            <SelectValue placeholder="Set review…">
              {log.admin_review ? (
                <span className="flex items-center gap-2">
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full",
                      REVIEW_META[log.admin_review].dot,
                    )}
                  />
                  {REVIEW_META[log.admin_review].label}
                </span>
              ) : null}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {REVIEW_KEYS.map((key) => {
              const meta = REVIEW_META[key];
              const Icon = meta.icon;
              return (
                <SelectItem key={key} value={key}>
                  <span className="flex items-center gap-2">
                    <Icon className={cn("h-3.5 w-3.5", meta.text)} aria-hidden />
                    {meta.label}
                  </span>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function fmtClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function AudioBar({
  url,
  filename,
  duration,
}: {
  url: string | null;
  filename: string;
  duration: string | null;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  // Total length in seconds, read off the element once metadata loads. The
  // `duration` prop is only a display string ("m:ss"), so we still need the
  // numeric length to drive the seek slider's range and the skip clamps.
  const [total, setTotal] = useState(0);

  const toggle = () => {
    if (!url) {
      toast.message("Recording unavailable", {
        description: "No recording was uploaded for this day.",
      });
      return;
    }
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
      setPlaying(false);
    } else {
      void el.play();
      setPlaying(true);
    }
  };

  // Jump to an absolute position (clamped), used by both the slider and the
  // ±10s skip buttons so the rep/admin can scrub anywhere in the recording.
  const seekTo = (seconds: number) => {
    const el = audioRef.current;
    if (!el || !Number.isFinite(seconds)) return;
    const next = Math.min(Math.max(seconds, 0), total || el.duration || 0);
    el.currentTime = next;
    setCurrent(next);
  };

  const totalLabel = total > 0 ? fmtClock(total) : duration ?? "—";
  const seekDisabled = !url || total <= 0;

  return (
    <div className="mt-2 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-2 dark:border-zinc-800 dark:bg-zinc-900/60">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={toggle}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-600 transition-colors hover:bg-violet-200 dark:bg-violet-950/40 dark:text-violet-300"
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? (
            <Pause className="h-4 w-4" aria-hidden />
          ) : (
            <Play className="h-4 w-4" aria-hidden />
          )}
        </button>
        <Volume2 className="h-3.5 w-3.5 shrink-0 text-zinc-400" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-xs text-zinc-500">
          {filename}
        </span>
        <span className="shrink-0 text-[11px] tabular-nums text-zinc-400">
          {fmtClock(current)} / {totalLabel}
        </span>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={() => seekTo(current - 10)}
          disabled={seekDisabled}
          aria-label="Back 10 seconds"
          className="shrink-0 text-zinc-400 transition-colors hover:text-violet-600 disabled:opacity-40 dark:hover:text-violet-300"
        >
          <Rewind className="h-3.5 w-3.5" aria-hidden />
        </button>
        <input
          type="range"
          min={0}
          max={total || 0}
          step="any"
          value={Math.min(current, total || 0)}
          onChange={(e) => seekTo(Number(e.target.value))}
          disabled={seekDisabled}
          aria-label="Seek"
          className="h-1.5 flex-1 cursor-pointer accent-violet-500 disabled:cursor-default disabled:opacity-50"
        />
        <button
          type="button"
          onClick={() => seekTo(current + 10)}
          disabled={seekDisabled}
          aria-label="Forward 10 seconds"
          className="shrink-0 text-zinc-400 transition-colors hover:text-violet-600 disabled:opacity-40 dark:hover:text-violet-300"
        >
          <FastForward className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>

      {url ? (
        <audio
          ref={audioRef}
          src={url}
          preload="metadata"
          onLoadedMetadata={(e) => setTotal(e.currentTarget.duration || 0)}
          onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
          onEnded={() => {
            setPlaying(false);
            setCurrent(0);
          }}
          className="hidden"
        />
      ) : null}
    </div>
  );
}
