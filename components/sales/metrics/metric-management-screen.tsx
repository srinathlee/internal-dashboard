"use client";

import { useMemo, useState } from "react";
import { Coins, Wand2 } from "lucide-react";

import { Card } from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { PageHeader } from "@/components/layout/page-header";
import {
  ManualPointsTab,
  MetricsSetupTab,
} from "@/components/sales/scorecard/scorecard-admin-screen";
import {
  buildScorecard,
  computeMrrForUser,
  defaultSelectionFor,
  resolveWindow,
} from "@/components/sales/scorecard/scorecard-shared";
import { useAuth } from "@/lib/auth";
import { isSalesAdminOrSuperAdmin } from "@/lib/access";
import { getTeamMembers } from "@/lib/mock-data";

type ManagementTab = "setup" | "manual";

/**
 * Metric management — sales-admin / super-admin surface for configuring
 * scoring rules and awarding manual points.
 */
export function MetricManagementScreen() {
  const auth = useAuth();
  const [tab, setTab] = useState<ManagementTab>("setup");

  // Manual point awards need the per-rep scorecard data the scorecard page
  // computes — recreate it here against the current month so the form has
  // metrics + reps to choose from.
  const teamScorecards = useMemo(() => {
    const reps = getTeamMembers("sales").filter(
      (u) => u.role === "member" && u.status === "active",
    );
    const window = resolveWindow("month", defaultSelectionFor("month"));
    return reps.map((r) => ({
      user: r,
      metrics: buildScorecard(r, window),
      mrr: computeMrrForUser(r, window),
    }));
  }, []);

  if (!auth.isLoaded) return <Skeleton />;

  if (!isSalesAdminOrSuperAdmin(auth)) {
    return (
      <div className="space-y-6">
        <PageHeader title="Metric management" />
        <Card className="p-12 text-center text-sm text-zinc-500">
          You don&apos;t have permission to manage sales metrics.
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

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as ManagementTab)}
        className="space-y-4"
      >
        <TabsList>
          <TabsTrigger value="setup" className="gap-1.5">
            <Wand2 className="h-3.5 w-3.5" aria-hidden />
            Metrics &amp; setup
          </TabsTrigger>
          <TabsTrigger value="manual" className="gap-1.5">
            <Coins className="h-3.5 w-3.5" aria-hidden />
            Manual points
          </TabsTrigger>
        </TabsList>

        <TabsContent value="setup" className="mt-0">
          <MetricsSetupTab />
        </TabsContent>

        <TabsContent value="manual" className="mt-0">
          <ManualPointsTab reps={teamScorecards} />
        </TabsContent>
      </Tabs>
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
      <Card className="h-72 animate-pulse" />
    </div>
  );
}
