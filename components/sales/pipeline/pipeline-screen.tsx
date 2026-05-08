"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/layout/page-header";
import { useAuth } from "@/lib/auth";
import {
  canSeeSalesTabs,
  isSalesAdminOrSuperAdmin,
  isSalesMember,
} from "@/lib/access";
import { resolveActorName } from "@/lib/format";
import { formatCurrency } from "@/lib/format-metric";
import { LEAD_STAGE_LABEL } from "@/lib/sales-leads-data";
import {
  KANBAN_STAGE_ORDER,
  isOpenStage,
} from "@/lib/sales-pipeline";
import { cn } from "@/lib/utils";
import {
  adaptLead,
  toApiReason,
  toApiStage,
} from "@/lib/api/adapters";
import { useLeadMutations, useLeadPeople, usePipeline } from "@/lib/hooks/use-leads";
import { errorMessage } from "@/lib/hooks/use-async";
import type { Lead, LeadLostReason, LeadStage } from "@/lib/types";
import type { User } from "@/lib/types";

import { LeadDetailSheet } from "../leads/lead-detail-sheet";
import { MarkAsLostModal } from "./mark-as-lost-modal";
import { NewLeadDropdown } from "./new-lead-dropdown";
import { PipelineColumn } from "./pipeline-column";
import { SalesRepFilter } from "./sales-rep-filter";

type ActiveFilter = "all" | "active" | "slow";

const SLOW_THRESHOLD_DAYS = 7;

