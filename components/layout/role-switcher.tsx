"use client";

import { Check, ChevronDown } from "lucide-react";

import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { roleLabel, teamDotClass } from "@/lib/format";
import type { Role, User } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const ROLE_GROUPS: { role: Role; label: string }[] = [
  { role: "super_admin", label: "Super Admin" },
  { role: "admin", label: "Admins" },
  { role: "member", label: "Members" },
];

/**
 * Dev-only affordance: switch the active user across the 9 mock identities so
 * reviewers can preview every role without re-logging-in. Marked DEV.
 */
export function RoleSwitcher() {
  const { user, allUsers, setUserById } = useAuth();
  if (!user) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-2 px-2.5 text-xs font-medium"
          aria-label={`View-as user. Currently viewing as ${user.name}.`}
        >
          <Badge
            variant="outline"
            className="h-4 border-amber-300 bg-amber-50 px-1 text-[9px] font-semibold tracking-wider text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-400"
          >
            DEV
          </Badge>
          <span className="hidden text-zinc-500 sm:inline">View as:</span>
          <span className="max-w-[8rem] truncate text-zinc-900 dark:text-zinc-50">
            {user.name.split(" ")[0]}
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-zinc-500" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>View as</span>
          <span className="text-[10px] font-normal normal-case text-zinc-400">
            Dev only — not visible in production
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {ROLE_GROUPS.map((group, idx) => {
          const usersInGroup = allUsers.filter((u) => u.role === group.role);
          if (usersInGroup.length === 0) return null;
          return (
            <div key={group.role}>
              {idx > 0 && <DropdownMenuSeparator />}
              <DropdownMenuLabel>{group.label}</DropdownMenuLabel>
              {usersInGroup.map((u) => (
                <UserRow
                  key={u.id}
                  user={u}
                  active={u.id === user.id}
                  onSelect={() => setUserById(u.id)}
                />
              ))}
            </div>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UserRow({
  user,
  active,
  onSelect,
}: {
  user: User;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <DropdownMenuItem
      onSelect={(e) => {
        e.preventDefault();
        onSelect();
      }}
      className="cursor-pointer"
    >
      <span
        aria-hidden
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          teamDotClass(user.teamId),
        )}
      />
      <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm">{user.name}</div>
          <div className="truncate text-xs text-zinc-500">
            {user.teamId ? `${capitalize(user.teamId)} · ${roleLabel(user.role)}` : roleLabel(user.role)}
          </div>
        </div>
        {active && <Check className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />}
      </div>
    </DropdownMenuItem>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
