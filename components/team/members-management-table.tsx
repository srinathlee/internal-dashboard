"use client";

import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  MoreHorizontal,
  PowerOff,
  Search,
  Shield,
  Zap,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { getInitials, roleLabel } from "@/lib/format";
import { timeAgo } from "@/lib/format-metric";
import type { Team, User } from "@/lib/types";

type SortDir = "asc" | "desc";
type SortKey = "name" | "role" | "status" | "lastActive";

interface MembersManagementTableProps {
  members: User[];
  team: Team;
  /** ID of the currently signed-in user; row actions are suppressed on the self-row. */
  currentUserId: string;
  /** Whether the viewer can change roles (gated by user:assign_role). */
  canEditRole: boolean;
  /** Whether the viewer can toggle active/inactive (gated by team:remove_member). */
  canDeactivate: boolean;
  onEditRole: (user: User) => void;
  onToggleStatus: (user: User) => void;
  /** Used for "Last active" relative timestamps so SSR matches client. */
  nowIso: string;
}

export function MembersManagementTable({
  members,
  team,
  currentUserId,
  canEditRole,
  canDeactivate,
  onEditRole,
  onToggleStatus,
  nowIso,
}: MembersManagementTableProps) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q),
    );
  }, [members, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const cmp = compareUsers(a, b, sortKey);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "lastActive" ? "desc" : "asc");
    }
  };

  const showActionsCol = canEditRole || canDeactivate;

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
        />
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email"
          className="pl-9"
          aria-label="Search members"
        />
      </div>

      {sorted.length === 0 ? (
        <EmptyState
          search={search}
          team={team}
          totalMembers={members.length}
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50/60 dark:border-zinc-800 dark:bg-zinc-900/40">
                <Th onClick={() => toggleSort("name")} active={sortKey === "name"} dir={sortDir}>
                  Member
                </Th>
                <Th>Email</Th>
                <Th onClick={() => toggleSort("role")} active={sortKey === "role"} dir={sortDir}>
                  Role
                </Th>
                <Th onClick={() => toggleSort("status")} active={sortKey === "status"} dir={sortDir}>
                  Status
                </Th>
                <Th
                  onClick={() => toggleSort("lastActive")}
                  active={sortKey === "lastActive"}
                  dir={sortDir}
                  align="right"
                >
                  Last active
                </Th>
                {showActionsCol && (
                  <th className="w-12 px-2 py-2.5">
                    <span className="sr-only">Actions</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {sorted.map((u) => {
                const isSelf = u.id === currentUserId;
                const inactive = u.status === "inactive";
                return (
                  <tr
                    key={u.id}
                    className={cn(
                      "border-b border-zinc-100 transition-colors last:border-b-0 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/50",
                      inactive && "text-zinc-500",
                    )}
                  >
                    <td className="px-4 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar className={cn("h-8 w-8", inactive && "opacity-60")}>
                          <AvatarFallback className="text-[10px]">
                            {getInitials(u.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={cn("truncate font-medium", inactive && "text-zinc-500")}>
                              {u.name}
                            </span>
                            {isSelf && (
                              <Badge variant="outline" className="text-[10px]">
                                YOU
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      {u.email}
                    </td>
                    <td className="px-4 py-3">{roleLabel(u.role)}</td>
                    <td className="px-4 py-3">
                      <StatusPill status={u.status} />
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-500">
                      {timeAgo(u.lastActiveAt, nowIso)}
                    </td>
                    {showActionsCol && (
                      <td className="px-2 py-3 text-right">
                        <RowActions
                          user={u}
                          isSelf={isSelf}
                          canEditRole={canEditRole}
                          canDeactivate={canDeactivate}
                          onEditRole={onEditRole}
                          onToggleStatus={onToggleStatus}
                        />
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: User["status"] }) {
  if (status === "active") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs">
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        <span className="text-emerald-700 dark:text-emerald-400">Active</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
      <span className="text-zinc-500">Inactive</span>
    </span>
  );
}

function RowActions({
  user,
  isSelf,
  canEditRole,
  canDeactivate,
  onEditRole,
  onToggleStatus,
}: {
  user: User;
  isSelf: boolean;
  canEditRole: boolean;
  canDeactivate: boolean;
  onEditRole: (u: User) => void;
  onToggleStatus: (u: User) => void;
}) {
  const editRoleAvailable = canEditRole && !isSelf;
  const toggleStatusAvailable = canDeactivate && !isSelf;
  if (!editRoleAvailable && !toggleStatusAvailable) {
    return <span className="block text-zinc-300 dark:text-zinc-700">—</span>;
  }
  const isInactive = user.status === "inactive";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Actions for ${user.name}`}
          className="h-8 w-8 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {editRoleAvailable && (
          <DropdownMenuItem onSelect={() => onEditRole(user)}>
            <Shield className="text-zinc-500" /> Edit role
          </DropdownMenuItem>
        )}
        {editRoleAvailable && toggleStatusAvailable && <DropdownMenuSeparator />}
        {toggleStatusAvailable &&
          (isInactive ? (
            <DropdownMenuItem onSelect={() => onToggleStatus(user)}>
              <Zap className="text-zinc-500" /> Reactivate
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              onSelect={() => onToggleStatus(user)}
              className="text-red-600 focus:bg-red-50 focus:text-red-700 dark:text-red-400 dark:focus:bg-red-950 dark:focus:text-red-300"
            >
              <PowerOff /> Deactivate
            </DropdownMenuItem>
          ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Th({
  children,
  align,
  onClick,
  active,
  dir,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  onClick?: () => void;
  active?: boolean;
  dir?: SortDir;
}) {
  return (
    <th
      scope="col"
      className={cn(
        "px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-zinc-500",
        align === "right" ? "text-right" : "text-left",
      )}
    >
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          className={cn(
            "inline-flex items-center gap-1.5 transition-colors hover:text-zinc-900 dark:hover:text-zinc-50",
            align === "right" && "ml-auto",
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

function EmptyState({
  search,
  team,
  totalMembers,
}: {
  search: string;
  team: Team;
  totalMembers: number;
}) {
  if (search) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-200 px-4 py-12 text-center text-sm text-zinc-500 dark:border-zinc-800">
        No members on {team.name} match <span className="font-medium">{`"${search}"`}</span>.
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-dashed border-zinc-200 px-6 py-12 text-center dark:border-zinc-800">
      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
        {totalMembers === 0
          ? `${team.name} has no members yet`
          : "No members in view"}
      </p>
      <p className="mt-1 text-sm text-zinc-500">
        {totalMembers === 0
          ? "Send your first invite to get started."
          : "Try adjusting your filters."}
      </p>
    </div>
  );
}

function compareUsers(a: User, b: User, key: SortKey): number {
  if (key === "name") return a.name.localeCompare(b.name);
  if (key === "role") {
    // Sort high → low role weight when desc; alphabetical otherwise.
    const w = { super_admin: 3, admin: 2, member: 1 } as const;
    return w[a.role] - w[b.role];
  }
  if (key === "status") {
    return a.status.localeCompare(b.status);
  }
  // lastActive (ISO timestamp string compare works lexicographically)
  return a.lastActiveAt.localeCompare(b.lastActiveAt);
}
