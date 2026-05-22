"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import { LeadsTable } from "@/components/sales/leads/leads-table";
import { LeadDetailSheet } from "@/components/sales/leads/lead-detail-sheet";
import { adaptLead, adaptLeadDetail, toApiStage } from "@/lib/api/adapters";
import { errorMessage } from "@/lib/hooks/use-async";
import { useLead, useLeadMutations, useLeads } from "@/lib/hooks/use-leads";
import type { Lead, LeadStage } from "@/lib/types";

/**
 * Leads tab — every lead this rep added. Clicking a row opens the shared lead
 * detail sheet on the right; stage changes there persist via the leads API.
 */
export function RepLeadsTab({ repId }: { repId: string }) {
  const leadsQuery = useLeads({ sales_user_id: repId, limit: 200 });
  const mutations = useLeadMutations();

  const [leads, setLeads] = useState<Lead[]>([]);
  useEffect(() => {
    if (leadsQuery.data) {
      setLeads(leadsQuery.data.leads.map((l) => adaptLead(l)));
    }
  }, [leadsQuery.data]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Enrich the selected lead with its timeline once the detail loads.
  const detail = useLead(selectedId);
  useEffect(() => {
    if (detail.data) {
      const full = adaptLeadDetail(detail.data);
      setLeads((prev) => prev.map((l) => (l.id === full.id ? full : l)));
    }
  }, [detail.data]);

  const selectedLead = useMemo(
    () => leads.find((l) => l.id === selectedId) ?? null,
    [leads, selectedId],
  );

  const handleChangeStage = async (leadId: string, next: LeadStage) => {
    try {
      const updated = await mutations.setStage(leadId, toApiStage(next));
      const adapted = adaptLead(updated);
      setLeads((prev) =>
        prev.map((l) => (l.id === adapted.id ? { ...l, ...adapted } : l)),
      );
      toast.success("Stage updated");
    } catch (err) {
      toast.error("Couldn't update stage", { description: errorMessage(err) });
    }
  };

  if (leadsQuery.isLoading && leads.length === 0) {
    return <Card className="h-72 animate-pulse" />;
  }
  if (leadsQuery.error) {
    return (
      <Card className="p-8 text-center text-sm text-rose-600 dark:text-rose-400">
        Couldn&apos;t load leads: {errorMessage(leadsQuery.error)}
      </Card>
    );
  }

  return (
    <>
      <div className="mb-3 text-sm text-zinc-500">
        {leads.length} lead{leads.length === 1 ? "" : "s"} added by this rep
      </div>
      <LeadsTable
        leads={leads}
        selectedId={selectedId}
        onRowClick={(lead) => setSelectedId(lead.id)}
        onEditClick={(lead) => setSelectedId(lead.id)}
      />
      <LeadDetailSheet
        lead={selectedLead}
        open={selectedId !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
        onChangeStage={handleChangeStage}
        onMutated={() => {
          leadsQuery.refetch();
          detail.refetch();
        }}
      />
    </>
  );
}
