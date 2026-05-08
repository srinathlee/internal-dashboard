"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  MoreHorizontal,
  Plus,
  ShieldPlus,
  Trash2,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/layout/page-header";
import { useAuth } from "@/lib/auth";
import { teamDotClass } from "@/lib/format";
import { errorMessage } from "@/lib/hooks/use-async";
import { useSubadmins } from "@/lib/hooks/use-subadmins";
import { useTeams } from "@/lib/hooks/use-teams";
import { cn } from "@/lib/utils";
import type { ApiTeam } from "@/lib/api/teams";

import { AddSalesAdminModal } from "./add-sales-admin-modal";
import { CreateTeamModal } from "./create-team-modal";
import { DeleteTeamModal } from "./delete-team-modal";

/**
 * /teams — Super admin's team directory.
 *
 * Each team card shows the team name + description, the current team admin
 * (with email), member count, and a "View team" link to the detail page.
 *
 * Super admin can:
 *   - Create a new team (also creates that team's admin in one step)
 *   - Delete a team (only when it has no members)
 *   - Drill into a team to manage its admin and members
 *
 * Backed by the new /api/v1/teams endpoints (see
 * docs/BACKEND_SPEC_ROLES_AND_TEAMS.md). If those endpoints aren't live
 * yet, the screen surfaces the API error inline so it's obvious the
 * backend hasn't shipped.
 */
export function TeamsGridScreen() {
  const auth = useAuth();
  const teamsQuery = useTeams();
  // Pull the full sales-subadmins list so we can show the existing-member
  // count on the synthetic Sales card before the team has been created on
  // the backend. limit: 200 mirrors the team detail screen.
  const subadminsQuery = useSubadmins({ limit: 200 });
  const [createOpen, setCreateOpen] = useState(false);
  const [addSalesAdminOpen, setAddSalesAdminOpen] = useState(false);
  const [deleting, setDeleting] = useState<ApiTeam | null>(null);

  if (!auth.isLoaded) return <Skeleton />;

  if (!auth.can("performance:read:all")) {
    return (
      <div className="space-y-6">
        <PageHeader title="Teams" />
        <Card className="p-12 text-center text-sm text-zinc-500">
          You don't have permission to view all teams.
        </Card>
      </div>
    );
  }

  const teams = teamsQuery.data ?? [];
  const hasSalesTeam = teams.some((t) => t.id === "sales");
  const salesMemberCount =
    subadminsQuery.data?.sales_subadmins?.length ?? 0;
  // Synthetic-card count is added to the header total so the bookkeeping
  // stays accurate before the sales team has been formally created.
  const totalMembers =
    teams.reduce((n, t) => n + (t.member_count ?? 0), 0) +
    (hasSalesTeam ? 0 : salesMemberCount);
  const totalCardCount = teams.length + (hasSalesTeam ? 0 : 1);

  const refetchAll = () => {
    void teamsQuery.refetch();
    void subadminsQuery.refetch();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Teams"
        description={
          teamsQuery.data
            ? `${totalCardCount} ${totalCardCount === 1 ? "team" : "teams"} · ${totalMembers} total members`
            : undefined
        }
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden />
            Create team
          </Button>
        }
      />

      {teamsQuery.error ? (
        <Card className="border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-300">
          Couldn't load teams: {errorMessage(teamsQuery.error)}
          <p className="mt-1 text-xs">
            If this returned 404, the team CRUD endpoints aren't deployed
            yet — see{" "}
            <span className="font-mono">
              docs/BACKEND_SPEC_ROLES_AND_TEAMS.md
            </span>
            .
          </p>
        </Card>
      ) : null}

      {teamsQuery.isLoading && teams.length === 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Card key={i} className="h-44 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/*
            The Sales team is special: when the backend has no formal team
            row yet, we still surface a synthetic card pre-populated with the
            count of existing SALES_SUBADMIN users (the "associates"). The
            super admin uses this card to bootstrap a sales admin without
            having to remember the team id/name conventions.
          */}
          {!hasSalesTeam ? (
            <SyntheticSalesCard
              memberCount={salesMemberCount}
              onAddAdmin={() => setAddSalesAdminOpen(true)}
            />
          ) : null}
          {teams.map((team) => (
            <TeamCard
              key={team.id}
              team={team}
              onDelete={() => setDeleting(team)}
            />
          ))}
        </div>
      )}

      <CreateTeamModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={refetchAll}
      />
      <AddSalesAdminModal
        open={addSalesAdminOpen}
        onOpenChange={setAddSalesAdminOpen}
        onCreated={refetchAll}
      />
      <DeleteTeamModal
        open={!!deleting}
        onOpenChange={(o) => {
          if (!o) setDeleting(null);
        }}
        team={deleting}
        onDeleted={refetchAll}
      />
    </div>
  );
}

