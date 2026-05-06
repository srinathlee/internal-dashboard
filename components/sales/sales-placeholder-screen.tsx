"use client";

import {
  Construction,
  Filter,
  GitBranch,
  Map,
  Trophy,
  type LucideIcon,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { useAuth } from "@/lib/auth";
import { canSeeSalesTabs } from "@/lib/access";

/**
 * Icons can't cross the server→client boundary as props (they're function
 * references). The page passes a string key, this client component resolves
 * to the actual icon.
 */
export type SalesIconKey =
  | "leads"
  | "pipeline"
  | "scorecard"
  | "field-location";

const ICONS: Record<SalesIconKey, LucideIcon> = {
  leads: Filter,
  pipeline: GitBranch,
  scorecard: Trophy,
  "field-location": Map,
};

interface SalesPlaceholderScreenProps {
  title: string;
  description: string;
  iconKey: SalesIconKey;
}

/**
 * Shared placeholder for the five Sales-team views (Overview / Leads /
 * Pipeline / Scorecard / Field location). Each route is wired but the
 * actual views are deferred — this screen is the real visible result.
 */
export function SalesPlaceholderScreen({
  title,
  description,
  iconKey,
}: SalesPlaceholderScreenProps) {
  const auth = useAuth();
  const Icon = ICONS[iconKey];

  if (!auth.isLoaded) return <Skeleton />;

  if (!canSeeSalesTabs(auth)) {
    return (
      <div className="space-y-6">
        <PageHeader title={title} />
        <Card className="p-12 text-center text-sm text-zinc-500">
          You don't have permission to view the Sales workspace.
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} />
      <Card className="px-6 py-12 sm:px-12">
        <div className="mx-auto flex max-w-md flex-col items-center text-center">
          <div
            aria-hidden
            className="grid h-12 w-12 place-items-center rounded-xl bg-zinc-50 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400"
          >
            <Icon className="h-5 w-5" />
          </div>
          <h2 className="mt-4 text-lg font-medium tracking-tight">{title}</h2>
          <p className="mt-1 text-sm text-zinc-500">{description}</p>
          <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-dashed border-zinc-300 px-3 py-1 text-xs text-zinc-500 dark:border-zinc-700">
            <Construction className="h-3 w-3" aria-hidden />
            View not implemented in v1
          </div>
        </div>
      </Card>
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
      <Card className="h-72 animate-pulse" />
    </div>
  );
}
