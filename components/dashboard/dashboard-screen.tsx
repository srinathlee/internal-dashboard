"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";

import { MemberDashboard } from "./member-dashboard";
import { SuperAdminDashboard } from "./super-admin-dashboard";

/**
 * Picks the role-adaptive dashboard.
 *
 *   super_admin -> SuperAdminDashboard (org overview)
 *   admin       -> redirected to /sales/leads (sales admins live in the
 *                  sales tabs; no separate dashboard surface)
 *   member      -> MemberDashboard (personal overview)
 */
export function DashboardScreen() {
  const auth = useAuth();
  const router = useRouter();
  const { user, isLoaded } = auth;

  // Team admins (currently only sales admin) don't have a dashboard view;
  // bounce them to their primary surface.
  const shouldRedirectAdmin = isLoaded && user?.role === "admin";
  useEffect(() => {
    if (shouldRedirectAdmin) router.replace("/sales/leads");
  }, [shouldRedirectAdmin, router]);

  if (!isLoaded || shouldRedirectAdmin) {
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
      // Unreachable — useEffect above redirects. Render the skeleton in the
      // brief window before the redirect lands.
      return <DashboardSkeleton />;
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
