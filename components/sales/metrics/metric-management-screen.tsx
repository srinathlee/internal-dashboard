"use client";

import { useMemo, useState } from "react";
import { Coins, Wand2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { formatNumber } from "@/lib/format-metric";

type ManagementTab = "setup" | "manual";

/**
 * Metric management — admin surface for the sales scoring system.
 *
 * Setup tab: GET / PUT /api/v1/sales/scorecard/config — view and adjust
 * metric definitions, weights, and the default targets.
 *
 * Manual tab: POST /api/v1/sales/scorecard/adjustments — award or deduct
 * points off-system. Recent entries are listed via /manual-points.
 */
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
        description="Configure scoring metrics, weights, and adjust points manually."
      />

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as ManagementTab)}
        className="space-y-4"
      >
        <TabsList>
          <TabsTrigger value="setup" className="gap-2">
            <Wand2 className="h-4 w-4" aria-hidden />
            Setup
          </TabsTrigger>
          <TabsTrigger value="manual" className="gap-2">
            <Coins className="h-4 w-4" aria-hidden />
            Manual points
          </TabsTrigger>
        </TabsList>

        <TabsContent value="setup">
          <SetupTab />
        </TabsContent>
        <TabsContent value="manual">
          <ManualPointsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------- Setup ----------

