"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { getInitials } from "@/lib/format";
import { formatTimestamp, timeAgo } from "@/lib/format-metric";
import type { AuditAction, AuditLogEntry, User } from "@/lib/types";

const ACTION_HUMAN: Record<AuditAction, string> = {
  "user.login": "Signed in",
  "user.logout": "Signed out",
  "user.invite": "Invited member",
  "user.role_change": "Changed role",
  "user.deactivate": "Deactivated user",
  "team.member_add": "Added to team",
  "team.member_remove": "Removed from team",
  "targets.update": "Updated targets",
  "performance.export": "Exported performance",
};

type SortKey = "timestamp" | "user" | "action";
type SortDir = "asc" | "desc";

interface AuditLogTableProps {
  entries: AuditLogEntry[];
  userById: Map<string, User>;
  nowIso: string;
  emptyMessage?: string;
}

export function AuditLogTable({
  entries,
  userById,
  nowIso,
  emptyMessage = "No events.",
}: AuditLogTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("timestamp");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const sorted = useMemo(() => {
    return [...entries].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "timestamp") cmp = a.timestamp.localeCompare(b.timestamp);
      else if (sortKey === "action") cmp = a.action.localeCompare(b.action);
      else if (sortKey === "user") {
        cmp = (userById.get(a.actorId)?.name ?? "").localeCompare(
          userById.get(b.actorId)?.name ?? "",
        );
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [entries, sortKey, sortDir, userById]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "timestamp" ? "desc" : "asc");
    }
  };

  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-200 px-4 py-12 text-center text-sm text-zinc-500 dark:border-zinc-800">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-200 bg-zinc-50/60 dark:border-zinc-800 dark:bg-zinc-900/40">
            <Th onClick={() => toggleSort("timestamp")} active={sortKey === "timestamp"} dir={sortDir}>
              Time
            </Th>
            <Th onClick={() => toggleSort("user")} active={sortKey === "user"} dir={sortDir}>
              User
            </Th>
            <Th onClick={() => toggleSort("action")} active={sortKey === "action"} dir={sortDir}>
              Action
            </Th>
            <Th>Resource</Th>
            <Th>IP</Th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((e) => {
            const actor = userById.get(e.actorId);
            return (
              <tr
                key={e.id}
                className="border-b border-zinc-100 transition-colors last:border-b-0 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/50"
              >
                <td className="whitespace-nowrap px-4 py-3 align-top">
                  <div className="text-zinc-900 dark:text-zinc-100">
                    {timeAgo(e.timestamp, nowIso)}
                  </div>
                  <div
                    className="mt-0.5 text-xs text-zinc-500"
                    title={new Date(e.timestamp).toISOString()}
                  >
                    {formatTimestamp(e.timestamp)}
                  </div>
                </td>
                <td className="px-4 py-3 align-top">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="text-[10px]">
                        {getInitials(actor?.name ?? "?")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="truncate font-medium">
                        {actor?.name ?? "Unknown"}
                      </div>
                      {actor && (
                        <div className="truncate text-xs text-zinc-500">
                          {actor.email}
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 align-top">
                  <div className="font-medium">{ACTION_HUMAN[e.action]}</div>
                  <code className="mt-0.5 block font-mono text-[11px] text-zinc-500">
                    {e.action}
                  </code>
                </td>
                <td className="px-4 py-3 align-top">
                  <div>{e.resource}</div>
                  {e.details && (
                    <div className="mt-0.5 text-xs text-zinc-500">{e.details}</div>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3 align-top font-mono text-xs text-zinc-500">
                  {e.ip}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Th({
  children,
  onClick,
  active,
  dir,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
  dir?: SortDir;
}) {
  return (
    <th
      scope="col"
      className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-zinc-500"
    >
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          className={cn(
            "inline-flex items-center gap-1.5 transition-colors hover:text-zinc-900 dark:hover:text-zinc-50",
          )}
        >
          {children}
          {!active ? (
            <ArrowUpDown className="h-3 w-3 opacity-50" aria-hidden />
          ) : dir === "asc" ? (
            <ArrowUp className="h-3 w-3" aria-hidden />
          ) : (
            <ArrowDown className="h-3 w-3" aria-hidden />
          )}
        </button>
      ) : (
        children
      )}
    </th>
  );
}
