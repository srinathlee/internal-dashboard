"use client";

import { useMemo, useState } from "react";

import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { useAuth } from "@/lib/auth";
import { isSalesMember } from "@/lib/access";
import { errorMessage } from "@/lib/hooks/use-async";
import { useMyRevenueTargets } from "@/lib/hooks/use-revenue-targets";
import type {
  PeriodSnapshot,
  RevenuePeriod,
} from "@/lib/api/sales-revenue-targets";

import {
  SingleRepDetailedView,
  type Period,
} from "./target-management-screen";

/**
 * Sales rep "My targets" view. Reuses the same single-rep detailed layout
 * that super admins see on /sales/targets when filtering down to one rep —
 * just scoped to the currently authenticated rep via `GET /sales/targets/me`.
 */
export function MyTargetsScreen() {
  const auth = useAuth();
  const [period, setPeriod] = useState<Period>("DAILY");
  const query = useMyRevenueTargets();

  // The /me endpoint returns `MyPeriodSnapshot` per period — which extends
  // PeriodSnapshot with days_total/elapsed/remaining fields. We narrow back
  // to PeriodSnapshot for the shared view; the days fields aren't used yet.
  const periods = useMemo<
    Partial<Record<RevenuePeriod, PeriodSnapshot | null>>
  >(() => {
    if (!query.data) return {};
    const out: Partial<Record<RevenuePeriod, PeriodSnapshot | null>> = {};
    for (const key of Object.keys(query.data.periods) as RevenuePeriod[]) {
      const snap = query.data.periods[key];
      out[key] = snap
        ? {
            target_amount: snap.target_amount,
            actual_amount: snap.actual_amount,
            progress_pct: snap.progress_pct,
            status: snap.status,
          }
        : null;
    }
    return out;
  }, [query.data]);

  if (!auth.isLoaded) {
    return (
      <div className="space-y-4">
        <Card className="h-16 animate-pulse" />
        <Card className="h-96 animate-pulse" />
      </div>
    );
  }

  if (!isSalesMember(auth) || !auth.user) {
    return (
      <div className="space-y-6">
        <PageHeader title="My targets" />
        <Card className="p-12 text-center text-sm text-zinc-500">
          You don't have permission to view this page.
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="My targets"
        description="Your assigned target amount and progress for each period."
      />

      {query.error ? (
        <Card className="p-8 text-center text-sm text-rose-600">
          Couldn't load your targets: {errorMessage(query.error)}
        </Card>
      ) : query.isLoading && !query.data ? (
        <div className="space-y-4">
          <Card className="h-24 animate-pulse" />
          <Card className="h-80 animate-pulse" />
        </div>
      ) : (
        <SingleRepDetailedView
          user={query.data?.user ?? { id: auth.user.id, name: auth.user.name }}
          periods={periods}
          activePeriod={period}
          onPeriodChange={setPeriod}
        />
      )}
    </div>
  );
}
