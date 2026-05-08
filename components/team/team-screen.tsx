"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { useAuth } from "@/lib/auth";

import { TeamDetailScreen } from "@/components/teams/team-detail-screen";

/**
 * /team — the team-scoped admin's view of their own team.
 *
 * Behavior by role:
 *   - SUPER_ADMIN  -> redirected to /teams (the multi-team list)
 *   - SALES_ADMIN  -> renders TeamDetailScreen for their own teamId
 *                     (same surface super admin sees at /teams/[teamId],
 *                     but with super-admin-only actions hidden)
 *   - SALES_SUBADMIN / no team -> no-access card
 *
 * Rendering the same component (rather than redirecting to /teams/:id)
 * keeps the sidebar's active-state highlighting correct — the sidebar
 * "Team" item points at /team, and href matching needs the URL to stay
 * on /team for that admin.
 */
export function TeamScreen() {
  const auth = useAuth();
  const router = useRouter();
  const { user, isLoaded } = auth;

  useEffect(() => {
    if (isLoaded && user?.role === "super_admin") {
      router.replace("/teams");
    }
  }, [isLoaded, user?.role, router]);

  if (!isLoaded) return <TeamSkeleton />;
  if (!user) return <NoAccessCard message="You're signed out." />;

  if (user.role === "super_admin") return <TeamSkeleton />;

  if (user.role === "member") {
    return (
      <div className="space-y-6">
        <PageHeader title="Team" />
        <NoAccessCard message="Members don't have access to team management." />
      </div>
    );
  }

  if (!user.teamId) {
    return (
      <div className="space-y-6">
        <PageHeader title="Team" />
        <NoAccessCard message="You're not assigned to a team yet." />
      </div>
    );
  }

  return <TeamDetailScreen teamId={user.teamId} />;
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
