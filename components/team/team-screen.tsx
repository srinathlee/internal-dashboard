"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { useAuth } from "@/lib/auth";
import { getTeam } from "@/lib/mock-data";

import { TeamManagementBody } from "./team-management-body";

/**
 * /team route — the admin view onto their own team.
 * Super admin redirects to /teams; member sees a no-access card.
 */
export function TeamScreen() {
  const auth = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (auth.isLoaded && auth.user?.role === "super_admin") {
      router.replace("/teams");
    }
  }, [auth.isLoaded, auth.user?.role, router]);

  if (!auth.isLoaded) return <TeamSkeleton />;

  const user = auth.user;
  if (!user) return <NoAccessCard message="You're signed out." />;

  if (!auth.can("team:add_member") && !auth.can("team:remove_member")) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Team"
          description="Member roster and team controls."
        />
        <NoAccessCard message="You don't have permission to manage team members." />
      </div>
    );
  }

  if (user.role === "super_admin") return <TeamSkeleton />;

  if (!user.teamId) {
    return (
      <div className="space-y-6">
        <PageHeader title="Team" />
        <NoAccessCard message="You're not assigned to a team yet." />
      </div>
    );
  }

  const team = getTeam(user.teamId);
  return (
    <TeamManagementBody
      team={team}
      currentUser={user}
      canInvite={auth.can("user:invite", { teamId: team.id })}
      canEditRole={auth.can("user:assign_role")}
      canDeactivate={auth.can("team:remove_member", { teamId: team.id })}
    />
  );
}

function NoAccessCard({ message }: { message: string }) {
  return (
    <Card className="p-12 text-center text-sm text-zinc-500">{message}</Card>
  );
}

function TeamSkeleton() {
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
