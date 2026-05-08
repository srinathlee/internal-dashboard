"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/layout/page-header";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { errorMessage } from "@/lib/hooks/use-async";
import { useAuditLog } from "@/lib/hooks/use-audit-log";
import { formatTimestamp, timeAgo } from "@/lib/format-metric";

type RangeKey = "7d" | "30d" | "all";

const RANGES: { key: RangeKey; label: string }[] = [
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "all", label: "All time" },
];

/**
 * Audit log surface for super admins. Backed by GET /api/v1/sales/audit-log.
 */
export function AuditLogScreen() {
  const auth = useAuth();
  const [search, setSearch] = useState("");
  const [range, setRange] = useState<RangeKey>("30d");

  const cutoff = useMemo(() => computeCutoff(range), [range]);
  const auditQuery = useAuditLog({
    from: cutoff ?? undefined,
    limit: 100,
  });

  const all = auditQuery.data?.data ?? [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return all;
    return all.filter((e) => {
      const hay = [
        e.actorId,
        e.action,
        e.resource,
        e.resourceId,
        e.ip,
        JSON.stringify(e.details ?? {}),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [all, search]);

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
        description={`${filtered.length} of ${auditQuery.data?.meta.total ?? all.length} events`}
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
            placeholder="Search actor, action, resource, IP…"
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

      {auditQuery.error ? (
        <Card className="border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-300">
          Couldn't load audit log: {errorMessage(auditQuery.error)}
        </Card>
      ) : auditQuery.isLoading && all.length === 0 ? (
        <Card className="h-96 animate-pulse" />
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center text-sm text-zinc-500">
          {search
            ? `No events match "${search}".`
            : range === "all"
              ? "No audit events recorded yet."
              : "No audit events in this range."}
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50/60 text-left dark:border-zinc-800 dark:bg-zinc-900/40">
                <th className="px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Time
                </th>
                <th className="px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Actor
                </th>
                <th className="px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Action
                </th>
                <th className="px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Resource
                </th>
                <th className="px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-zinc-500">
                  IP
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr
                  key={e.id}
                  className="border-b border-zinc-100 transition-colors last:border-b-0 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/50"
                >
                  <td className="whitespace-nowrap px-4 py-3 align-top">
                    <div>{timeAgo(e.timestamp)}</div>
                    <div
                      className="mt-0.5 text-xs text-zinc-500"
                      title={e.timestamp}
                    >
                      {formatTimestamp(e.timestamp)}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top text-xs">{e.actorId}</td>
                  <td className="px-4 py-3 align-top">
                    <div className="font-medium">{e.action}</div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div>{e.resource}</div>
                    <div className="text-xs text-zinc-500">{e.resourceId}</div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 align-top font-mono text-xs text-zinc-500">
                    {e.ip}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function computeCutoff(range: RangeKey): string | null {
  if (range === "all") return null;
  const days = range === "7d" ? 7 : 30;
  const ref = new Date();
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
