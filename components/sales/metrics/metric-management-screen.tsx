"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Coins,
  Edit2,
  History,
  Loader2,
  Plus,
  RefreshCw,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  TestTube,
  Trash2,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/layout/page-header";
import { useAuth } from "@/lib/auth";
import { isSalesAdminOrSuperAdmin } from "@/lib/access";
import { errorMessage } from "@/lib/hooks/use-async";
import { useLeadPeople } from "@/lib/hooks/use-leads";
import {
  useScorecardConfig,
  useScorecardMutations,
} from "@/lib/hooks/use-scorecard";
import { useManualPoints } from "@/lib/hooks/use-manual-points";
import {
  useScoringRuleMutations,
  useScoringRuleSets,
} from "@/lib/hooks/use-scoring-rules";
import { useTargets, useTargetMutations } from "@/lib/hooks/use-targets";
import { formatNumber } from "@/lib/format-metric";
import { cn } from "@/lib/utils";
import type { ScorecardConfigMetric, ScoringRuleSet } from "@/lib/api/types";

type ManagementTab = "setup" | "manual";

// ---------- Top-level screen ----------

export function MetricManagementScreen() {
  const auth = useAuth();
  const [tab, setTab] = useState<ManagementTab>("setup");

  if (!auth.isLoaded) return <Skeleton />;
  if (!isSalesAdminOrSuperAdmin(auth)) {
    return (
      <div className="space-y-6">
        <PageHeader title="Metric management" />
        <Card className="p-12 text-center text-sm text-zinc-500">
          You don't have permission to manage scoring rules.
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Metric management"
        description="Configure scoring rules and award manual points."
      />

      <TabBar value={tab} onChange={setTab} />

      {tab === "setup" ? <SetupTab /> : <ManualPointsTab />}
    </div>
  );
}

// ---------- Tab bar ----------

function TabBar({
  value,
  onChange,
}: {
  value: ManagementTab;
  onChange: (next: ManagementTab) => void;
}) {
  const tabs: { id: ManagementTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "setup", label: "Metrics & setup", icon: Wand2 },
    { id: "manual", label: "Manual points", icon: Coins },
  ];
  return (
    <div className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white p-1 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      {tabs.map((t) => {
        const Icon = t.icon;
        const active = t.id === value;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            aria-pressed={active}
            className={cn(
              "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
                : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50",
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

// =================================================================
// SETUP TAB
// =================================================================

function SetupTab() {
  const config = useScorecardConfig({ include_inactive: true, include_user_targets: true });
  const { updateConfig } = useScorecardMutations();
  const [working, setWorking] = useState<ScorecardConfigMetric[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<ScorecardConfigMetric | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [creatingNew, setCreatingNew] = useState(false);

  // Re-seed local "working" copy whenever the canonical config changes, so
  // toggles + edits don't get blown away on refetch but a hard refresh
  // resets to the server's current truth.
  useEffect(() => {
    if (config.data) setWorking(config.data.metrics);
  }, [config.data]);

  if (config.error) {
    return (
      <Card className="border-rose-200 bg-rose-50 p-6 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-300">
        Couldn't load scoring config: {errorMessage(config.error)}
      </Card>
    );
  }
  if (!config.data || !working) {
    return <SetupSkeleton />;
  }

  const handleSave = async () => {
    if (!working) return;
    setSaving(true);
    try {
      await updateConfig({
        metrics: working.map((m) => {
          const def = m.targets.find((t) => t.is_default);
          return {
            key: m.key,
            label: m.label,
            unit: m.unit,
            is_active: m.is_active,
            display_order: m.display_order,
            rule: {
              points_per_unit: m.rule.points_per_unit,
              cap_per_period: m.rule.cap_per_period,
              bonus_points: m.rule.bonus_points,
              bonus_on_target_pct: m.rule.bonus_on_target_pct,
              weight_pct: m.rule.weight_pct,
              min_floor: m.rule.min_floor,
              stretch_target: m.rule.stretch_target,
            },
            ...(def
              ? {
                  target: {
                    target_value: def.target_value,
                    period_type: def.period_type as
                      | "MONTHLY"
                      | "QUARTERLY"
                      | "HALF_YEARLY"
                      | "YEARLY",
                    is_default: true,
                  },
                }
              : {}),
          };
        }),
      });
      toast.success("Configuration saved");
      void config.refetch();
    } catch (err) {
      toast.error("Couldn't save configuration", {
        description: errorMessage(err),
      });
    } finally {
      setSaving(false);
    }
  };

  const updateMetric = (key: string, patch: Partial<ScorecardConfigMetric>) => {
    setWorking((arr) =>
      arr ? arr.map((m) => (m.key === key ? { ...m, ...patch } : m)) : arr,
    );
  };

  const updateMetricRule = (
    key: string,
    rulePatch: Partial<ScorecardConfigMetric["rule"]>,
  ) => {
    setWorking((arr) =>
      arr
        ? arr.map((m) =>
            m.key === key ? { ...m, rule: { ...m.rule, ...rulePatch } } : m,
          )
        : arr,
    );
  };

  const updateMetricTarget = (key: string, targetValue: number) => {
    setWorking((arr) =>
      arr
        ? arr.map((m) => {
            if (m.key !== key) return m;
            const targets = m.targets.length > 0
              ? m.targets.map((t) =>
                  t.is_default ? { ...t, target_value: targetValue } : t,
                )
              : [
                  {
                    id: `new-${m.key}`,
                    user_id: null,
                    target_value: targetValue,
                    period_type: "MONTHLY",
                    is_default: true,
                  },
                ];
            return { ...m, targets };
          })
        : arr,
    );
  };

  const removeMetric = (key: string) => {
    setWorking((arr) => (arr ? arr.filter((m) => m.key !== key) : arr));
  };

  const addNewMetric = (m: ScorecardConfigMetric) => {
    setWorking((arr) => (arr ? [...arr, m] : arr));
  };

  return (
    <div className="space-y-4">
      <RuleSetHeaderCard
        version={config.data.rule_set_version}
        generatedAt={config.data.generated_at}
        metrics={config.data.metrics}
        onRestored={() => void config.refetch()}
      />

      <WeightDistributionCard metrics={working} />

      <SaveRuleSetCard
        version={config.data.rule_set_version}
        onSave={handleSave}
        onRefresh={() => {
          void config.refetch();
          toast("Reloaded from server");
        }}
        saving={saving}
      />

      <MetricsTableCard
        metrics={working}
        onToggleActive={(key, next) => updateMetric(key, { is_active: next })}
        onEdit={(m) => {
          setEditing(m);
          setEditorOpen(true);
        }}
        onDelete={removeMetric}
        onAddNew={() => setCreatingNew(true)}
      />

      <CustomTargetsCard config={config.data} onChanged={() => config.refetch()} />

      <MetricEditorDialog
        open={editorOpen}
        metric={editing}
        onOpenChange={(next) => {
          setEditorOpen(next);
          if (!next) setEditing(null);
        }}
        onSave={(patch) => {
          if (!editing) return;
          updateMetric(editing.key, {
            label: patch.label,
            display_order: patch.display_order,
          });
          updateMetricRule(editing.key, {
            points_per_unit: patch.points_per_unit,
            weight_pct: patch.weight_pct,
            bonus_points: patch.bonus_points,
          });
          updateMetricTarget(editing.key, patch.target_value);
          setEditorOpen(false);
          setEditing(null);
          toast.success("Metric updated locally — click Save to publish");
        }}
      />

      <NewMetricDialog
        open={creatingNew}
        onOpenChange={setCreatingNew}
        existingKeys={working.map((m) => m.key)}
        onCreate={(m) => {
          addNewMetric(m);
          setCreatingNew(false);
          toast.success("Metric added locally — click Save to publish");
        }}
        nextOrder={(working.at(-1)?.display_order ?? 0) + 10}
      />
    </div>
  );
}

// ---------- Rule set header ----------

function RuleSetHeaderCard({
  version,
  generatedAt,
  metrics,
  onRestored,
}: {
  version: number;
  generatedAt: string;
  metrics: ScorecardConfigMetric[];
  onRestored: () => void;
}) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const date = generatedAt
    ? new Date(generatedAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;
  return (
    <Card className="flex flex-wrap items-center gap-3 p-4 sm:p-5">
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Rule set
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            LIVE
          </span>
        </div>
        <div className="text-2xl font-semibold tracking-tight">
          Version {version}
        </div>
        <div className="text-xs text-zinc-500">
          {date ? `Generated ${date}` : "Applied date unavailable"}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setHistoryOpen(true)}
        >
          <History className="h-3.5 w-3.5" />
          History
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => toast("Test rule changes — coming soon")}
        >
          <TestTube className="h-3.5 w-3.5" />
          Test rule changes
        </Button>
      </div>

      <RuleSetHistoryDialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        currentMetrics={metrics}
        onRestored={() => {
          setHistoryOpen(false);
          onRestored();
        }}
      />
    </Card>
  );
}

// ---------- Rule set history dialog ----------

function RuleSetHistoryDialog({
  open,
  onOpenChange,
  currentMetrics,
  onRestored,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  currentMetrics: ScorecardConfigMetric[];
  onRestored: () => void;
}) {
  const ruleSets = useScoringRuleSets();
  const { restore } = useScoringRuleMutations();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [restoring, setRestoring] = useState<string | null>(null);

  // metric_id → label, so historical rules read as names instead of UUIDs.
  const metricLabels = useMemo(() => {
    const m = new Map<string, { label: string; key: string }>();
    for (const x of currentMetrics) m.set(x.id, { label: x.label, key: x.key });
    return m;
  }, [currentMetrics]);

  useEffect(() => {
    if (open) void ruleSets.refetch();
    if (!open) setExpanded(null);
    // Refetch only when dialog opens, not whenever ruleSets identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Newest first. We sort primarily by each version's true applied time
  // (derived from its rules' earliest `effective_from`) and tiebreak on the
  // version number — `appliedAt` alone can't be trusted because the backend
  // updates it across all versions whenever any single version is touched.
  const sorted = useMemo(
    () =>
      ruleSets.data
        ? [...ruleSets.data].sort((a, b) => {
            const ad = deriveAppliedAt(a) ?? "";
            const bd = deriveAppliedAt(b) ?? "";
            if (ad !== bd) return bd.localeCompare(ad);
            return b.version - a.version;
          })
        : [],
    [ruleSets.data],
  );

  const handleRestore = async (rs: ScoringRuleSet) => {
    if (rs.isLive) return;
    setRestoring(rs.id);
    try {
      await restore(rs.id);
      toast.success(`Restored to version ${rs.version}`);
      onRestored();
    } catch (err) {
      toast.error("Couldn't restore version", {
        description: errorMessage(err),
      });
    } finally {
      setRestoring(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-4 w-4 text-zinc-500" aria-hidden />
            Rule set history
          </DialogTitle>
          <DialogDescription>
            Every published rule set, newest first. Expand a row to see the
            metric weights and points for that version.
          </DialogDescription>
        </DialogHeader>

        <div className="-mx-6 max-h-[60vh] overflow-y-auto px-6">
          {ruleSets.error ? (
            <div className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-300">
              Couldn't load history: {errorMessage(ruleSets.error)}
            </div>
          ) : ruleSets.isLoading && sorted.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-sm text-zinc-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading
              versions…
            </div>
          ) : sorted.length === 0 ? (
            <div className="py-12 text-center text-sm text-zinc-500">
              No published rule sets yet.
            </div>
          ) : (
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {sorted.map((rs) => (
                <RuleSetHistoryRow
                  key={rs.id}
                  ruleSet={rs}
                  expanded={expanded === rs.id}
                  onToggle={() =>
                    setExpanded((cur) => (cur === rs.id ? null : rs.id))
                  }
                  onRestore={() => handleRestore(rs)}
                  restoring={restoring === rs.id}
                  metricLabels={metricLabels}
                />
              ))}
            </ul>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RuleSetHistoryRow({
  ruleSet,
  expanded,
  onToggle,
  onRestore,
  restoring,
  metricLabels,
}: {
  ruleSet: ScoringRuleSet;
  expanded: boolean;
  onToggle: () => void;
  onRestore: () => void;
  restoring: boolean;
  metricLabels: Map<string, { label: string; key: string }>;
}) {
  const totalWeight = ruleSet.rules.reduce(
    (s, r) => s + (r.weight_pct ?? 0),
    0,
  );
  // The backend bumps `appliedAt` whenever any version is touched (e.g.
  // closing an older version's effective window when a new one publishes),
  // which makes the oldest version look the most recently applied. Derive
  // a stable "applied" timestamp from the rules' own `effective_from`
  // instead — those values don't shift around.
  const derivedApplied = deriveAppliedAt(ruleSet);
  const applied = derivedApplied
    ? new Date(derivedApplied).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "—";

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className="inline-flex h-6 w-6 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        >
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          )}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold tabular-nums">
              Version {ruleSet.version}
            </span>
            {ruleSet.isLive ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                <CheckCircle2 className="h-3 w-3" aria-hidden />
                LIVE
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                Archived
              </span>
            )}
            {ruleSet.restoredFrom != null ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                <RotateCcw className="h-3 w-3" aria-hidden />
                Restored from v{ruleSet.restoredFrom}
              </span>
            ) : null}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
            <span>Applied {applied}</span>
            <span aria-hidden>·</span>
            <span>
              {ruleSet.rules.length} metric
              {ruleSet.rules.length === 1 ? "" : "s"}
            </span>
            <span aria-hidden>·</span>
            <span>Total weight {totalWeight.toFixed(1)}%</span>
          </div>
        </div>

        {!ruleSet.isLive ? (
          <Button
            variant="outline"
            size="sm"
            onClick={onRestore}
            disabled={restoring}
          >
            {restoring ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RotateCcw className="h-3.5 w-3.5" />
            )}
            Restore
          </Button>
        ) : null}
      </div>

      {expanded ? (
        <div className="mt-3 ml-9 overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-xs">
            <thead className="bg-zinc-50/60 text-[10px] uppercase tracking-wider text-zinc-500 dark:bg-zinc-900/60">
              <tr className="text-left">
                <th className="px-3 py-2 font-semibold">Metric</th>
                <th className="px-3 py-2 text-right font-semibold">Weight</th>
                <th className="px-3 py-2 text-right font-semibold">
                  Pts / unit
                </th>
                <th className="px-3 py-2 text-right font-semibold">Bonus</th>
                <th className="px-3 py-2 text-right font-semibold">Cap</th>
                <th className="px-3 py-2 text-right font-semibold">Floor</th>
                <th className="px-3 py-2 text-right font-semibold">Stretch</th>
              </tr>
            </thead>
            <tbody>
              {ruleSet.rules.map((r) => {
                const meta = metricLabels.get(r.metric_id);
                return (
                  <tr
                    key={r.id}
                    className="border-t border-zinc-100 dark:border-zinc-800"
                  >
                    <td className="px-3 py-2">
                      <div className="font-medium">
                        {meta?.label ?? "Unknown metric"}
                      </div>
                      <div className="font-mono text-[10px] text-zinc-500">
                        {meta?.key ?? r.metric_id.slice(0, 8) + "…"}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {r.weight_pct}%
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {r.points_per_unit}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {r.bonus_points
                        ? `${r.bonus_points} @ ${r.bonus_on_target_pct}%`
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {r.cap_per_period ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {r.min_floor ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {r.stretch_target ?? "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </li>
  );
}

// ---------- Weight distribution ----------

const METRIC_PALETTE = [
  { tw: "bg-sky-500", text: "text-sky-700 dark:text-sky-400", dot: "bg-sky-500" },
  { tw: "bg-violet-500", text: "text-violet-700 dark:text-violet-400", dot: "bg-violet-500" },
  { tw: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-400", dot: "bg-emerald-500" },
  { tw: "bg-amber-500", text: "text-amber-700 dark:text-amber-400", dot: "bg-amber-500" },
  { tw: "bg-rose-500", text: "text-rose-700 dark:text-rose-400", dot: "bg-rose-500" },
  { tw: "bg-indigo-500", text: "text-indigo-700 dark:text-indigo-400", dot: "bg-indigo-500" },
  { tw: "bg-cyan-500", text: "text-cyan-700 dark:text-cyan-400", dot: "bg-cyan-500" },
  { tw: "bg-pink-500", text: "text-pink-700 dark:text-pink-400", dot: "bg-pink-500" },
];

function paletteFor(index: number) {
  return METRIC_PALETTE[index % METRIC_PALETTE.length] ?? METRIC_PALETTE[0]!;
}

function WeightDistributionCard({
  metrics,
}: {
  metrics: ScorecardConfigMetric[];
}) {
  const active = metrics.filter((m) => m.is_active);
  const total = active.reduce((s, m) => s + (m.rule.weight_pct ?? 0), 0);
  const isOk = Math.abs(total - 100) < 0.01;

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          Weight distribution
        </div>
        <div
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs",
            isOk
              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
              : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
          )}
        >
          {!isOk ? (
            <AlertTriangle className="h-3 w-3" aria-hidden />
          ) : (
            <span aria-hidden>✓</span>
          )}
          Should equal 100%{" "}
          <span className="text-zinc-400">·</span>{" "}
          Currently {total.toFixed(1)}%
        </div>
      </div>

      <div className="mt-3 flex h-7 overflow-hidden rounded-md bg-zinc-100 dark:bg-zinc-800">
        {active.map((m, i) => {
          const tone = paletteFor(i);
          const pct = m.rule.weight_pct ?? 0;
          if (pct <= 0) return null;
          return (
            <div
              key={m.key}
              className={cn("relative flex items-center justify-center text-[10px] font-semibold text-white", tone.tw)}
              style={{ width: `${(pct / Math.max(total, pct)) * 100}%` }}
              title={`${m.label} · ${pct}%`}
            >
              {pct >= 6 ? `${pct}%` : null}
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs">
        {active.map((m, i) => {
          const tone = paletteFor(i);
          return (
            <span key={m.key} className="inline-flex items-center gap-1.5">
              <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", tone.dot)} />
              <span className="text-zinc-700 dark:text-zinc-300">{m.label}</span>
              <span className="font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
                {m.rule.weight_pct}%
              </span>
            </span>
          );
        })}
      </div>
    </Card>
  );
}

// ---------- Save rule set ----------

function SaveRuleSetCard({
  version,
  onSave,
  onRefresh,
  saving,
}: {
  version: number;
  onSave: () => void;
  onRefresh: () => void;
  saving: boolean;
}) {
  return (
    <Card className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
      <div className="min-w-0">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          Rule set
        </div>
        <div className="text-xl font-semibold tracking-tight">
          Version {version}
        </div>
        <p className="mt-1 text-xs text-zinc-500">
          Manage metrics in the list, then edit details. Save applies the whole
          configuration.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onRefresh}
          aria-label="Refresh"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
        </button>
        <Button onClick={onSave} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Save
        </Button>
      </div>
    </Card>
  );
}

// ---------- Metrics table ----------

function MetricsTableCard({
  metrics,
  onToggleActive,
  onEdit,
  onDelete,
  onAddNew,
}: {
  metrics: ScorecardConfigMetric[];
  onToggleActive: (key: string, next: boolean) => void;
  onEdit: (m: ScorecardConfigMetric) => void;
  onDelete: (key: string) => void;
  onAddNew: () => void;
}) {
  const sorted = useMemo(
    () => [...metrics].sort((a, b) => a.display_order - b.display_order),
    [metrics],
  );

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-100 px-4 py-4 dark:border-zinc-800 sm:px-5">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">Metrics</h2>
          <p className="mt-1 text-xs text-zinc-500">
            All scorecard metrics. Edit one or create another.
          </p>
          <p className="mt-0.5 text-xs text-zinc-400">
            Internal IDs are mainly for integrations — most of the team only
            needs titles and targets.
          </p>
        </div>
        <Button onClick={onAddNew}>
          <Plus className="h-4 w-4" />
          New metric
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50/50 text-[10px] uppercase tracking-wider text-zinc-500 dark:bg-zinc-900/50">
            <tr className="text-left">
              <th className="px-4 py-2 font-semibold sm:px-5">Title</th>
              <th className="px-4 py-2 font-semibold">System ID</th>
              <th className="px-4 py-2 font-semibold">Weight</th>
              <th className="px-4 py-2 font-semibold">Sort order</th>
              <th className="px-4 py-2 font-semibold">Active</th>
              <th className="px-4 py-2 text-right font-semibold sm:pr-5">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-12 text-center text-sm text-zinc-500"
                >
                  No metrics defined yet. Click "New metric" to start.
                </td>
              </tr>
            ) : (
              sorted.map((m, i) => (
                <MetricRow
                  key={m.key}
                  metric={m}
                  paletteIndex={i}
                  onToggleActive={(next) => onToggleActive(m.key, next)}
                  onEdit={() => onEdit(m)}
                  onDelete={() => onDelete(m.key)}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function MetricRow({
  metric,
  paletteIndex,
  onToggleActive,
  onEdit,
  onDelete,
}: {
  metric: ScorecardConfigMetric;
  paletteIndex: number;
  onToggleActive: (next: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const tone = paletteFor(paletteIndex);
  const weight = metric.rule.weight_pct ?? 0;
  return (
    <tr className="border-t border-zinc-100 dark:border-zinc-800">
      <td className="px-4 py-3 sm:px-5">
        <div className="text-sm font-medium">{metric.label}</div>
      </td>
      <td className="px-4 py-3">
        <span className="rounded bg-zinc-100 px-2 py-0.5 font-mono text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
          {metric.key}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="w-10 text-sm font-semibold tabular-nums">
            {weight}%
          </span>
          <div className="h-1.5 w-32 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
            <span
              aria-hidden
              className={cn("block h-full rounded-full", tone.tw)}
              style={{ width: `${Math.min(100, weight)}%` }}
            />
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-sm tabular-nums text-zinc-600 dark:text-zinc-400">
        {metric.display_order}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <Switch checked={metric.is_active} onCheckedChange={onToggleActive} />
          <span className="text-xs text-zinc-500">
            {metric.is_active ? "Yes" : "No"}
          </span>
        </div>
      </td>
      <td className="px-4 py-3 text-right sm:pr-5">
        <div className="inline-flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Edit2 className="h-3.5 w-3.5" />
            Edit
          </Button>
          <button
            type="button"
            onClick={onDelete}
            aria-label={`Delete ${metric.label}`}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-500 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-rose-900/40 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ---------- Custom targets by rep ----------

function CustomTargetsCard({
  config,
  onChanged,
}: {
  config: NonNullable<ReturnType<typeof useScorecardConfig>["data"]>;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const overrides = useMemo(() => {
    const rows: { metricLabel: string; metricKey: string; userId: string; target: number; period: string }[] = [];
    for (const m of config.metrics) {
      for (const t of m.targets) {
        if (!t.is_default && t.user_id) {
          rows.push({
            metricLabel: m.label,
            metricKey: m.key,
            userId: t.user_id,
            target: t.target_value,
            period: t.period_type,
          });
        }
      }
    }
    return rows;
  }, [config]);

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-100 px-4 py-4 dark:border-zinc-800 sm:px-5">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">Custom targets by rep</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Override the default target for a specific person and period.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" />
          Add override
        </Button>
      </div>

      {overrides.length === 0 ? (
        <div className="px-4 py-10 text-center text-sm text-zinc-500 sm:px-5">
          No custom targets yet. Defaults from the rule set apply to every rep.
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-zinc-50/50 text-[10px] uppercase tracking-wider text-zinc-500 dark:bg-zinc-900/50">
            <tr className="text-left">
              <th className="px-4 py-2 font-semibold sm:px-5">Rep</th>
              <th className="px-4 py-2 font-semibold">Metric</th>
              <th className="px-4 py-2 font-semibold">Period</th>
              <th className="px-4 py-2 text-right font-semibold sm:pr-5">Target</th>
            </tr>
          </thead>
          <tbody>
            {overrides.map((o, i) => (
              <tr
                key={`${o.userId}-${o.metricKey}-${i}`}
                className="border-t border-zinc-100 dark:border-zinc-800"
              >
                <td className="px-4 py-3 font-mono text-xs sm:px-5">
                  {o.userId.slice(0, 8)}…
                </td>
                <td className="px-4 py-3">{o.metricLabel}</td>
                <td className="px-4 py-3 text-xs uppercase text-zinc-500">
                  {o.period}
                </td>
                <td className="px-4 py-3 text-right tabular-nums sm:pr-5">
                  {formatNumber(o.target)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <AddOverrideDialog
        open={open}
        onOpenChange={setOpen}
        metrics={config.metrics}
        onSaved={() => {
          setOpen(false);
          onChanged();
        }}
      />
    </Card>
  );
}

// ---------- Metric editor dialog ----------

interface EditorPatch {
  label: string;
  display_order: number;
  weight_pct: number;
  points_per_unit: number;
  bonus_points: number;
  target_value: number;
}

function MetricEditorDialog({
  open,
  metric,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  metric: ScorecardConfigMetric | null;
  onOpenChange: (next: boolean) => void;
  onSave: (patch: EditorPatch) => void;
}) {
  const [form, setForm] = useState<EditorPatch>({
    label: "",
    display_order: 0,
    weight_pct: 0,
    points_per_unit: 0,
    bonus_points: 0,
    target_value: 0,
  });

  useEffect(() => {
    if (metric) {
      const def = metric.targets.find((t) => t.is_default);
      setForm({
        label: metric.label,
        display_order: metric.display_order,
        weight_pct: metric.rule.weight_pct ?? 0,
        points_per_unit: metric.rule.points_per_unit ?? 0,
        bonus_points: metric.rule.bonus_points ?? 0,
        target_value: def?.target_value ?? 0,
      });
    }
  }, [metric]);

  if (!metric) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit metric</DialogTitle>
          <DialogDescription>
            <span className="font-mono text-xs text-zinc-500">
              {metric.key}
            </span>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="m-label">Title</Label>
            <Input
              id="m-label"
              value={form.label}
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="m-weight">Weight %</Label>
              <Input
                id="m-weight"
                type="number"
                value={form.weight_pct}
                onChange={(e) =>
                  setForm((f) => ({ ...f, weight_pct: Number(e.target.value) || 0 }))
                }
                className="tabular-nums"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="m-order">Sort order</Label>
              <Input
                id="m-order"
                type="number"
                value={form.display_order}
                onChange={(e) =>
                  setForm((f) => ({ ...f, display_order: Number(e.target.value) || 0 }))
                }
                className="tabular-nums"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="m-pts">Points / unit</Label>
              <Input
                id="m-pts"
                type="number"
                value={form.points_per_unit}
                onChange={(e) =>
                  setForm((f) => ({ ...f, points_per_unit: Number(e.target.value) || 0 }))
                }
                className="tabular-nums"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="m-bonus">Bonus points</Label>
              <Input
                id="m-bonus"
                type="number"
                value={form.bonus_points}
                onChange={(e) =>
                  setForm((f) => ({ ...f, bonus_points: Number(e.target.value) || 0 }))
                }
                className="tabular-nums"
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="m-target">Default target (monthly)</Label>
              <Input
                id="m-target"
                type="number"
                value={form.target_value}
                onChange={(e) =>
                  setForm((f) => ({ ...f, target_value: Number(e.target.value) || 0 }))
                }
                className="tabular-nums"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => onSave(form)}>Apply</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- New metric dialog ----------

function NewMetricDialog({
  open,
  onOpenChange,
  onCreate,
  existingKeys,
  nextOrder,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  onCreate: (m: ScorecardConfigMetric) => void;
  existingKeys: string[];
  nextOrder: number;
}) {
  const [label, setLabel] = useState("");
  const [key, setKey] = useState("");
  const [weight, setWeight] = useState(0);
  const [pts, setPts] = useState(1);
  const [target, setTarget] = useState(0);

  useEffect(() => {
    if (!open) {
      setLabel("");
      setKey("");
      setWeight(0);
      setPts(1);
      setTarget(0);
    }
  }, [open]);

  const slugifiedKey = key.trim() || slugify(label);
  const keyTaken = existingKeys.includes(slugifiedKey);
  const valid = label.trim().length > 0 && slugifiedKey.length > 0 && !keyTaken;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New metric</DialogTitle>
          <DialogDescription>
            Defines a scorecard metric. Save the rule set to publish it.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="nm-label">Title</Label>
            <Input
              id="nm-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Demos delivered"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nm-key">System ID</Label>
            <Input
              id="nm-key"
              value={slugifiedKey}
              onChange={(e) => setKey(e.target.value)}
              className="font-mono"
              placeholder="auto from title"
            />
            {keyTaken ? (
              <p className="text-xs text-rose-600 dark:text-rose-400">
                A metric with this ID already exists.
              </p>
            ) : (
              <p className="text-xs text-zinc-500">
                Lowercase, snake_case. Used by integrations.
              </p>
            )}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="nm-weight">Weight %</Label>
              <Input
                id="nm-weight"
                type="number"
                value={weight}
                onChange={(e) => setWeight(Number(e.target.value) || 0)}
                className="tabular-nums"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nm-pts">Pts / unit</Label>
              <Input
                id="nm-pts"
                type="number"
                value={pts}
                onChange={(e) => setPts(Number(e.target.value) || 0)}
                className="tabular-nums"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nm-target">Target</Label>
              <Input
                id="nm-target"
                type="number"
                value={target}
                onChange={(e) => setTarget(Number(e.target.value) || 0)}
                className="tabular-nums"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!valid}
            onClick={() => {
              const k = slugifiedKey;
              onCreate({
                id: `local-${k}`,
                key: k,
                label: label.trim(),
                unit: "count",
                is_active: true,
                display_order: nextOrder,
                rule: {
                  points_per_unit: pts,
                  cap_per_period: null,
                  bonus_points: 0,
                  bonus_on_target_pct: 100,
                  weight_pct: weight,
                  min_floor: null,
                  stretch_target: null,
                },
                targets: [
                  {
                    id: `local-target-${k}`,
                    user_id: null,
                    target_value: target,
                    period_type: "MONTHLY",
                    is_default: true,
                  },
                ],
              });
            }}
          >
            Add metric
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function slugify(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

// ---------- Add override dialog ----------

function AddOverrideDialog({
  open,
  onOpenChange,
  metrics,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  metrics: ScorecardConfigMetric[];
  onSaved: () => void;
}) {
  const people = useLeadPeople();
  const { setForUser } = useTargetMutations();
  const [userId, setUserId] = useState<string>("");
  const [metricKey, setMetricKey] = useState<string>("");
  const [target, setTarget] = useState<number>(0);
  const [period, setPeriod] = useState<"MONTHLY" | "QUARTERLY" | "HALF_YEARLY" | "YEARLY">("MONTHLY");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setUserId("");
      setMetricKey("");
      setTarget(0);
      setPeriod("MONTHLY");
    }
  }, [open]);

  const handleSave = async () => {
    if (!userId || !metricKey) {
      toast.error("Pick a rep and a metric.");
      return;
    }
    setSubmitting(true);
    try {
      await setForUser(
        userId,
        { values: { [metricKey]: target } },
        period.toLowerCase() as "monthly" | "quarterly" | "half_yearly" | "yearly",
      );
      toast.success("Override saved");
      onSaved();
    } catch (err) {
      toast.error("Couldn't save override", {
        description: errorMessage(err),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add target override</DialogTitle>
          <DialogDescription>
            Replaces the default target for one rep on one metric.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Rep</Label>
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a rep…" />
              </SelectTrigger>
              <SelectContent>
                {(people.data ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Metric</Label>
            <Select value={metricKey} onValueChange={setMetricKey}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a metric…" />
              </SelectTrigger>
              <SelectContent>
                {metrics.map((m) => (
                  <SelectItem key={m.key} value={m.key}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ovr-target">Target</Label>
              <Input
                id="ovr-target"
                type="number"
                value={target}
                onChange={(e) => setTarget(Number(e.target.value) || 0)}
                className="tabular-nums"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Period</Label>
              <Select
                value={period}
                onValueChange={(v) => setPeriod(v as typeof period)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MONTHLY">Monthly</SelectItem>
                  <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                  <SelectItem value="HALF_YEARLY">Half-yearly</SelectItem>
                  <SelectItem value="YEARLY">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Save override
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =================================================================
// MANUAL POINTS TAB
// =================================================================

function ManualPointsTab() {
  const config = useScorecardConfig({ include_inactive: true });
  const people = useLeadPeople();
  const { addAdjustment } = useScorecardMutations();
  const points = useManualPoints();

  const [userId, setUserId] = useState<string>("");
  const [metricKey, setMetricKey] = useState<string>("");
  const [pts, setPts] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [refType, setRefType] = useState<string>("");
  const [refId, setRefId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // Default the metric to the first available so the field doesn't read empty
  // on first paint (matches the screenshot's "New leads assigned" default).
  useEffect(() => {
    if (!metricKey && config.data?.metrics[0]) {
      setMetricKey(config.data.metrics[0].key);
    }
  }, [config.data, metricKey]);

  const valid =
    userId !== "" &&
    metricKey !== "" &&
    pts.trim() !== "" &&
    Number(pts) !== 0 &&
    reason.trim() !== "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) {
      toast.error("Rep, metric, points, and reason are all required.");
      return;
    }
    setSubmitting(true);
    try {
      await addAdjustment({
        user_id: userId,
        metric_key: metricKey,
        points: Number(pts),
        reason: reason.trim(),
        ref_type: refType.trim() || undefined,
        ref_id: refId.trim() || undefined,
      });
      toast.success("Adjustment applied");
      setPts("");
      setReason("");
      setRefType("");
      setRefId("");
      void points.refetch();
    } catch (err) {
      toast.error("Couldn't apply adjustment", {
        description: errorMessage(err),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <div className="flex items-start gap-3 px-4 py-4 sm:px-6 sm:py-5">
          <span
            aria-hidden
            className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Manual adjustment
            </div>
            <h3 className="mt-0.5 text-base font-semibold">Adjust points</h3>
            <p className="mt-1 text-sm text-zinc-500">
              Pick a rep and metric, enter a positive or negative amount, and
              add a short reason for the audit trail.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="border-t border-zinc-100 dark:border-zinc-800">
          <FormSection label="Who & what">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  Sales rep
                </Label>
                <Select value={userId} onValueChange={setUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a rep…" />
                  </SelectTrigger>
                  <SelectContent>
                    {(people.data ?? []).map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  Metric
                </Label>
                <Select value={metricKey} onValueChange={setMetricKey}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a metric…" />
                  </SelectTrigger>
                  <SelectContent>
                    {(config.data?.metrics ?? []).map((m) => (
                      <SelectItem key={m.key} value={m.key}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </FormSection>

          <FormSection label="Amount">
            <div className="space-y-1.5">
              <Label
                htmlFor="ma-points"
                className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500"
              >
                Points
              </Label>
              <Input
                id="ma-points"
                type="number"
                value={pts}
                onChange={(e) => setPts(e.target.value)}
                placeholder="e.g. 5 or -2"
                className="tabular-nums"
              />
              <p className="text-xs text-zinc-500">
                Use a positive number to add points, or a negative number to
                subtract.
              </p>
            </div>
          </FormSection>

          <FormSection label="Reason">
            <div className="space-y-1.5">
              <Label
                htmlFor="ma-reason"
                className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500"
              >
                Note for the audit trail
              </Label>
              <Textarea
                id="ma-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="What changed and why (required)"
              />
            </div>

            <button
              type="button"
              onClick={() => setAdvancedOpen((v) => !v)}
              className="mt-3 flex w-full items-center justify-between rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900"
              aria-expanded={advancedOpen}
            >
              <span>
                Advanced options{" "}
                <span className="text-zinc-400">(optional)</span>
              </span>
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 text-zinc-500 transition-transform",
                  advancedOpen && "rotate-180",
                )}
                aria-hidden
              />
            </button>

            {advancedOpen ? (
              <div className="mt-3 grid grid-cols-1 gap-3 rounded-md border border-zinc-200 bg-zinc-50/40 p-3 dark:border-zinc-800 dark:bg-zinc-900/40 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="ma-ref-type"
                    className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500"
                  >
                    Ref type
                  </Label>
                  <Input
                    id="ma-ref-type"
                    value={refType}
                    onChange={(e) => setRefType(e.target.value)}
                    placeholder="e.g. lead"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label
                    htmlFor="ma-ref-id"
                    className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500"
                  >
                    Ref ID
                  </Label>
                  <Input
                    id="ma-ref-id"
                    value={refId}
                    onChange={(e) => setRefId(e.target.value)}
                    placeholder="UUID or external ID"
                    className="font-mono"
                  />
                </div>
              </div>
            ) : null}
          </FormSection>

          <div className="border-t border-zinc-100 px-4 py-4 dark:border-zinc-800 sm:px-6 sm:py-5">
            <Button type="submit" className="w-full" disabled={submitting || !valid}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Apply adjustment
            </Button>
            <p className="mt-2 text-center text-xs text-zinc-500">
              Rep, metric, points, and reason are required. The adjustment is
              sent as soon as you apply it.
            </p>
          </div>
        </form>
      </Card>

      <RecentAdjustmentsCard
        rows={points.data ?? []}
        isLoading={points.isLoading}
        error={points.error}
        userNames={
          new Map((people.data ?? []).map((p) => [p.id, p.name]))
        }
      />
    </div>
  );
}

function FormSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-t border-zinc-100 px-4 py-4 first:border-t-0 dark:border-zinc-800 sm:px-6 sm:py-5">
      <div className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        {label}
      </div>
      {children}
    </div>
  );
}

// ---------- Recent adjustments ----------

function RecentAdjustmentsCard({
  rows,
  isLoading,
  error,
  userNames,
}: {
  rows: { id: string; userId: string; metricKey: string; points: number; reason: string; createdBy: { id: string; name: string }; occurredAt: string }[];
  isLoading: boolean;
  error: Error | null;
  /**
   * Map of `user_id` → display name. Built from `/sales/leads/people` so the
   * Rep column reads as a name instead of a truncated UUID. Falls back to
   * the short ID if the user isn't in the map (deactivated rep, etc.).
   */
  userNames: Map<string, string>;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 border-b border-zinc-100 px-4 py-3 dark:border-zinc-800 sm:px-5">
        <Sparkles className="h-4 w-4 text-violet-500" aria-hidden />
        <h2 className="text-sm font-medium">Recent adjustments</h2>
      </div>

      {error ? (
        <div className="px-4 py-3 text-xs text-rose-700 dark:text-rose-300">
          Couldn't load adjustments: {errorMessage(error)}
        </div>
      ) : null}

      {isLoading && rows.length === 0 ? (
        <div className="px-4 py-12 text-center text-sm text-zinc-500">
          Loading…
        </div>
      ) : rows.length === 0 ? (
        <div className="px-4 py-12 text-center text-sm text-zinc-500">
          No manual adjustments yet.
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-zinc-50/50 text-[10px] uppercase tracking-wider text-zinc-500 dark:bg-zinc-900/50">
            <tr className="text-left">
              <th className="px-4 py-2 font-semibold sm:px-5">When</th>
              <th className="px-4 py-2 font-semibold">Rep</th>
              <th className="px-4 py-2 font-semibold">Metric</th>
              <th className="px-4 py-2 text-right font-semibold">Points</th>
              <th className="px-4 py-2 font-semibold">Reason</th>
              <th className="px-4 py-2 font-semibold sm:pr-5">By</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr
                key={p.id}
                className="border-t border-zinc-100 dark:border-zinc-800"
              >
                <td className="px-4 py-3 text-xs tabular-nums text-zinc-500 sm:px-5">
                  {new Date(p.occurredAt).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-sm">
                  {userNames.get(p.userId) ?? (
                    <span className="font-mono text-xs text-zinc-500">
                      {p.userId.slice(0, 8)}…
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 font-mono text-xs">{p.metricKey}</td>
                <td
                  className={cn(
                    "px-4 py-3 text-right text-sm font-semibold tabular-nums",
                    p.points < 0
                      ? "text-rose-600 dark:text-rose-400"
                      : "text-emerald-600 dark:text-emerald-400",
                  )}
                >
                  {p.points > 0 ? "+" : ""}
                  {p.points}
                </td>
                <td className="px-4 py-3 text-sm">{p.reason}</td>
                <td className="px-4 py-3 text-xs text-zinc-500 sm:pr-5">
                  {p.createdBy?.name ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

// ---------- Skeletons ----------

function Skeleton() {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="h-7 w-48 animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-800" />
        <div className="h-4 w-72 animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-800" />
      </div>
      <Card className="h-9 w-72 animate-pulse" />
      <Card className="h-72 animate-pulse" />
    </div>
  );
}

function SetupSkeleton() {
  return (
    <div className="space-y-4">
      <Card className="h-24 animate-pulse" />
      <Card className="h-32 animate-pulse" />
      <Card className="h-20 animate-pulse" />
      <Card className="h-72 animate-pulse" />
    </div>
  );
}

/**
 * Return the timestamp at which a version's rules first became effective.
 * Uses the earliest `effective_from` across the version's rules — this is
 * stable across later edits, unlike the backend's top-level `appliedAt`
 * which gets bumped whenever any version is touched.
 */
function deriveAppliedAt(rs: ScoringRuleSet): string | null {
  let earliest: string | null = null;
  for (const r of rs.rules) {
    if (!r.effective_from) continue;
    if (!earliest || r.effective_from < earliest) earliest = r.effective_from;
  }
  return earliest ?? rs.appliedAt ?? null;
}