function SetupTab() {
  const config = useScorecardConfig({ include_inactive: true });

  if (config.error) {
    return (
      <Card className="p-6 text-sm text-rose-700 dark:text-rose-300">
        Couldn't load scoring config: {errorMessage(config.error)}
      </Card>
    );
  }
  if (config.isLoading || !config.data) {
    return <Card className="h-72 animate-pulse" />;
  }

  const totalActiveWeight = config.data.metrics
    .filter((m) => m.is_active)
    .reduce((s, m) => s + (m.rule.weight_pct ?? 0), 0);

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-zinc-500">
              Active weight total
            </div>
            <div className="text-2xl font-semibold tabular-nums">
              {totalActiveWeight}%
            </div>
          </div>
          <p className="text-xs text-zinc-500">
            Active metrics must sum to 100% before you can publish a new
            rule set.
          </p>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
            <tr className="text-left">
              <th className="px-4 py-2 font-medium">Metric</th>
              <th className="px-4 py-2 text-right font-medium">Pts/unit</th>
              <th className="px-4 py-2 text-right font-medium">Weight</th>
              <th className="px-4 py-2 text-right font-medium">Bonus</th>
              <th className="px-4 py-2 text-right font-medium">Default target</th>
              <th className="px-4 py-2 text-right font-medium">Active</th>
            </tr>
          </thead>
          <tbody>
            {config.data.metrics.map((m) => {
              const def = m.targets.find((t) => t.is_default);
              return (
                <tr
                  key={m.id}
                  className="border-t border-zinc-100 dark:border-zinc-800"
                >
                  <td className="px-4 py-2">
                    <div className="font-medium">{m.label}</div>
                    <div className="text-xs text-zinc-500">{m.key}</div>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {m.rule.points_per_unit}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {m.rule.weight_pct}%
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {m.rule.bonus_points}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {def
                      ? `${formatNumber(def.target_value)} / ${def.period_type.toLowerCase()}`
                      : "—"}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {m.is_active ? "✅" : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <p className="text-xs text-zinc-500">
        Edit weights & targets via the form below. Pushing weight changes
        publishes a new rule set version automatically.
      </p>

      <ConfigEditor config={config.data} onSaved={() => config.refetch()} />
    </div>
  );
}

function ConfigEditor({
  config,
  onSaved,
}: {
  config: NonNullable<ReturnType<typeof useScorecardConfig>["data"]>;
  onSaved: () => void;
}) {
  const { updateConfig } = useScorecardMutations();
  const [working, setWorking] = useState(() =>
    config.metrics.map((m) => {
      const def = m.targets.find((t) => t.is_default);
      return {
        key: m.key,
        label: m.label,
        weight_pct: m.rule.weight_pct,
        points_per_unit: m.rule.points_per_unit,
        target_value: def?.target_value ?? 0,
      };
    }),
  );
  const [submitting, setSubmitting] = useState(false);

  const handleSave = async () => {
    setSubmitting(true);
    try {
      await updateConfig({
        metrics: working.map((w) => ({
          key: w.key,
          rule: {
            weight_pct: w.weight_pct,
            points_per_unit: w.points_per_unit,
          },
          target: {
            target_value: w.target_value,
            period_type: "MONTHLY",
            is_default: true,
          },
        })),
      });
      toast.success("Scoring config saved");
      onSaved();
    } catch (err) {
      toast.error("Couldn't save", { description: errorMessage(err) });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="p-4 space-y-3">
      <h3 className="text-sm font-medium">Quick edit</h3>
      <div className="grid grid-cols-1 gap-2">
        {working.map((w, idx) => (
          <div
            key={w.key}
            className="grid grid-cols-2 gap-2 sm:grid-cols-4 items-center"
          >
            <div className="text-sm">
              <div className="font-medium">{w.label}</div>
              <div className="text-xs text-zinc-500">{w.key}</div>
            </div>
            <NumberCell
              label="Weight %"
              value={w.weight_pct}
              onChange={(v) =>
                setWorking((arr) =>
                  arr.map((x, i) => (i === idx ? { ...x, weight_pct: v } : x)),
                )
              }
            />
            <NumberCell
              label="Pts/unit"
              value={w.points_per_unit}
              onChange={(v) =>
                setWorking((arr) =>
                  arr.map((x, i) =>
                    i === idx ? { ...x, points_per_unit: v } : x,
                  ),
                )
              }
            />
            <NumberCell
              label="Target"
              value={w.target_value}
              onChange={(v) =>
                setWorking((arr) =>
                  arr.map((x, i) =>
                    i === idx ? { ...x, target_value: v } : x,
                  ),
                )
              }
            />
          </div>
        ))}
      </div>
      <div className="flex justify-end pt-2">
        <Button onClick={handleSave} disabled={submitting}>
          Save changes
        </Button>
      </div>
    </Card>
  );
}

function NumberCell({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-zinc-500">
      <span>{label}</span>
      <Input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="h-9 tabular-nums"
      />
    </label>
  );
}

// ---------- Manual points ----------

function ManualPointsTab() {
  const config = useScorecardConfig({ include_inactive: true });
  const people = useLeadPeople();
  const points = useManualPoints();
  const { addAdjustment } = useScorecardMutations();

  const [userId, setUserId] = useState<string>("");
  const [metricKey, setMetricKey] = useState<string>("");
  const [pts, setPts] = useState<number>(0);
  const [reason, setReason] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const metricsList = config.data?.metrics ?? [];
  const peopleList = people.data ?? [];

  const handleSubmit = async () => {
    if (!userId || !metricKey || !pts || !reason.trim()) {
      toast.error("Fill out every field.");
      return;
    }
    setSubmitting(true);
    try {
      await addAdjustment({
        user_id: userId,
        metric_key: metricKey,
        points: pts,
        reason: reason.trim(),
      });
      toast.success("Points adjusted");
      setPts(0);
      setReason("");
      void points.refetch();
    } catch (err) {
      toast.error("Couldn't save adjustment", {
        description: errorMessage(err),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <h3 className="text-sm font-medium">Award or deduct points</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Rep">
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose rep" />
              </SelectTrigger>
              <SelectContent>
                {peopleList.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Metric">
            <Select value={metricKey} onValueChange={setMetricKey}>
              <SelectTrigger>
                <SelectValue placeholder="Choose metric" />
              </SelectTrigger>
              <SelectContent>
                {metricsList.map((m) => (
                  <SelectItem key={m.key} value={m.key}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Points (positive or negative)">
            <Input
              type="number"
              value={pts}
              onChange={(e) => setPts(Number(e.target.value) || 0)}
              className="h-10 tabular-nums"
            />
          </Field>
          <Field label="Reason">
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder="Why this adjustment?"
            />
          </Field>
        </div>
        <div className="flex justify-end">
          <Button onClick={handleSubmit} disabled={submitting}>
            Save adjustment
          </Button>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="px-4 py-3 text-sm font-medium border-b border-zinc-200 dark:border-zinc-800">
          Recent adjustments
        </div>
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
            <tr className="text-left">
              <th className="px-4 py-2 font-medium">When</th>
              <th className="px-4 py-2 font-medium">Rep</th>
              <th className="px-4 py-2 font-medium">Metric</th>
              <th className="px-4 py-2 text-right font-medium">Points</th>
              <th className="px-4 py-2 font-medium">Reason</th>
              <th className="px-4 py-2 font-medium">By</th>
            </tr>
          </thead>
          <tbody>
            {(points.data ?? []).length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-zinc-500"
                >
                  No manual adjustments yet.
                </td>
              </tr>
            ) : (
              points.data!.map((p) => (
                <tr
                  key={p.id}
                  className="border-t border-zinc-100 dark:border-zinc-800"
                >
                  <td className="px-4 py-2 text-xs tabular-nums">
                    {new Date(p.occurredAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-2">{p.userId}</td>
                  <td className="px-4 py-2">{p.metricKey}</td>
                  <td
                    className={`px-4 py-2 text-right tabular-nums ${
                      p.points < 0
                        ? "text-rose-600 dark:text-rose-400"
                        : "text-emerald-600 dark:text-emerald-400"
                    }`}
                  >
                    {p.points > 0 ? "+" : ""}
                    {p.points}
                  </td>
                  <td className="px-4 py-2 text-xs">{p.reason}</td>
                  <td className="px-4 py-2 text-xs">{p.createdBy?.name}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-4">
      <Card className="h-16 animate-pulse" />
      <Card className="h-72 animate-pulse" />
    </div>
  );
}
