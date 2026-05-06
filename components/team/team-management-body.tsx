"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { useTeamMembers } from "@/lib/hooks/use-team-members";
import { REFERENCE_DATE } from "@/lib/mock-data";
import type { Role, Team, User } from "@/lib/types";

import { InviteMemberModal } from "./invite-member-modal";
import { EditRoleModal } from "./edit-role-modal";
import { DeactivateConfirmModal } from "./deactivate-confirm-modal";
import { MembersManagementTable } from "./members-management-table";

export interface TeamManagementBodyProps {
  team: Team;
  currentUser: User;
  /** Whether the viewer can open the invite modal. */
  canInvite: boolean;
  /** Whether the viewer can edit roles via the row menu. */
  canEditRole: boolean;
  /** Whether the viewer can toggle active/inactive via the row menu. */
  canDeactivate: boolean;
  /**
   * Header title — pages choose their own framing
   * (e.g. "Sales team" vs "Sales — members").
   */
  title?: string;
  description?: string;
  /** Optional extra slot to the right of "Invite member" (e.g. a back link). */
  extraActions?: React.ReactNode;
}

/**
 * Reusable team-management surface — table + 3 modals + invite button.
 *
 * Used by /team (admin viewing own team) and /teams/[teamId] (super admin
 * drilling into a team). All access decisions are passed in as booleans so
 * routing/auth lives in the caller.
 */
export function TeamManagementBody({
  team,
  currentUser,
  canInvite,
  canEditRole,
  canDeactivate,
  title,
  description,
  extraActions,
}: TeamManagementBodyProps) {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [statusUser, setStatusUser] = useState<User | null>(null);

  const { members, invite, setRole, setStatus } = useTeamMembers(team.id);

  const assignableRoles: Role[] = canEditRole
    ? ["member", "admin", "super_admin"]
    : ["member", "admin"];

  const activeCount = members.filter((m) => m.status === "active").length;
  const heading = title ?? `${team.name} team`;
  const desc =
    description ?? `${activeCount} active · ${members.length} total`;

  return (
    <div className="space-y-6">
      <PageHeader
        title={heading}
        description={desc}
        actions={
          <div className="flex items-center gap-2">
            {extraActions}
            {canInvite && (
              <Button onClick={() => setInviteOpen(true)}>
                <UserPlus className="h-4 w-4" aria-hidden />
                Invite member
              </Button>
            )}
          </div>
        }
      />

      <MembersManagementTable
        members={members}
        team={team}
        currentUserId={currentUser.id}
        canEditRole={canEditRole}
        canDeactivate={canDeactivate}
        onEditRole={(u) => setEditingUser(u)}
        onToggleStatus={(u) => setStatusUser(u)}
        nowIso={`${REFERENCE_DATE}T12:00:00.000Z`}
      />

      <InviteMemberModal
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        team={team}
        assignableRoles={assignableRoles}
        onInvite={invite}
      />

      <EditRoleModal
        open={editingUser !== null}
        onOpenChange={(o) => !o && setEditingUser(null)}
        user={editingUser}
        assignableRoles={assignableRoles}
        onSave={setRole}
      />

      <DeactivateConfirmModal
        open={statusUser !== null}
        onOpenChange={(o) => !o && setStatusUser(null)}
        user={statusUser}
        onConfirm={(uid, next) => setStatus(uid, next)}
      />
    </div>
  );
}
