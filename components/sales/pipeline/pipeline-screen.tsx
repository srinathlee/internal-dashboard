"use client";

import { useMemo, useState } from "react";
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
import { formatCurrency } from "@/lib/format-metric";
import { users } from "@/lib/mock-data";
import { leads as seedLeads, LEAD_STAGE_LABEL } from "@/lib/sales-leads-data";
import {
  KANBAN_STAGE_ORDER,
  isOpenStage,
  summarizePipeline,
} from "@/lib/sales-pipeline";
import { cn } from "@/lib/utils";
import type { Lead, LeadLostReason, LeadStage } from "@/lib/types";

import { LeadDetailSheet } from "../leads/lead-detail-sheet";
import { MarkAsLostModal } from "./mark-as-lost-modal";
import { NewLeadDropdown } from "./new-lead-dropdown";
import { PipelineColumn } from "./pipeline-column";
import { SalesRepFilter } from "./sales-rep-filter";

type ActiveFilter = "all" | "active" | "slow";

// "Slow" = open lead with no activity for 7+ days. Tuned to the seed data so
// at least one card surfaces; revisit when real activity volume is higher.
const SLOW_THRESHOLD_DAYS = 7;
const NOW_MS = Date.parse("2026-05-05T12:00:00.000Z");

export function PipelineScreen() {
  const auth = useAuth();
  const [leads, setLeads] = useState<Lead[]>(seedLeads);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all");
  const [withNextAction, setWithNextAction] = useState(false);
  const [forecastMode, setForecastMode] = useState(false);
  const [selectedReps, setSelectedReps] = useState<string[]>([]);

  // Detail sheet
  const [openLeadId, setOpenLeadId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Drag state
  const [draggingId, setDraggingId] = useState<string | null>(null);

  // Mark-as-lost flow
  const [lostLead, setLostLead] = useState<Lead | null>(null);
  const [lostOpen, setLostOpen] = useState(false);

  const member = isSalesMember(auth);
  const adminLike = isSalesAdminOrSuperAdmin(auth);

  // Sales reps available in the rep filter (admins/super-admins only).
  const allReps = useMemo(
    () => users.filter((u) => u.teamId === "sales" && u.role === "member"),
    [],
  );

  // Sales members only ever see their own leads. The rep filter is hidden
  // for them, so we shortcut by ownerId.
  const ownerScopedLeads = useMemo(() => {
    if (member && auth.user) {
      return leads.filter((l) => l.ownerId === auth.user!.id);
    }
    return leads;
  }, [leads, member, auth.user]);

  // Per-rep counts feed the rep-filter popover. Computed before the rep
  // filter is applied so the totals stay stable as the user toggles reps.
  const repCountsById = useMemo(() => {
    const out: Record<string, number> = {};
    for (const lead of ownerScopedLeads) {
      out[lead.ownerId] = (out[lead.ownerId] ?? 0) + 1;
    }
    return out;
  }, [ownerScopedLeads]);

  const visibleLeads = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ownerScopedLeads.filter((l) => {
      if (adminLike && selectedReps.length > 0 && !selectedReps.includes(l.ownerId)) {
        return false;
      }
      if (activeFilter === "active" && !isOpenStage(l.stage)) return false;
      if (activeFilter === "slow") {
        if (!isOpenStage(l.stage)) return false;
        const ageDays = (NOW_MS - Date.parse(l.lastActivityAt)) / 86_400_000;
        if (ageDays < SLOW_THRESHOLD_DAYS) return false;
      }
      if (withNextAction && !l.nextAction) return false;
      if (q) {
        const hay =
          `${l.clinicName} ${l.doctorName} ${l.phone} ${l.city}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [
    ownerScopedLeads,
    adminLike,
    selectedReps,
    activeFilter,
    withNextAction,
    search,
  ]);

  const summary = useMemo(() => summarizePipeline(visibleLeads), [visibleLeads]);

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

  const moveLead = (
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
        timestamp: now,
        type: "stage-change" as const,
        fromStage: lead.stage,
        toStage: nextStage,
        ...(extras?.lostReason || extras?.lostNotes
          ? {
              content: [
                extras?.lostReason ? `Lost reason: ${extras.lostReason}` : null,
                extras?.lostNotes ? extras.lostNotes : null,
              ]
                .filter(Boolean)
                .join(" — "),
            }
          : {}),
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
          : {
              lostReason: undefined,
              lostNotes: undefined,
            }),
      };
      const copy = [...prev];
      copy[idx] = next;
      return copy;
    });
  };

  const handleDropOnColumn = (stage: LeadStage) => {
    const id = draggingId;
    setDraggingId(null);
    if (!id) return;
    const lead = findLead(id);
    if (!lead || lead.stage === stage) return;

    if (stage === "lost") {
      // Hold the move until the rep confirms a reason.
      setLostLead(lead);
      setLostOpen(true);
      return;
    }

    moveLead(id, stage);
    toast.success(`Moved to ${LEAD_STAGE_LABEL[stage]}`, {
      description: lead.clinicName,
    });
  };

  const handleConfirmLost = (
    leadId: string,
    reason: LeadLostReason,
    notes: string,
  ) => {
    moveLead(leadId, "lost", { lostReason: reason, lostNotes: notes });
    const lead = findLead(leadId);
    toast.success("Marked as lost", {
      description: lead?.clinicName ?? undefined,
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
          value={summary.winRatePct === null ? "—" : `${Math.round(summary.winRatePct)}%`}
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

      <div
        className="-mx-4 overflow-x-auto px-4 pb-4"
        // Dragging cards near the edge should auto-pan eventually; for v1 we
        // rely on standard horizontal scroll inside this wrapper.
      >
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
          moveLead(leadId, next);
          toast.success(`Stage updated → ${LEAD_STAGE_LABEL[next]}`);
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
