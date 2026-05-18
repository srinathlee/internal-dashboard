"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/layout/page-header";
import { useAuth } from "@/lib/auth";
import { canSeeSalesTabs } from "@/lib/access";
import {
  LEAD_STAGE_LABEL,
  LEAD_STAGE_ORDER,
} from "@/lib/sales-leads-data";
import { useLeads, useLeadMutations } from "@/lib/hooks/use-leads";
import { errorMessage } from "@/lib/hooks/use-async";
import {
  adaptLead,
  adaptLeadDetail,
  toApiStage,
} from "@/lib/api/adapters";
import { getLead } from "@/lib/api/sales-leads";
import { resolveActorName } from "@/lib/format";
import type { Lead, LeadStage } from "@/lib/types";

import { LeadsTable } from "./leads-table";
import { LeadDetailSheet } from "./lead-detail-sheet";
import { EditLeadModal, type LeadPatch } from "./edit-lead-modal";
import { NewLeadModal, type NewLeadInput } from "./new-lead-modal";

const ALL_STAGES = "__all__";

export function LeadsScreen() {
  const auth = useAuth();
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string>(ALL_STAGES);

  const leadsQuery = useLeads({
    q: search.trim() || undefined,
    stage:
      stageFilter !== ALL_STAGES
        ? toApiStage(stageFilter as LeadStage)
        : undefined,
    limit: 100,
  });
  const mutations = useLeadMutations();

  // Local mirror — adapted from API for use with existing UI components, and
  // mutated optimistically so stage changes from the detail sheet update the
  // table immediately. Re-seeded whenever the underlying query refreshes.
  const [leads, setLeads] = useState<Lead[]>([]);
  useEffect(() => {
    if (leadsQuery.data) {
      setLeads(leadsQuery.data.leads.map((l) => adaptLead(l)));
    }
  }, [leadsQuery.data]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [newLeadOpen, setNewLeadOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const canDeleteLeads = auth.user?.role === "super_admin";

  const filtered = useMemo(() => {
    // Server-side search/stage already applied; this just guards against any
    // local-only refinement we may add (e.g. owner filter).
    return leads;
  }, [leads]);

  const selected = useMemo(
    () => leads.find((l) => l.id === selectedId) ?? null,
    [leads, selectedId],
  );

  const editing = useMemo(
    () => leads.find((l) => l.id === editingId) ?? null,
    [leads, editingId],
  );

  if (!auth.isLoaded) return <Skeleton />;

  if (!canSeeSalesTabs(auth)) {
    return (
      <div className="space-y-6">
        <PageHeader title="Leads" />
        <Card className="p-12 text-center text-sm text-zinc-500">
          You don't have permission to view sales leads.
        </Card>
      </div>
    );
  }

  const handleRowClick = async (lead: Lead) => {
    setSelectedId(lead.id);
    setSheetOpen(true);
    // Hydrate the timeline from the detail endpoint so the sheet has the full
    // history. List endpoint doesn't include timeline.
    try {
      const detail = await getLead(lead.id);
      const full = adaptLeadDetail(detail);
      setLeads((prev) => prev.map((l) => (l.id === full.id ? full : l)));
    } catch {
      // Sheet still renders with whatever we already have.
    }
  };

  const handleSheetOpenChange = (open: boolean) => {
    setSheetOpen(open);
    if (!open) {
      window.setTimeout(() => setSelectedId(null), 200);
    }
  };

  const handleEditClick = (lead: Lead) => {
    setEditingId(lead.id);
    setEditOpen(true);
  };

  const handleEditOpenChange = (open: boolean) => {
    setEditOpen(open);
    if (!open) {
      window.setTimeout(() => setEditingId(null), 200);
    }
  };

  const handleDeleteClick = async (lead: Lead) => {
    if (!canDeleteLeads) return;
    const confirmed = window.confirm(
      `Delete lead "${lead.clinicName}"? This permanently removes the lead and its history. This action cannot be undone.`,
    );
    if (!confirmed) return;

    setDeletingId(lead.id);
    try {
      await mutations.delete(lead.id);
      // Optimistically drop the row so the UI reacts immediately, then
      // refresh from the server so totals/pagination stay accurate.
      setLeads((prev) => prev.filter((l) => l.id !== lead.id));
      if (selectedId === lead.id) {
        setSheetOpen(false);
        setSelectedId(null);
      }
      if (editingId === lead.id) {
        setEditOpen(false);
        setEditingId(null);
      }
      toast.success(`"${lead.clinicName}" deleted`);
      void leadsQuery.refetch();
    } catch (err) {
      toast.error("Couldn't delete lead", {
        description: errorMessage(err),
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleSaveLead = async (leadId: string, patch: LeadPatch) => {
    const original = leads.find((l) => l.id === leadId);
    if (!original) return;
    const stageChanged = original.stage !== patch.stage;

    try {
      const updated = await mutations.update(leadId, {
        clinic_name: patch.clinicName,
        doctor_name: patch.doctorName,
        specialization: patch.specialization,
        phone: patch.phone,
        city: patch.city,
        area: patch.area,
        address: patch.address,
        lead_source: patch.source,
        monthly_appointments: patch.monthlyAppointments,
        number_of_branches: patch.branches,
        estimated_value: patch.value,
        notes: patch.notes,
      });
      // Stage changes go through the dedicated endpoint so the backend
      // appends a stage_change activity (the doc explicitly forbids passing
      // stage in PUT for lost transitions).
      if (stageChanged) {
        await mutations.setStage(leadId, toApiStage(patch.stage));
      }
      const adapted = adaptLead(updated);
      setLeads((prev) =>
        prev.map((l) =>
          l.id === leadId
            ? {
                ...adapted,
                stage: patch.stage,
                timeline: l.timeline,
              }
            : l,
        ),
      );
    } catch (err) {
      toast.error("Failed to update lead", {
        description: errorMessage(err),
      });
    }
  };

  const handleCreateLead = async (input: NewLeadInput) => {
    try {
      const created = await mutations.create({
        clinic_name: input.clinicName,
        doctor_name: input.doctorName,
        specialization: input.specialization || undefined,
        phone: input.phone,
        city: input.city,
        area: input.area || undefined,
        address: input.address || undefined,
        lead_source: input.source,
        stage: toApiStage(input.stage),
        monthly_appointments: input.monthlyAppointments,
        number_of_branches: input.branches,
        estimated_value: input.value,
        notes: input.notes || undefined,
      });
      // Prepend optimistically so the new row is visible without a full
      // refetch. The next time leadsQuery refreshes the canonical list will
      // replace this entry — IDs match so React reuses the row.
      const adapted = adaptLead(created);
      setLeads((prev) => [adapted, ...prev]);
      void leadsQuery.refetch();
    } catch (err) {
      toast.error("Couldn't create lead", {
        description: errorMessage(err),
      });
      throw err;
    }
  };

  const handleChangeStage = async (leadId: string, next: LeadStage) => {
    const lead = leads.find((l) => l.id === leadId);
    if (!lead || lead.stage === next) return;
    if (next === "lost") {
      // Lost transitions require a reason — handled by the pipeline's
      // mark-as-lost modal, not the inline picker.
      toast.error("Use the Mark as lost flow on the pipeline page.");
      return;
    }
    try {
      // Moving OUT of "lost" needs the dedicated /restore endpoint first;
      // /stage alone won't clear the lost state on the backend, so the
      // lead stays hidden from the open pipeline buckets.
      if (lead.stage === "lost") {
        await mutations.restore(leadId);
      }
      const updated = await mutations.setStage(leadId, toApiStage(next));
      const adapted = adaptLead(updated);
      setLeads((prev) =>
        prev.map((l) =>
          l.id === leadId
            ? {
                ...adapted,
                timeline: [
                  ...l.timeline,
                  {
                    id: `${leadId}_t${Date.now()}`,
                    actorId: auth.user?.id ?? l.ownerId,
                    // Prefer ownerName when the current user owns the lead
                    // (most common case for members). Then fall through the
                    // auth user's name, skipping the "User" sentinel that
                    // mapAuthMeToUser uses when /auth/me has no name field.
                    actorName: resolveActorName(auth.user, l.ownerId, l.ownerName),
                    timestamp: new Date().toISOString(),
                    type: "stage-change" as const,
                    fromStage: l.stage,
                    toStage: next,
                  },
                ],
              }
            : l,
        ),
      );
      toast.success(
        `Stage updated → ${LEAD_STAGE_LABEL[next as keyof typeof LEAD_STAGE_LABEL] ?? next}`,
      );
    } catch (err) {
      toast.error("Stage update failed", {
        description: errorMessage(err),
      });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales leads"
        description="Capture and track hospital leads (API-aligned fields)."
        actions={
          <Button onClick={() => setNewLeadOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden />
            New lead
          </Button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
          />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clinic, doctor, phone, city…"
            className="h-10 pl-9"
            aria-label="Search leads"
          />
        </div>
        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger
            className="h-10 w-full sm:w-[12rem]"
            aria-label="Filter by stage"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_STAGES}>All stages</SelectItem>
            {LEAD_STAGE_ORDER.map((s) => (
              <SelectItem key={s} value={s}>
                {LEAD_STAGE_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {leadsQuery.error && (
        <Card className="border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-300">
          Couldn't load leads: {errorMessage(leadsQuery.error)}
        </Card>
      )}

      {leadsQuery.isLoading && leads.length === 0 ? (
        <Card className="h-72 animate-pulse" />
      ) : (
        <LeadsTable
          leads={filtered}
          selectedId={selectedId}
          onRowClick={handleRowClick}
          onEditClick={handleEditClick}
          onDeleteClick={canDeleteLeads ? handleDeleteClick : undefined}
          deletingId={deletingId}
        />
      )}

      <LeadDetailSheet
        lead={selected}
        open={sheetOpen}
        onOpenChange={handleSheetOpenChange}
        onChangeStage={handleChangeStage}
        onMutated={async () => {
          // Refresh the list so last_activity_at and the row preview pick
          // up the new event. Then re-hydrate the open sheet's timeline
          // from the detail endpoint (the list endpoint omits timeline).
          void leadsQuery.refetch();
          if (selectedId) {
            try {
              const detail = await getLead(selectedId);
              const full = adaptLeadDetail(detail);
              setLeads((prev) =>
                prev.map((l) => (l.id === full.id ? full : l)),
              );
            } catch {
              /* sheet stays on prior data */
            }
          }
        }}
      />

      <EditLeadModal
        lead={editing}
        open={editOpen}
        onOpenChange={handleEditOpenChange}
        onSave={handleSaveLead}
      />

      <NewLeadModal
        open={newLeadOpen}
        onOpenChange={setNewLeadOpen}
        onCreate={handleCreateLead}
      />
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
      <Card className="h-12 animate-pulse" />
      <Card className="h-72 animate-pulse" />
    </div>
  );
}
