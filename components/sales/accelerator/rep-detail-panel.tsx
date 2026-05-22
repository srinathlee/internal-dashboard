"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Building2,
  Clock,
  MapPin,
  MessageSquare,
  Pause,
  Play,
  Send,
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
            <div>
              <div className="h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                <div
                  className="h-full rounded-full bg-amber-400"
                  style={{
                    width: `${Math.min(100, (m.sprint_revenue / (m.sprint_target || 10000)) * 100)}%`,
                  }}
                />
              </div>
              <div className="mt-1 text-[11px] text-zinc-500">
                {acpFmt(m.sprint_revenue)} of {acpFmt(m.sprint_target || 10000)}{" "}
                Month 1
              </div>
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

function MiniStat({
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

function HospitalRow({
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

function DayLogCard({
  log,
  onReview,
}: {
  log: AcpDailyLog;
  onReview: (value: AcpReview) => void;
}) {
  const activity = ACTIVITY_META[log.activity_type];
  const review = log.admin_review ? REVIEW_META[log.admin_review] : null;
  const isToday = log.date === TODAY;

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

      {log.note ? (
        <p className="mt-1.5 text-sm text-zinc-700 dark:text-zinc-200">
          {log.note}
        </p>
      ) : null}

      {log.visited.length > 0 ? (
        <p className="mt-1 flex items-center gap-1 text-xs text-zinc-500">
          <MapPin className="h-3 w-3" aria-hidden />
          <span>
            <span className="font-medium text-zinc-600 dark:text-zinc-300">
              Visited:
            </span>{" "}
            {log.visited.join(", ")}
          </span>
        </p>
      ) : null}

      {log.sprint_accepted.length > 0 ? (
        <p className="mt-1 flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
          <Zap className="h-3 w-3" aria-hidden />
          <span>
            <span className="font-medium">Sprint accepted:</span>{" "}
            {log.sprint_accepted.join(", ")}
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

function AudioBar({
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
  const [progress, setProgress] = useState(0);
  // Prefer the server-supplied duration; otherwise read it off the element
  // once the presigned recording loads its metadata.
  const [shownDuration, setShownDuration] = useState(duration ?? "—");

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

  return (
    <div className="mt-2 flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1.5 dark:border-zinc-800 dark:bg-zinc-900/60">
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
      <div className="hidden h-1 w-16 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700 sm:block">
        <div
          className="h-full rounded-full bg-violet-500"
          style={{ width: `${progress}%` }}
        />
      </div>
      <span className="shrink-0 text-[11px] tabular-nums text-zinc-400">
        {shownDuration}
      </span>
      {url ? (
        <audio
          ref={audioRef}
          src={url}
          preload="metadata"
          onLoadedMetadata={(e) => {
            if (!duration) setShownDuration(fmtClock(e.currentTarget.duration));
          }}
          onTimeUpdate={(e) => {
            const el = e.currentTarget;
            if (el.duration) setProgress((el.currentTime / el.duration) * 100);
          }}
          onEnded={() => {
            setPlaying(false);
            setProgress(0);
          }}
          className="hidden"
        />
      ) : null}
    </div>
  );
}
