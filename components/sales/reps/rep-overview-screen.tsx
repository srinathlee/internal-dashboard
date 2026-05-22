"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Mail,
  MessageSquare,
  Phone,
  ShieldCheck,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import { isSalesAdminOrSuperAdmin } from "@/lib/access";
import { getInitials } from "@/lib/format";
import { errorMessage } from "@/lib/hooks/use-async";
import { useSubadmin } from "@/lib/hooks/use-subadmins";
import { cn } from "@/lib/utils";

import { MessageRepDialog } from "./message-rep-dialog";
import { RepLeadsTab } from "./rep-leads-tab";
import { RepMapTab } from "./rep-map-tab";
import { RepOverviewTab } from "./rep-overview-tab";
import { RepPinsTab } from "./rep-pins-tab";
import { RepScorecardTab } from "./rep-scorecard-tab";
import { RepTargetsTab } from "./rep-targets-tab";

const TABS = [
  { value: "overview", label: "Overview" },
  { value: "scorecard", label: "Scorecard" },
  { value: "leads", label: "Leads" },
  { value: "map", label: "Map" },
  { value: "pins", label: "Pins" },
  { value: "targets", label: "Targets" },
] as const;

/**
 * /sales/reps/[repId] — full per-rep workspace. Replaces the old slide-in
 * member sheet: a tabbed page (overview / scorecard / leads / map / pins /
 * analytics) reachable from any rep row across the app.
 */
export function RepOverviewScreen({ repId }: { repId: string }) {
  const auth = useAuth();
  const router = useRouter();
  const member = useSubadmin(repId);
  const [showMessage, setShowMessage] = useState(false);

  if (!auth.isLoaded) {
    return (
      <div className="space-y-6">
        <Card className="h-28 animate-pulse" />
        <Card className="h-72 animate-pulse" />
      </div>
    );
  }

  if (!isSalesAdminOrSuperAdmin(auth)) {
    return (
      <Card className="p-12 text-center text-sm text-zinc-500">
        Rep profiles are available to sales admins and super admins.
      </Card>
    );
  }

  const m = member.data;

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => router.back()}
        className="inline-flex items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:hover:text-zinc-100"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back
      </button>

      {member.error ? (
        <Card className="p-8 text-center text-sm text-rose-600 dark:text-rose-400">
          Couldn&apos;t load this rep: {errorMessage(member.error)}
        </Card>
      ) : (
        <>
          {/* Header */}
          <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <Avatar className="h-14 w-14">
                <AvatarFallback className="text-lg">
                  {getInitials(m?.name ?? "?")}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="truncate text-xl font-semibold tracking-tight">
                    {m?.name ?? "Loading…"}
                  </h1>
                  {m ? <StatusBadge status={m.status} /> : null}
                  {m ? (
                    <Badge
                      variant="outline"
                      className="inline-flex items-center gap-1 text-[10px]"
                    >
                      <ShieldCheck className="h-3 w-3" aria-hidden />
                      {m.role}
                    </Badge>
                  ) : null}
                </div>
                {m ? (
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
                    <span className="inline-flex items-center gap-1 truncate">
                      <Mail className="h-3 w-3" aria-hidden />
                      {m.email || "—"}
                    </span>
                    {m.phone ? (
                      <span className="inline-flex items-center gap-1 font-mono">
                        <Phone className="h-3 w-3" aria-hidden />
                        {m.phone}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setShowMessage(true)}
                disabled={!m}
              >
                <MessageSquare className="h-4 w-4" aria-hidden />
                Message
              </Button>
            </div>
          </Card>

          {/* Tabs */}
          <Tabs defaultValue="overview">
            <TabsList className="flex w-full flex-wrap justify-start sm:w-auto">
              {TABS.map((t) => (
                <TabsTrigger key={t.value} value={t.value} className="flex-1 sm:flex-none">
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="overview">
              {m ? (
                <RepOverviewTab
                  member={m}
                  repId={repId}
                  onMutated={() => member.refetch()}
                  onDeleted={() => router.back()}
                />
              ) : (
                <Card className="h-72 animate-pulse" />
              )}
            </TabsContent>
            <TabsContent value="scorecard">
              <RepScorecardTab repId={repId} />
            </TabsContent>
            <TabsContent value="leads">
              <RepLeadsTab repId={repId} />
            </TabsContent>
            <TabsContent value="map">
              <RepMapTab repId={repId} />
            </TabsContent>
            <TabsContent value="pins">
              <RepPinsTab repId={repId} />
            </TabsContent>
            <TabsContent value="targets">
              <RepTargetsTab repId={repId} />
            </TabsContent>
          </Tabs>
        </>
      )}

      {m ? (
        <MessageRepDialog
          open={showMessage}
          onOpenChange={setShowMessage}
          repId={repId}
          repName={m.name}
        />
      ) : null}
    </div>
  );
}

function StatusBadge({ status }: { status: "ACTIVE" | "INACTIVE" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider",
        status === "ACTIVE"
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
          : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
      )}
    >
      {status === "ACTIVE" ? "Active" : "Inactive"}
    </span>
  );
}
