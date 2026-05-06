"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { TeamManagementBody } from "@/components/team/team-management-body";
import { useAuth } from "@/lib/auth";
import { getTeam } from "@/lib/mock-data";
import type { TeamId } from "@/lib/types";

interface TeamDetailScreenProps {
  teamId: TeamId;
}

/**
 * /teams/[teamId] — Super Admin's drill-down for a specific team.
 * Reuses TeamManagementBody so this is structurally identical to /team
 * but explicitly scoped to the URL-named team.
 */
export function TeamDetailScreen({ teamId }: TeamDetailScreenProps) {
  const auth = useAuth();

  if (!auth.isLoaded) return <Skeleton />;

  const user = auth.user;
  if (!user) {
    return <NoAccessCard message="You're signed out." />;
  }

  // Only super admins land here (admins use /team for their own team).
  if (!auth.can("performance:read:all")) {
    return (
      <div className="space-y-6">
        <PageHeader title="Team" />
        <Card className="p-12 text-center text-sm text-zinc-500">
          You don't have permission to view this team.
        </Card>
      </div>
    );
  }

  const team = getTeam(teamId);

  return (
    <TeamManagementBody
      team={team}
      currentUser={user}
      canInvite={auth.can("user:invite", { teamId: team.id })}
      canEditRole={auth.can("user:assign_role")}
      canDeactivate={auth.can("team:remove_member", { teamId: team.id })}
      title={`${team.name} — members`}
      extraActions={
        <Button variant="ghost" size="sm" asChild>
          <Link href="/teams">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            All teams
          </Link>
        </Button>
      }
    />
  );
}

function NoAccessCard({ message }: { message: string }) {
  return (
    <Card className="p-12 text-center text-sm text-zinc-500">{message}</Card>
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
