"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ChevronRight,
  IndianRupee,
  MapPin,
  Plus,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { useAuth } from "@/lib/auth";
import { isSalesAdminOrSuperAdmin } from "@/lib/access";
import { errorMessage } from "@/lib/hooks/use-async";
import { useAcpBatches, useAcpOverview } from "@/lib/hooks/use-accelerator";
import type { AcpBatch } from "@/lib/api/sales-accelerator";
import { cn } from "@/lib/utils";

import { acpFmt, StatCard } from "./acp-shared";
import { CreateBatchModal } from "./create-batch-modal";

/**
 * /sales/accelerator — program overview. Top-line stats, top performer, and a
 * grid of batch cards that drill into the per-batch dashboard.
 */
export function AcceleratorOverviewScreen() {
  const auth = useAuth();
  const overview = useAcpOverview();
  const batches = useAcpBatches();
  const [showCreate, setShowCreate] = useState(false);

  if (!auth.isLoaded) {
    return (
      <div className="space-y-6">
        <Card className="h-20 animate-pulse" />
        <Card className="h-40 animate-pulse" />
        <Card className="h-48 animate-pulse" />
      </div>
    );
  }

  if (!isSalesAdminOrSuperAdmin(auth)) {
    return (
      <div className="space-y-6">
        <PageHeader title="Accelerator program" />
        <Card className="p-12 text-center text-sm text-zinc-500">
          The Accelerator program is managed by sales admins and super admins.
        </Card>
      </div>
    );
  }

  const ov = overview.data;
  const batchList = batches.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Accelerator program"
        description="2-month sales accelerator."
        actions={
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" aria-hidden />
            New batch
          </Button>
        }
      />

      {/* Stats */}
      {overview.isLoading && !ov ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="h-24 animate-pulse" />
          ))}
        </div>
      ) : overview.error ? (
        <Card className="p-6 text-center text-sm text-rose-600 dark:text-rose-400">
          Couldn&apos;t load program stats: {errorMessage(overview.error)}
        </Card>
      ) : ov ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={Users}
              label="ACP members"
              value={`${ov.active_members}/${ov.total_members}`}
            />
            <StatCard
              icon={Zap}
              label="Sprints"
              value={ov.total_sprints}
              tone="amber"
            />
            <StatCard
              icon={IndianRupee}
              label="Sprint ₹"
              value={acpFmt(ov.sprint_revenue)}
              tone="amber"
            />
            <StatCard
              icon={TrendingUp}
              label="Sub ₹"
              value={acpFmt(ov.subscription_revenue)}
              tone="good"
            />
          </div>

          <TopPerformerBar
            name={ov.top_performer?.name ?? "—"}
            revenue={ov.top_performer?.total_revenue ?? 0}
            conversionRate={ov.conversion_rate}
            refundRate={ov.refund_rate}
          />
        </>
      ) : null}

      {/* Batches */}
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Batches</h2>
        {batches.isLoading && batchList.length === 0 ? (
          <div className="mt-3 grid gap-4 lg:grid-cols-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Card key={i} className="h-44 animate-pulse" />
            ))}
          </div>
        ) : batches.error ? (
          <Card className="mt-3 p-6 text-center text-sm text-rose-600 dark:text-rose-400">
            Couldn&apos;t load batches: {errorMessage(batches.error)}
          </Card>
        ) : batchList.length === 0 ? (
          <Card className="mt-3 flex flex-col items-center gap-2 p-12 text-center">
            <Zap className="h-8 w-8 text-zinc-300 dark:text-zinc-600" aria-hidden />
            <p className="text-sm text-zinc-500">No batches yet.</p>
            <p className="text-xs text-zinc-400">
              Create your first batch to start onboarding accelerator reps.
            </p>
          </Card>
        ) : (
          <div className="mt-3 grid gap-4 lg:grid-cols-2">
            {batchList.map((b) => (
              <BatchCard key={b.id} batch={b} />
            ))}
          </div>
        )}
      </div>

      <CreateBatchModal
        open={showCreate}
        onOpenChange={setShowCreate}
        onCreated={() => batches.refetch()}
      />
    </div>
  );
}

function TopPerformerBar({
  name,
  revenue,
  conversionRate,
  refundRate,
}: {
  name: string;
  revenue: number;
  conversionRate: number;
  refundRate: number;
}) {
  return (
    <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
      <div>
        <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
          Top performer
        </div>
        <div className="mt-0.5 text-sm font-semibold tabular-nums text-zinc-700 dark:text-zinc-200">
          {acpFmt(revenue)}
        </div>
      </div>
      <div className="flex items-center gap-6">
        <InlineStat label="Conversion" value={`${conversionRate}%`} />
        <InlineStat label="Refund" value={`${refundRate}%`} />
        <span className="text-lg font-bold text-violet-600 dark:text-violet-400">
          {name}
        </span>
      </div>
    </Card>
  );
}

function InlineStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="hidden text-right sm:block">
      <div className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">
        {label}
      </div>
      <div className="text-sm font-semibold tabular-nums text-zinc-700 dark:text-zinc-200">
        {value}
      </div>
    </div>
  );
}

function BatchCard({ batch }: { batch: AcpBatch }) {
  return (
    <Link
      href={`/sales/accelerator/${batch.id}`}
      className={cn(
        "group block rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition-colors",
        "hover:border-violet-300 hover:bg-violet-50/30",
        "dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-violet-900/60 dark:hover:bg-violet-950/10",
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-500 dark:bg-amber-950/40">
          <Zap className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-semibold">{batch.name}</div>
          <div className="mt-0.5 flex items-center gap-1 text-xs text-zinc-500">
            <MapPin className="h-3.5 w-3.5" aria-hidden />
            {batch.location}
          </div>
        </div>
        {batch.at_risk_count > 0 ? (
          <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-600 dark:bg-rose-950/40 dark:text-rose-300">
            {batch.at_risk_count} at risk
          </span>
        ) : null}
      </div>

      <div className="mt-5 flex items-end justify-between">
        <div className="flex gap-6 sm:gap-8">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
              Members
            </div>
            <div className="mt-0.5 text-xl font-bold tabular-nums">
              {batch.total_members}
            </div>
          </div>
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
              Total sprint
            </div>
            <div className="mt-0.5 text-xl font-bold tabular-nums text-amber-600 dark:text-amber-400">
              {acpFmt(batch.sprint_revenue)}
            </div>
          </div>
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
              Rev
            </div>
            <div className="mt-0.5 text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
              {acpFmt(batch.total_revenue)}
            </div>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 text-sm font-medium text-violet-600 transition-transform group-hover:translate-x-0.5 dark:text-violet-400">
          View
          <ChevronRight className="h-4 w-4" aria-hidden />
        </span>
      </div>
    </Link>
  );
}
