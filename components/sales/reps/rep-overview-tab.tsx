"use client";

import { useMemo } from "react";
import {
  Briefcase,
  CheckCircle2,
  Footprints,
  Trophy,
  Users,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format-metric";
import { useLeads } from "@/lib/hooks/use-leads";
import { useUserScorecard } from "@/lib/hooks/use-scorecard";
import { useUserDistanceHistory } from "@/lib/hooks/use-distance";
import type { ApiSubadmin } from "@/lib/api/types";
import { cn } from "@/lib/utils";

import { RepProfileSection } from "./rep-profile-section";

interface RepOverviewTabProps {
  member: ApiSubadmin;
  repId: string;
  onMutated: () => void;
  onDeleted: () => void;
}

/**
 * Overview tab — performance KPIs, target progress, distance traveled, then
 * the editable profile. Mirrors the rep's own app overview but admin-scoped.
 */
export function RepOverviewTab({
  member,
  repId,
  onMutated,
  onDeleted,
}: RepOverviewTabProps) {
  const leadsQuery = useLeads({ sales_user_id: repId, limit: 500 });
  const scorecard = useUserScorecard(repId);
  const distance = useUserDistanceHistory(repId, 7);

  const perf = useMemo(() => {
    const leads = leadsQuery.data?.leads ?? [];
    let closed = 0;
    let pipeline = 0;
    for (const l of leads) {
      if (l.subscription_closed_at) closed += 1;
      else if (!l.lost_reason) pipeline += l.estimated_value || 0;
    }
    return { added: leads.length, closed, pipeline };
  }, [leadsQuery.data]);

  const score = scorecard.data?.summary.total_weighted_score ?? null;

  const distTotalKm = useMemo(() => {
    const days = distance.data?.history ?? [];
    return days.reduce((n, d) => n + (d.km || 0), 0);
  }, [distance.data]);
  const distToday = useMemo(() => {
    const days = distance.data?.history ?? [];
    return days[days.length - 1];
  }, [distance.data]);

  const completionPct =
    member.target_hospitals > 0
      ? Math.min(
          100,
          Math.round((member.hospitals_done / member.target_hospitals) * 100),
        )
      : 0;

  return (
    <div className="space-y-6">
      {/* Performance */}
      <Section title="Performance">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi
            icon={Users}
            label="Leads added"
            value={String(perf.added)}
            loading={leadsQuery.isLoading && !leadsQuery.data}
          />
          <Kpi
            icon={CheckCircle2}
            label="Closed"
            value={String(perf.closed)}
            tone="good"
            loading={leadsQuery.isLoading && !leadsQuery.data}
          />
          <Kpi
            icon={Trophy}
            label="Score"
            value={score === null ? "—" : score.toFixed(0)}
            tone="amber"
            loading={scorecard.isLoading && !scorecard.data}
          />
          <Kpi
            icon={Briefcase}
            label="Pipeline"
            value={formatCurrency(perf.pipeline, "INR")}
            loading={leadsQuery.isLoading && !leadsQuery.data}
          />
        </div>
      </Section>

      {/* Target progress */}
      <Section title="Target progress">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              {member.target_period.toLowerCase()}
            </span>
            <span
              className={cn(
                "h-1.5 w-10 rounded-full",
                completionPct >= 100
                  ? "bg-emerald-500"
                  : completionPct > 0
                    ? "bg-amber-500"
                    : "bg-rose-500",
              )}
            />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold tabular-nums">
              {member.hospitals_done}
            </span>
            <span className="text-sm text-zinc-500">
              / {member.target_hospitals || "—"} hospitals
            </span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
            <div
              className="h-full rounded-full bg-violet-500"
              style={{ width: `${completionPct}%` }}
            />
          </div>
          <div className="mt-1 text-[11px] text-zinc-500">
            {completionPct}% to target · {member.hospitals_added} added this period
          </div>
        </Card>
      </Section>

      {/* Distance traveled */}
      <Section title="Distance traveled">
        <Card className="flex items-center gap-4 p-4">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
            <Footprints className="h-5 w-5" aria-hidden />
          </div>
          <div className="flex-1">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Last 7 days
            </div>
            <div className="mt-0.5 flex items-baseline gap-2">
              <span className="text-2xl font-bold tabular-nums">
                {distance.isLoading && !distance.data
                  ? "—"
                  : `${distTotalKm.toFixed(1)} km`}
              </span>
              <span className="text-xs text-zinc-500">
                {distToday
                  ? `${distToday.km.toFixed(1)} km today · ${distToday.sessions} session${distToday.sessions === 1 ? "" : "s"}`
                  : "no sessions today"}
              </span>
            </div>
          </div>
        </Card>
      </Section>

      {/* Profile (editable) */}
      <Section title="Profile">
        <RepProfileSection
          member={member}
          onMutated={onMutated}
          onDeleted={onDeleted}
        />
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
        {title}
      </h3>
      {children}
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  tone = "neutral",
  loading,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  tone?: "neutral" | "good" | "amber";
  loading?: boolean;
}) {
  const toneCls = {
    neutral: "text-zinc-900 dark:text-zinc-50",
    good: "text-emerald-600 dark:text-emerald-400",
    amber: "text-amber-600 dark:text-amber-400",
  }[tone];
  return (
    <Card className="p-4">
      <Icon className="h-4 w-4 text-zinc-400" aria-hidden />
      <div
        className={cn(
          "mt-2 text-xl font-bold tabular-nums",
          loading ? "animate-pulse text-zinc-300 dark:text-zinc-700" : toneCls,
        )}
      >
        {loading ? "—" : value}
      </div>
      <div className="mt-1 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
        {label}
      </div>
    </Card>
  );
}
