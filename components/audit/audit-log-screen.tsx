"use client";

import { useMemo, useState } from "react";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/layout/page-header";
import { useAuth } from "@/lib/auth";
import { auditLog, REFERENCE_DATE, users } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import type { AuditLogEntry } from "@/lib/types";
import { Search } from "lucide-react";

import { AuditLogTable } from "./audit-log-table";

type RangeKey = "7d" | "30d" | "all";

const RANGES: { key: RangeKey; label: string }[] = [
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "all", label: "All time" },
];

export function AuditLogScreen() {
  const auth = useAuth();
  const [search, setSearch] = useState("");
  const [range, setRange] = useState<RangeKey>("30d");

  // Hooks must run unconditionally — compute these before any early return.
  const userById = useMemo(() => new Map(users.map((u) => [u.id, u])), []);
  const filtered = useMemo(() => {
    const cutoff = computeCutoff(range);
    const q = search.trim().toLowerCase();
    return auditLog
      .filter((e) => (cutoff ? e.timestamp >= cutoff : true))
      .filter((e) => matchesSearch(e, q, userById));
  }, [range, search, userById]);

  if (!auth.isLoaded) return <Skeleton />;

  if (!auth.can("audit_log:read")) {
    return (
      <div className="space-y-6">
        <PageHeader title="Audit log" />
        <Card className="p-12 text-center text-sm text-zinc-500">
          You don't have permission to view the audit log.
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit log"
        description={`${filtered.length} of ${auditLog.length} events`}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
          />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search user, action, resource, IP…"
            className="pl-9"
            aria-label="Search audit log"
          />
        </div>

        <div
          role="tablist"
          aria-label="Date range"
          className="inline-flex h-9 items-center rounded-lg border border-zinc-200 bg-white p-0.5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
        >
          {RANGES.map((r) => {
            const active = range === r.key;
            return (
              <button
                key={r.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setRange(r.key)}
                className={cn(
                  "h-8 rounded-md px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active
                    ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
                    : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50",
                )}
              >
                {r.label}
              </button>
            );
          })}
        </div>
      </div>

      <AuditLogTable
        entries={filtered}
        userById={userById}
        nowIso={`${REFERENCE_DATE}T12:00:00.000Z`}
        emptyMessage={
          search
            ? `No events match "${search}".`
            : range === "all"
              ? "No audit events recorded yet."
              : "No audit events in this range."
        }
      />
    </div>
  );
}

function matchesSearch(
  e: AuditLogEntry,
  q: string,
  userById: Map<string, { name: string; email: string }>,
): boolean {
  if (!q) return true;
  const actor = userById.get(e.actorId);
  const haystacks = [
    actor?.name,
    actor?.email,
    e.action,
    e.resource,
    e.ip,
    e.details,
  ];
  return haystacks.some((s) => s && s.toLowerCase().includes(q));
}

function computeCutoff(range: RangeKey): string | null {
  if (range === "all") return null;
  const days = range === "7d" ? 7 : 30;
  const ref = new Date(`${REFERENCE_DATE}T00:00:00.000Z`);
  ref.setUTCDate(ref.getUTCDate() - days);
  return ref.toISOString();
}

function Skeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-7 w-48 animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-800" />
        <div className="h-4 w-72 animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-800" />
      </div>
      <Card className="h-96 animate-pulse" />
    </div>
  );
}
