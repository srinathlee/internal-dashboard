"use client";

import { useEffect, useState } from "react";

import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { useAuth } from "@/lib/auth";
import { isSalesMember } from "@/lib/access";

import {
  SingleRepDetailedView,
  loadTargets,
  type Period,
  type TargetMap,
} from "./target-management-screen";

/**
 * Sales rep "My targets" view. Reuses the same single-rep detailed layout
 * that super admins see on /sales/targets when filtering down to one rep —
 * just scoped to the currently authenticated rep.
 *
 * Data source matches the super admin's target-management screen
 * (localStorage), so a target assigned there is immediately visible here.
 * Swap both sites for the real API once the backend lands.
 */
export function MyTargetsScreen() {
  const auth = useAuth();
  const [period, setPeriod] = useState<Period>("DAILY");
  const [targets, setTargets] = useState<TargetMap>({});

  useEffect(() => {
    setTargets(loadTargets());
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === "nyra-dashboard:sales-targets-v1") {
        setTargets(loadTargets());
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  if (!auth.isLoaded) {
    return (
      <div className="space-y-4">
        <Card className="h-16 animate-pulse" />
        <Card className="h-96 animate-pulse" />
      </div>
    );
  }

  if (!isSalesMember(auth) || !auth.user) {
    return (
      <div className="space-y-6">
        <PageHeader title="My targets" />
        <Card className="p-12 text-center text-sm text-zinc-500">
          You don't have permission to view this page.
        </Card>
      </div>
    );
  }

  const userTargets = targets[auth.user.id] ?? {};

  return (
    <div className="space-y-6">
      <PageHeader
        title="My targets"
        description="Your assigned target amount and progress for each period."
      />
      <SingleRepDetailedView
        user={{ id: auth.user.id, name: auth.user.name }}
        targets={userTargets}
        activePeriod={period}
        onPeriodChange={setPeriod}
      />
    </div>
  );
}
