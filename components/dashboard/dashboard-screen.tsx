"use client";

import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";

import { MemberDashboard } from "./member-dashboard";
import { AdminDashboard } from "./admin-dashboard";
import { SuperAdminDashboard } from "./super-admin-dashboard";

/**
 * Picks the right role-adaptive dashboard.
 *
 * The selection uses the user's role directly here — but only here. Every
 * downstream conditional (sidebar, buttons, action visibility) goes through
 * `can()`. We treat the dashboard variant as a *layout* concern, not a
 * permissions one — three roles map to three fundamentally different page
 * structures, not to "the same page with extra buttons."
 */
export function DashboardScreen() {
  const { user, isLoaded } = useAuth();

  if (!isLoaded) {
    return <DashboardSkeleton />;
  }
  if (!user) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dashboard" />
        <Card className="p-12 text-center text-sm text-zinc-500">
          You're signed out.
        </Card>
      </div>
    );
  }

  switch (user.role) {
    case "super_admin":
      return <SuperAdminDashboard />;
    case "admin":
      return <AdminDashboard user={user} />;
    case "member":
      return <MemberDashboard user={user} />;
  }
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-7 w-48 animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-800" />
        <div className="h-4 w-72 animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-800" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="h-28 animate-pulse" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="h-72 animate-pulse lg:col-span-2" />
        <Card className="h-72 animate-pulse" />
      </div>
    </div>
  );
}
