"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  KeyRound,
  Mail,
  MoreHorizontal,
  ShieldCheck,
  Trash2,
  UserCog,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/layout/page-header";
import { useAuth } from "@/lib/auth";
import { getInitials } from "@/lib/format";
import { errorMessage } from "@/lib/hooks/use-async";
import { useSubadmins, useSubadminMutations } from "@/lib/hooks/use-subadmins";
import { useTeams, useTeamMutations } from "@/lib/hooks/use-teams";
import type { ApiSubadmin } from "@/lib/api/types";

import { ResetPasswordModal } from "./reset-password-modal";
import { ReplaceAdminModal } from "./replace-admin-modal";
import { AddMemberModal } from "./add-member-modal";
import { MemberDetailSheet } from "./member-detail-sheet";

interface TeamDetailScreenProps {
  teamId: string;
}

/**
 * /teams/[teamId] — Drill-down for one team.
 *
 * Two viewers:
 *   - SUPER_ADMIN: full controls. Can replace/demote the team admin and
 *     hard-delete members. Sees an "All teams" back link.
 *   - SALES_ADMIN (viewing their own team): can add/deactivate members
 *     and reset member passwords. Cannot replace the team admin (themselves)
 *     or delete users — those are super-admin actions per the spec.
 *
 * SALES_SUBADMIN never reaches this screen — sidebar gating filters them out
 * upstream. We still defend with a permission check so a deep link from
 * a member URL doesn't render team data.
 */
