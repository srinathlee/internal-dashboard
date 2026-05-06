"use client";

import { useMemo, useState } from "react";
import { Check, Pencil, X } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/layout/page-header";
import { useAuth } from "@/lib/auth";
import { isSalesAdminOrSuperAdmin } from "@/lib/access";
import { formatMetric } from "@/lib/format-metric";
import { getInitials } from "@/lib/format";
import {
  getTeam,
  getTeamMembers,
  targets as seedTargets,
} from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import type { MetricDefinition, Target, User } from "@/lib/types";

/**
 * Metric management — sales-admin / super-admin surface for inspecting
 * the team's metric definitions and tuning per-rep monthly targets.
 *
 * v1 scope: display the four sales metrics with their unit / aggregation /
 * direction; render an editable targets matrix (rep × metric). Edits live
 * in local state and emit a toast on save — there's no backend yet, so
 * navigating away discards changes (same trade-off as the rest of the
 * Phase-5 admin surfaces).
 */
export function MetricManagementScreen() {
  const auth = useAuth();
  const [targets, setTargets] = useState<Target[]>(seedTargets);
  const [editingCell, setEditingCell] = useState<{
    userId: string;
    key: string;
  } | null>(null);
  const [draft, setDraft] = useState<string>("");

  if (!auth.isLoaded) return <Skeleton />;

  if (!isSalesAdminOrSuperAdmin(auth)) {
    return (
      <div className="space-y-6">
        <PageHeader title="Metric management" />
        <Card className="p-12 text-center text-sm text-zinc-500">
          You don't have permission to manage sales metrics.
        </Card>
      </div>
    );
  }

  const team = getTeam("sales");
  const members = getTeamMembers("sales").filter((u) => u.role === "member");

  const targetsByUser = useMemo(() => {
    const map = new Map<string, Target>();
    for (const t of targets) {
      if (t.teamId === "sales") map.set(t.userId, t);
    }
    return map;
  }, [targets]);

  const startEdit = (userId: string, key: string, current: number) => {
    setEditingCell({ userId, key });
    setDraft(String(current));
  };

  const cancelEdit = () => {
    setEditingCell(null);
    setDraft("");
  };

  const commitEdit = () => {
    if (!editingCell) return;
    const next = Number(draft);
    if (!Number.isFinite(next) || next < 0) {
      toast.error("Enter a non-negative number.");
      return;
    }
    setTargets((prev) =>
      prev.map((t) =>
        t.userId === editingCell.userId && t.teamId === "sales"
          ? { ...t, values: { ...t.values, [editingCell.key]: next } }
          : t,
      ),
    );
    const member = members.find((m) => m.id === editingCell.userId);
    const metric = team.metrics.find((m) => m.key === editingCell.key);
    toast.success(
      `Target updated${member ? ` — ${member.name.split(" ")[0]}` : ""}${metric ? ` · ${metric.label}` : ""}`,
    );
    cancelEdit();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Metric management"
        description="Inspect sales metric definitions and tune monthly targets per rep."
      />

      <section className="space-y-3">
        <SectionHeader
          title="Metric definitions"
          subtitle="Four metrics drive every Sales KPI card and leaderboard."
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {team.metrics.map((metric) => (
            <MetricDefinitionCard key={metric.key} metric={metric} />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <SectionHeader
          title="Monthly targets"
          subtitle="Click a value to edit. Changes are local — no backend in v1."
        />
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50/60 dark:border-zinc-800 dark:bg-zinc-900/40">
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Rep
                  </th>
                  {team.metrics.map((m) => (
                    <th
                      key={m.key}
                      className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-zinc-500"
                    >
                      {m.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {members.length === 0 ? (
                  <tr>
                    <td
                      colSpan={1 + team.metrics.length}
                      className="px-4 py-12 text-center text-sm text-zinc-500"
                    >
                      No sales reps yet.
                    </td>
                  </tr>
                ) : (
                  members.map((member) => {
                    const target = targetsByUser.get(member.id);
                    return (
                      <tr
                        key={member.id}
                        className="border-b border-zinc-100 last:border-b-0 dark:border-zinc-800"
                      >
                        <td className="px-4 py-3">
                          <RepCell user={member} />
                        </td>
                        {team.metrics.map((metric) => {
                          const isEditing =
                            editingCell?.userId === member.id &&
                            editingCell.key === metric.key;
                          const value = target?.values[metric.key] ?? 0;
                          return (
                            <td
                              key={metric.key}
                              className="px-4 py-3 text-right tabular-nums"
                            >
                              {isEditing ? (
                                <EditCell
                                  draft={draft}
                                  onDraftChange={setDraft}
                                  onCommit={commitEdit}
                                  onCancel={cancelEdit}
                                />
                              ) : (
                                <button
                                  type="button"
                                  onClick={() =>
                                    startEdit(member.id, metric.key, value)
                                  }
                                  className="group inline-flex items-center gap-2 rounded-md px-1.5 py-0.5 hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-zinc-800"
                                >
                                  <span>{formatMetric(value, metric)}</span>
                                  <Pencil
                                    aria-hidden
                                    className="h-3 w-3 text-zinc-300 transition-colors group-hover:text-zinc-500"
                                  />
                                </button>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </section>
    </div>
  );
}

function MetricDefinitionCard({ metric }: { metric: MetricDefinition }) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
            {metric.label}
          </div>
          <div className="mt-0.5 font-mono text-[10px] text-zinc-400">
            {metric.key}
          </div>
        </div>
        <span
          className={cn(
            "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
            metric.betterWhen === "higher"
              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
              : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
          )}
        >
          {metric.betterWhen === "higher" ? "↑ higher" : "↓ lower"}
        </span>
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-1 text-[11px]">
        <DefField label="Unit" value={metric.unit} />
        <DefField label="Format" value={metric.format} />
        <DefField label="Aggregation" value={metric.aggregation} />
      </dl>
    </Card>
  );
}

function DefField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[9px] uppercase tracking-wide text-zinc-400">
        {label}
      </dt>
      <dd className="mt-0.5 capitalize text-zinc-700 dark:text-zinc-300">
        {value}
      </dd>
    </div>
  );
}

function RepCell({ user }: { user: User }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <Avatar className="h-8 w-8">
        <AvatarFallback className="text-xs">
          {getInitials(user.name)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <div className="truncate font-medium text-zinc-900 dark:text-zinc-50">
          {user.name}
        </div>
        <div className="truncate text-xs text-zinc-500">{user.email}</div>
      </div>
    </div>
  );
}

function EditCell({
  draft,
  onDraftChange,
  onCommit,
  onCancel,
}: {
  draft: string;
  onDraftChange: (v: string) => void;
  onCommit: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="inline-flex items-center justify-end gap-1">
      <Input
        autoFocus
        type="number"
        min={0}
        value={draft}
        onChange={(e) => onDraftChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onCommit();
          if (e.key === "Escape") onCancel();
        }}
        className="h-7 w-28 text-right tabular-nums"
      />
      <button
        type="button"
        onClick={onCommit}
        aria-label="Save"
        className="grid h-7 w-7 place-items-center rounded-md border border-zinc-200 text-zinc-600 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-zinc-800 dark:hover:bg-zinc-900"
      >
        <Check className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={onCancel}
        aria-label="Cancel"
        className="grid h-7 w-7 place-items-center rounded-md border border-zinc-200 text-zinc-600 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-zinc-800 dark:hover:bg-zinc-900"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function SectionHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div>
      <h2 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-0.5 text-xs text-zinc-500">{subtitle}</p>
      )}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-7 w-48 animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-800" />
        <div className="h-4 w-72 animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-800" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="h-28 animate-pulse" />
        ))}
      </div>
      <Card className="h-72 animate-pulse" />
    </div>
  );
}