/**
 * Pre-creation card for the Sales team. Stays visually consistent with
 * TeamCard but swaps the actions: no dropdown menu (no team to delete yet),
 * and the primary CTA is "Add sales admin" instead of "View team". The
 * sales-team metadata (id="sales", name="Sales", description) is fixed at
 * the AddSalesAdminModal layer — the super admin doesn't pick it.
 */
function SyntheticSalesCard({
  memberCount,
  onAddAdmin,
}: {
  memberCount: number;
  onAddAdmin: () => void;
}) {
  return (
    <Card className="flex flex-col gap-5 border-dashed border-indigo-200 bg-indigo-50/30 p-6 transition-colors hover:border-indigo-300 dark:border-indigo-900/40 dark:bg-indigo-950/10 dark:hover:border-indigo-800">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden
            className={cn(
              "h-2.5 w-2.5 shrink-0 rounded-full",
              teamDotClass("sales"),
            )}
          />
          <div className="min-w-0">
            <div className="truncate text-base font-medium tracking-tight">
              Sales
            </div>
            <div className="mt-0.5 truncate text-sm text-zinc-500">
              Outbound deal motion across hospitals & clinics.
            </div>
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          No admin
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <KpiBlock
          label="Team admin"
          value="—"
          hint="Click below to add one"
        />
        <KpiBlock
          label="Members"
          value={String(memberCount)}
          hint={
            memberCount
              ? `${memberCount} ${memberCount === 1 ? "associate" : "associates"} ready`
              : "Empty"
          }
        />
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-indigo-200/60 pt-4 dark:border-indigo-900/40">
        <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500">
          <Users className="h-3.5 w-3.5" aria-hidden />
          sales
        </span>
        <Button size="sm" onClick={onAddAdmin}>
          <ShieldPlus className="h-3.5 w-3.5" aria-hidden />
          Add sales admin
        </Button>
      </div>
    </Card>
  );
}

function TeamCard({
  team,
  onDelete,
}: {
  team: ApiTeam;
  onDelete: () => void;
}) {
  return (
    <Card className="flex flex-col gap-5 p-6 transition-colors hover:border-zinc-300 dark:hover:border-zinc-700">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden
            className={cn(
              "h-2.5 w-2.5 shrink-0 rounded-full",
              teamDotClass(team.id),
            )}
          />
          <div className="min-w-0">
            <div className="truncate text-base font-medium tracking-tight">
              {team.name}
            </div>
            <div className="mt-0.5 truncate text-sm text-zinc-500">
              {team.description || team.id}
            </div>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              aria-label={`Actions for ${team.name}`}
            >
              <MoreHorizontal className="h-4 w-4" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem asChild>
              <Link href={`/teams/${team.id}`}>Open team</Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                onDelete();
              }}
              className="text-rose-600 dark:text-rose-400"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
              Delete team…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <KpiBlock
          label="Team admin"
          value={team.admin?.name ?? "—"}
          hint={team.admin?.email ?? "No admin assigned"}
        />
        <KpiBlock
          label="Members"
          value={String(team.member_count ?? 0)}
          hint={
            team.member_count
              ? `${team.member_count} ${team.member_count === 1 ? "person" : "people"}`
              : "Empty"
          }
        />
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-zinc-100 pt-4 dark:border-zinc-800">
        <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500">
          <Users className="h-3.5 w-3.5" aria-hidden />
          {team.id}
        </span>
        <Link
          href={`/teams/${team.id}`}
          className="inline-flex items-center gap-1 text-sm font-medium text-zinc-700 transition-colors hover:text-indigo-600 dark:text-zinc-300 dark:hover:text-indigo-400"
        >
          View team
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>
    </Card>
  );
}

function KpiBlock({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="min-w-0">
      <div className="truncate text-[10px] font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </div>
      <div className="mt-1 truncate text-base font-semibold">{value}</div>
      {hint && <div className="mt-0.5 truncate text-xs text-zinc-500">{hint}</div>}
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
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="h-44 animate-pulse" />
        <Card className="h-44 animate-pulse" />
      </div>
    </div>
  );
}