export function PipelineScreen() {
  const auth = useAuth();
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all");
  const [withNextAction, setWithNextAction] = useState(false);
  const [forecastMode, setForecastMode] = useState(false);
  const [selectedReps, setSelectedReps] = useState<string[]>([]);

  const member = isSalesMember(auth);
  const adminLike = isSalesAdminOrSuperAdmin(auth);

  const pipelineQuery = usePipeline({
    q: search.trim() || undefined,
    recency: activeFilter === "slow" ? "stale" : undefined,
    with_next_action: withNextAction || undefined,
  });
  const peopleQuery = useLeadPeople();
  const mutations = useLeadMutations();

  // Local mirror so optimistic stage moves render instantly. Re-seeded on
  // every successful pipeline fetch.
  const [leads, setLeads] = useState<Lead[]>([]);
  useEffect(() => {
    if (!pipelineQuery.data) return;
    const flat = pipelineQuery.data.stages.flatMap((s) => s.leads);
    setLeads(flat.map((l) => adaptLead(l)));
  }, [pipelineQuery.data]);

  const allReps = useMemo<User[]>(() => {
    if (!peopleQuery.data) return [];
    return peopleQuery.data.map((p) => ({
      id: p.id,
      name: p.name,
      email: "",
      role: "member",
      teamId: "sales",
      status: "active",
      joinedAt: "",
      lastActiveAt: "",
    }));
  }, [peopleQuery.data]);

  const ownerScopedLeads = useMemo(() => {
    if (member && auth.user) {
      return leads.filter((l) => l.ownerId === auth.user!.id);
    }
    return leads;
  }, [leads, member, auth.user]);

  const repCountsById = useMemo(() => {
    const out: Record<string, number> = {};
    for (const lead of ownerScopedLeads) {
      out[lead.ownerId] = (out[lead.ownerId] ?? 0) + 1;
    }
    return out;
  }, [ownerScopedLeads]);

  const visibleLeads = useMemo(() => {
    return ownerScopedLeads.filter((l) => {
      if (
        adminLike &&
        selectedReps.length > 0 &&
        !selectedReps.includes(l.ownerId)
      )
        return false;
      if (activeFilter === "active" && !isOpenStage(l.stage)) return false;
      if (activeFilter === "slow") {
        if (!isOpenStage(l.stage)) return false;
        const ageDays =
          (Date.now() - Date.parse(l.lastActivityAt)) / 86_400_000;
        if (ageDays < SLOW_THRESHOLD_DAYS) return false;
      }
      return true;
    });
  }, [ownerScopedLeads, adminLike, selectedReps, activeFilter]);

  const summary = useMemo(() => {
    const m = pipelineQuery.data?.metrics;
    return {
      openValue: m?.open_pipeline_value ?? 0,
      openCount: m?.active_lead_count ?? 0,
      weightedForecast: m?.weighted_forecast_value ?? 0,
      closedWonValue: m?.closed_won_value ?? 0,
      closedWonCount: m?.won_count ?? 0,
      lostCount: m?.lost_count ?? 0,
      winRatePct:
        (m?.won_count ?? 0) + (m?.lost_count ?? 0) === 0
          ? null
          : ((m?.won_count ?? 0) /
              ((m?.won_count ?? 0) + (m?.lost_count ?? 0))) *
            100,
    };
  }, [pipelineQuery.data]);

  const leadsByStage = useMemo(() => {
    const groups: Record<LeadStage, Lead[]> = {
      "cold-lead": [],
      "first-contact": [],
      "doctor-meeting": [],
      "pitch-delivered": [],
      "hot-lead": [],
      "sprint-started": [],
      "sprint-review": [],
      "subscription-closed": [],
      lost: [],
    };
    for (const lead of visibleLeads) groups[lead.stage].push(lead);
    return groups;
  }, [visibleLeads]);

  const findLead = (id: string) => leads.find((l) => l.id === id) ?? null;

  // Detail sheet
  const [openLeadId, setOpenLeadId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const [draggingId, setDraggingId] = useState<string | null>(null);

  const [lostLead, setLostLead] = useState<Lead | null>(null);
  const [lostOpen, setLostOpen] = useState(false);

  if (!auth.isLoaded) return <Skeleton />;

  if (!canSeeSalesTabs(auth)) {
    return (
      <div className="space-y-6">
        <PageHeader title="Sales pipeline" />
        <Card className="p-12 text-center text-sm text-zinc-500">
          You don't have permission to view the sales pipeline.
        </Card>
      </div>
    );
  }

  const moveLeadOptimistic = (
    leadId: string,
    nextStage: LeadStage,
    extras?: { lostReason?: LeadLostReason; lostNotes?: string },
  ) => {
    setLeads((prev) => {
      const idx = prev.findIndex((l) => l.id === leadId);
      if (idx === -1) return prev;
      const lead = prev[idx]!;
      if (lead.stage === nextStage && !extras) return prev;
      const now = new Date().toISOString();
      const event = {
        id: `${leadId}_t${Date.now()}`,
        actorId: auth.user?.id ?? lead.ownerId,
        actorName: resolveActorName(auth.user, lead.ownerId, lead.ownerName),
        timestamp: now,
        type: "stage-change" as const,
        fromStage: lead.stage,
        toStage: nextStage,
      };
      const next: Lead = {
        ...lead,
        stage: nextStage,
        lastActivityAt: now,
        timeline: [...lead.timeline, event],
        ...(nextStage === "lost"
          ? {
              lostReason: extras?.lostReason ?? lead.lostReason,
              lostNotes: extras?.lostNotes ?? lead.lostNotes,
            }
          : { lostReason: undefined, lostNotes: undefined }),
      };
      const copy = [...prev];
      copy[idx] = next;
      return copy;
    });
  };

  const persistMove = async (
    leadId: string,
    nextStage: LeadStage,
    extras?: { lostReason?: LeadLostReason; lostNotes?: string },
  ) => {
    try {
      if (nextStage === "lost") {
        if (!extras?.lostReason) return;
        await mutations.markLost(leadId, {
          reason: toApiReason(extras.lostReason),
          notes: extras.lostNotes,
        });
      } else {
        await mutations.setStage(leadId, toApiStage(nextStage));
      }
    } catch (err) {
      toast.error("Stage update failed", { description: errorMessage(err) });
      // Refresh from server to revert optimism.
      void pipelineQuery.refetch();
    }
  };

  const handleDropOnColumn = (stage: LeadStage) => {
    const id = draggingId;
    setDraggingId(null);
    if (!id) return;
    const lead = findLead(id);
    if (!lead || lead.stage === stage) return;

    if (stage === "lost") {
      setLostLead(lead);
      setLostOpen(true);
      return;
    }

    moveLeadOptimistic(id, stage);
    void persistMove(id, stage);
    toast.success(`Moved to ${LEAD_STAGE_LABEL[stage]}`, {
      description: lead.clinicName,
    });
  };

  const handleConfirmLost = (
    leadId: string,
    reason: LeadLostReason,
    notes: string,
  ) => {
    moveLeadOptimistic(leadId, "lost", {
      lostReason: reason,
      lostNotes: notes,
    });
    void persistMove(leadId, "lost", { lostReason: reason, lostNotes: notes });
    toast.success("Marked as lost", {
      description: findLead(leadId)?.clinicName ?? undefined,
    });
    setLostLead(null);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Sales pipeline"
        description="Drag cards between stages — every move logs to the timeline. Moving to LOST asks for a reason."
        actions={<NewLeadDropdown />}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryTile
          label="Open pipeline"
          value={formatCurrency(summary.openValue, "INR")}
          hint={`${summary.openCount} active deal${summary.openCount === 1 ? "" : "s"}`}
        />
        <SummaryTile
          label="Weighted forecast"
          value={formatCurrency(summary.weightedForecast, "INR")}
          hint="By stage probability"
        />
        <SummaryTile
          label="Closed won"
          value={formatCurrency(summary.closedWonValue, "INR")}
          hint={`${summary.closedWonCount} subscription${summary.closedWonCount === 1 ? "" : "s"}`}
        />
        <SummaryTile
          label="Win rate"
          value={
            summary.winRatePct === null
              ? "—"
              : `${Math.round(summary.winRatePct)}%`
          }
          hint={`${summary.closedWonCount} won · ${summary.lostCount} lost`}
        />
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
          />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clinic, doctor, city..."
            className="h-10 pl-9"
            aria-label="Search pipeline"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {adminLike ? (
            <SalesRepFilter
              reps={allReps}
              selected={selectedReps}
              onChange={setSelectedReps}
              countsById={repCountsById}
            />
          ) : null}

          <SegmentedFilter
            value={activeFilter}
            onChange={setActiveFilter}
            options={[
              { value: "all", label: "All" },
              { value: "active", label: "Active" },
              { value: "slow", label: "Slow" },
            ]}
          />

          <ToggleChip
            active={withNextAction}
            onClick={() => setWithNextAction((v) => !v)}
            label="With next action"
          />
          <ToggleChip
            active={forecastMode}
            onClick={() => setForecastMode((v) => !v)}
            label="Forecast mode"
          />
        </div>
      </div>

      {pipelineQuery.error && (
        <Card className="border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-300">
          Couldn't load pipeline: {errorMessage(pipelineQuery.error)}
        </Card>
      )}

      <div className="-mx-4 overflow-x-auto px-4 pb-4">
        <div className="flex gap-3">
          {KANBAN_STAGE_ORDER.map((stage) => (
            <PipelineColumn
              key={stage}
              stage={stage}
              leads={leadsByStage[stage]}
              forecastMode={forecastMode}
              draggingId={draggingId}
              onDragStartCard={(lead) => setDraggingId(lead.id)}
              onDragEndCard={() => setDraggingId(null)}
              onDropOnColumn={handleDropOnColumn}
              onCardClick={(lead) => {
                setOpenLeadId(lead.id);
                setSheetOpen(true);
              }}
            />
          ))}
        </div>
      </div>

      <LeadDetailSheet
        lead={openLeadId ? findLead(openLeadId) : null}
        open={sheetOpen}
        onOpenChange={(open) => {
          setSheetOpen(open);
          if (!open) {
            window.setTimeout(() => setOpenLeadId(null), 200);
          }
        }}
        onChangeStage={(leadId, next) => {
          if (next === "lost") {
            const lead = findLead(leadId);
            if (lead) {
              setLostLead(lead);
              setLostOpen(true);
            }
            return;
          }
          moveLeadOptimistic(leadId, next);
          void persistMove(leadId, next);
          toast.success(`Stage updated → ${LEAD_STAGE_LABEL[next]}`);
        }}
        onMutated={() => {
          // Refresh the pipeline so last_activity_at and recency buckets
          // line up with the new event. The sheet's lead prop comes from
          // pipeline state, so refetching is enough — no separate detail
          // call here.
          void pipelineQuery.refetch();
        }}
      />

      <MarkAsLostModal
        lead={lostLead}
        open={lostOpen}
        onOpenChange={(open) => {
          setLostOpen(open);
          if (!open) {
            window.setTimeout(() => setLostLead(null), 200);
          }
        }}
        onConfirm={handleConfirmLost}
      />
    </div>
  );
}

function SummaryTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Card className="p-4">
      <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
        {value}
      </div>
      <div className="mt-1 text-xs text-zinc-500">{hint}</div>
    </Card>
  );
}

function SegmentedFilter<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="inline-flex h-9 items-center rounded-lg border border-zinc-200 bg-white p-0.5 dark:border-zinc-800 dark:bg-zinc-950">
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "h-7 rounded-md px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function ToggleChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
          : "border-zinc-200 bg-white text-zinc-600 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-100",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "relative inline-flex h-3.5 w-6 shrink-0 items-center rounded-full transition-colors",
          active ? "bg-emerald-400" : "bg-zinc-300 dark:bg-zinc-700",
        )}
      >
        <span
          className={cn(
            "absolute h-2.5 w-2.5 rounded-full bg-white shadow-sm transition-transform",
            active ? "translate-x-3" : "translate-x-0.5",
          )}
        />
      </span>
      <span>{label}</span>
    </button>
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
          <Card key={i} className="h-24 animate-pulse" />
        ))}
      </div>
      <Card className="h-72 animate-pulse" />
    </div>
  );
}