export function TeamDetailScreen({ teamId }: TeamDetailScreenProps) {
  const auth = useAuth();
  const teamsQuery = useTeams();
  const subadminsQuery = useSubadmins({ limit: 200 });
  const subadminMutations = useSubadminMutations();
  const teamMutations = useTeamMutations();

  const [resetUser, setResetUser] = useState<ApiSubadmin | null>(null);
  const [replaceAdminOpen, setReplaceAdminOpen] = useState(false);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  // Store the open member's id, then look up the freshest record on each
  // render so the sheet reflects post-mutation refetches without leaking
  // stale state via setMemberDetail(member).
  const [memberDetailId, setMemberDetailId] = useState<string | null>(null);

  const team = useMemo(
    () => teamsQuery.data?.find((t) => t.id === teamId) ?? null,
    [teamsQuery.data, teamId],
  );
  const subadmins = subadminsQuery.data?.sales_subadmins ?? [];

  const memberDetail = useMemo(
    () => subadmins.find((s) => s.id === memberDetailId) ?? null,
    [subadmins, memberDetailId],
  );

  const openMemberDetail = (m: ApiSubadmin) => {
    setMemberDetailId(m.id);
  };

  if (!auth.isLoaded) return <Skeleton />;

  // Access rule:
  //   SUPER_ADMIN  -> any team
  //   SALES_ADMIN  -> only their own team (teamId from JWT)
  //   SALES_SUBADMIN / others -> no access
  const isSuperAdmin = auth.user?.role === "super_admin";
  const isOwnTeamAdmin =
    auth.user?.role === "admin" && auth.user.teamId === teamId;
  const canView = isSuperAdmin || isOwnTeamAdmin;

  if (!canView) {
    return (
      <div className="space-y-6">
        <PageHeader title="Team" />
        <Card className="p-12 text-center text-sm text-zinc-500">
          You don't have permission to view this team.
        </Card>
      </div>
    );
  }

  const refetchAll = () => {
    void teamsQuery.refetch();
    void subadminsQuery.refetch();
  };

  const handleRemoveAdmin = async () => {
    if (!team?.admin) return;
    const confirmed = window.confirm(
      `Demote ${team.admin.name} from team admin? They'll become a regular member.`,
    );
    if (!confirmed) return;
    try {
      await teamMutations.removeAdmin(team.id, { demote: true });
      toast.success("Admin demoted to member");
      refetchAll();
    } catch (err) {
      toast.error("Couldn't demote admin", {
        description: errorMessage(err),
      });
    }
  };

  const handleSetStatus = async (
    user: ApiSubadmin,
    next: "ACTIVE" | "INACTIVE",
  ) => {
    try {
      await subadminMutations.update(user.id, { status: next });
      toast.success(next === "ACTIVE" ? "User reactivated" : "User deactivated");
      refetchAll();
    } catch (err) {
      toast.error("Couldn't update status", {
        description: errorMessage(err),
      });
    }
  };

  const handleDeleteUser = async (user: ApiSubadmin) => {
    const confirmed = window.confirm(
      `Permanently delete ${user.name}? This can't be undone.`,
    );
    if (!confirmed) return;
    try {
      await subadminMutations.remove(user.id);
      toast.success("User deleted");
      refetchAll();
    } catch (err) {
      toast.error("Couldn't delete user", {
        description: errorMessage(err),
      });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={team ? `${team.name} — team` : "Team"}
        description={team?.description}
        actions={
          isSuperAdmin ? (
            <Button variant="ghost" size="sm" asChild>
              <Link href="/teams">
                <ArrowLeft className="h-4 w-4" aria-hidden />
                All teams
              </Link>
            </Button>
          ) : null
        }
      />

      {teamsQuery.error || subadminsQuery.error ? (
        <Card className="border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-300">
          {teamsQuery.error
            ? `Couldn't load team: ${errorMessage(teamsQuery.error)}`
            : `Couldn't load members: ${errorMessage(subadminsQuery.error)}`}
        </Card>
      ) : null}

      <AdminCard
        team={team}
        loading={teamsQuery.isLoading && !team}
        canManage={isSuperAdmin}
        onReplace={() => setReplaceAdminOpen(true)}
        onResetPassword={() => {
          if (!team?.admin) return;
          // The admin returned by /teams uses a different shape than
          // ApiSubadmin — adapt enough fields for the modal.
          setResetUser({
            id: team.admin.user_id,
            name: team.admin.name,
            email: team.admin.email,
            phone: "",
            role: "SALES_SUBADMIN",
            status: team.admin.status ?? "ACTIVE",
            target_hospitals: 0,
            target_period: "MONTHLY",
            hospitals_added: 0,
            hospitals_done: 0,
            created_at: team.admin.created_at ?? "",
            updated_at: team.admin.created_at ?? "",
          });
        }}
        onRemove={handleRemoveAdmin}
      />

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <div>
            <h2 className="text-sm font-medium">Members</h2>
            <p className="text-xs text-zinc-500">
              SALES_SUBADMIN users in this team. Members can only view their
              own data.
            </p>
          </div>
          <Button size="sm" onClick={() => setAddMemberOpen(true)}>
            <UserPlus className="h-4 w-4" aria-hidden />
            Add member
          </Button>
        </div>

        {subadminsQuery.isLoading && subadmins.length === 0 ? (
          <div className="p-12 text-center text-sm text-zinc-500">
            Loading members…
          </div>
        ) : subadmins.length === 0 ? (
          <div className="p-12 text-center text-sm text-zinc-500">
            No members yet. Click <strong>Add member</strong> to onboard one.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
              <tr className="text-left">
                <th className="px-4 py-2 font-medium">Member</th>
                <th className="px-4 py-2 font-medium">Phone</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 text-right font-medium">Target</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {subadmins.map((u) => (
                <tr
                  key={u.id}
                  onClick={() => openMemberDetail(u)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openMemberDetail(u);
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label={`Open detail for ${u.name}`}
                  className="cursor-pointer border-t border-zinc-100 transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-zinc-800 dark:hover:bg-zinc-900"
                >
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2.5">
                      <Avatar className="h-7 w-7">
                        <AvatarFallback className="text-[10px]">
                          {getInitials(u.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="truncate font-medium">{u.name}</div>
                        <div className="truncate text-xs text-zinc-500">
                          {u.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-zinc-600 dark:text-zinc-400">
                    {u.phone || "—"}
                  </td>
                  <td className="px-4 py-2">
                    <StatusBadge status={u.status} />
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {u.target_hospitals}/{u.target_period.toLowerCase()}
                  </td>
                  <td
                    className="px-4 py-2 text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          aria-label={`Actions for ${u.name}`}
                        >
                          <MoreHorizontal
                            className="h-4 w-4"
                            aria-hidden
                          />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52">
                        <DropdownMenuItem
                          onSelect={(e) => {
                            e.preventDefault();
                            setResetUser(u);
                          }}
                        >
                          <KeyRound className="h-3.5 w-3.5" aria-hidden />
                          Reset password
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={(e) => {
                            e.preventDefault();
                            handleSetStatus(
                              u,
                              u.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
                            );
                          }}
                        >
                          <UserCog className="h-3.5 w-3.5" aria-hidden />
                          {u.status === "ACTIVE"
                            ? "Deactivate"
                            : "Reactivate"}
                        </DropdownMenuItem>
                        {isSuperAdmin ? (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onSelect={(e) => {
                                e.preventDefault();
                                handleDeleteUser(u);
                              }}
                              className="text-rose-600 dark:text-rose-400"
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden />
                              Delete user
                            </DropdownMenuItem>
                          </>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <ResetPasswordModal
        open={!!resetUser}
        onOpenChange={(o) => {
          if (!o) setResetUser(null);
        }}
        user={resetUser}
      />

      <ReplaceAdminModal
        open={replaceAdminOpen}
        onOpenChange={setReplaceAdminOpen}
        teamId={teamId}
        teamName={team?.name ?? teamId}
        onReplaced={refetchAll}
      />

      <AddMemberModal
        open={addMemberOpen}
        onOpenChange={setAddMemberOpen}
        teamId={teamId}
        onCreated={refetchAll}
      />

      <MemberDetailSheet
        member={memberDetail}
        open={memberDetailId !== null}
        onOpenChange={(o) => {
          if (!o) {
            // Defer the id clear so the sheet content doesn't blank out
            // mid-close animation.
            window.setTimeout(() => setMemberDetailId(null), 200);
          }
        }}
        onMutated={refetchAll}
      />
    </div>
  );
}

function AdminCard({
  team,
  loading,
  canManage,
  onReplace,
  onResetPassword,
  onRemove,
}: {
  team: { admin: { user_id: string; name: string; email: string } | null } | null;
  loading: boolean;
  /**
   * SUPER_ADMIN-only actions (replace / demote, plus initial assign). Hidden
   * for SALES_ADMIN viewing their own team — they can't promote or demote
   * themselves per the role spec.
   */
  canManage: boolean;
  onReplace: () => void;
  onResetPassword: () => void;
  onRemove: () => void;
}) {
  if (loading) {
    return <Card className="h-32 animate-pulse" />;
  }
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400"
          >
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-medium">Team admin</h2>
              <Badge variant="outline" className="text-[10px]">
                SALES_ADMIN
              </Badge>
            </div>
            {team?.admin ? (
              <div className="mt-1 space-y-0.5">
                <div className="text-base font-semibold">{team.admin.name}</div>
                <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                  <Mail className="h-3 w-3" aria-hidden />
                  {team.admin.email}
                </div>
              </div>
            ) : (
              <p className="mt-1 text-sm text-zinc-500">
                No admin assigned. Click <strong>Assign admin</strong> to add
                one.
              </p>
            )}
          </div>
        </div>

        {team?.admin ? (
          canManage ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  Manage
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    onResetPassword();
                  }}
                >
                  <KeyRound className="h-3.5 w-3.5" aria-hidden />
                  Reset password
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    onReplace();
                  }}
                >
                  <UserCog className="h-3.5 w-3.5" aria-hidden />
                  Replace admin…
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    onRemove();
                  }}
                  className="text-rose-600 dark:text-rose-400"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  Demote to member
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null
        ) : canManage ? (
          <Button size="sm" onClick={onReplace}>
            <UserPlus className="h-4 w-4" aria-hidden />
            Assign admin
          </Button>
        ) : null}
      </div>
    </Card>
  );
}

function StatusBadge({ status }: { status: "ACTIVE" | "INACTIVE" }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
        status === "ACTIVE"
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
          : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
      }`}
    >
      {status === "ACTIVE" ? "Active" : "Inactive"}
    </span>
  );
}

function Skeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-7 w-48 animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-800" />
        <div className="h-4 w-72 animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-800" />
      </div>
      <Card className="h-32 animate-pulse" />
      <Card className="h-72 animate-pulse" />
    </div>
  );
}
