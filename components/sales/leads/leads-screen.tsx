"use client";

import { useMemo, useState } from "react";
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
  leads as seedLeads,
} from "@/lib/sales-leads-data";
import type { Lead, LeadStage } from "@/lib/types";

import { LeadsTable } from "./leads-table";
import { LeadDetailSheet } from "./lead-detail-sheet";
import { EditLeadModal, type LeadPatch } from "./edit-lead-modal";

const ALL_STAGES = "__all__";

export function LeadsScreen() {
  const auth = useAuth();
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string>(ALL_STAGES);

  // Local mutable copy of leads so stage changes from the detail sheet are
  // reflected immediately in the table. Mutations don't persist across
  // navigation (no backend in v1) — that's the same trade-off as Phase 5
  // member management.
  const [leads, setLeads] = useState<Lead[]>(seedLeads);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((l) => {
      if (stageFilter !== ALL_STAGES && l.stage !== stageFilter) return false;
      if (!q) return true;
      return (
        l.clinicName.toLowerCase().includes(q) ||
        l.doctorName.toLowerCase().includes(q) ||
        l.phone.includes(q) ||
        l.city.toLowerCase().includes(q)
      );
    });
  }, [leads, search, stageFilter]);

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

  const handleRowClick = (lead: Lead) => {
    setSelectedId(lead.id);
    setSheetOpen(true);
  };

  const handleSheetOpenChange = (open: boolean) => {
    setSheetOpen(open);
    // Defer clearing the selected row until the sheet actually closes —
    // otherwise the detail body unmounts mid-animation.
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
      // Defer clearing the editing id so the form doesn't reset mid-animation.
      window.setTimeout(() => setEditingId(null), 200);
    }
  };

  const handleSaveLead = (leadId: string, patch: LeadPatch) => {
    setLeads((prev) => {
      const idx = prev.findIndex((l) => l.id === leadId);
      if (idx === -1) return prev;
      const lead = prev[idx]!;
      const stageChanged = lead.stage !== patch.stage;
      const now = new Date().toISOString();
      const updated: Lead = {
        ...lead,
        ...patch,
        lastActivityAt: now,
        // If the editor moved the stage, append a stage-change event so the
        // timeline reflects the transition (matches the inline Change select).
        timeline: stageChanged
          ? [
              ...lead.timeline,
              {
                id: `${leadId}_t${Date.now()}`,
                actorId: auth.user?.id ?? lead.ownerId,
                timestamp: now,
                type: "stage-change" as const,
                fromStage: lead.stage,
                toStage: patch.stage,
              },
            ]
          : lead.timeline,
      };
      const copy = [...prev];
      copy[idx] = updated;
      return copy;
    });
  };

  const handleChangeStage = (leadId: string, next: LeadStage) => {
    setLeads((prev) => {
      const idx = prev.findIndex((l) => l.id === leadId);
      if (idx === -1) return prev;
      const lead = prev[idx]!;
      if (lead.stage === next) return prev;
      const now = new Date().toISOString();
      const newEvent = {
        id: `${leadId}_t${Date.now()}`,
        actorId: auth.user?.id ?? lead.ownerId,
        timestamp: now,
        type: "stage-change" as const,
        fromStage: lead.stage,
        toStage: next,
      };
      const updated: Lead = {
        ...lead,
        stage: next,
        lastActivityAt: now,
        timeline: [...lead.timeline, newEvent],
      };
      const copy = [...prev];
      copy[idx] = updated;
      return copy;
    });
    toast.success(
      `Stage updated → ${LEAD_STAGE_LABEL[next]}`,
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales leads"
        description="Capture and track hospital leads (API-aligned fields)."
        actions={
          <Button
            onClick={() => toast.info("New lead form — Phase 2")}
          >
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

      <LeadsTable
        leads={filtered}
        selectedId={selectedId}
        onRowClick={handleRowClick}
        onEditClick={handleEditClick}
      />

      <LeadDetailSheet
        lead={selected}
        open={sheetOpen}
        onOpenChange={handleSheetOpenChange}
        onChangeStage={handleChangeStage}
      />

      <EditLeadModal
        lead={editing}
        open={editOpen}
        onOpenChange={handleEditOpenChange}
        onSave={handleSaveLead}
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
