"use client";

import { useCallback, useState } from "react";

import { getTeamMembers } from "@/lib/mock-data";
import type { Role, TeamId, User } from "@/lib/types";

/**
 * Ephemeral team-member store. Initialized from the mock data at first render
 * and mutated locally — changes do NOT persist across navigation, since v1
 * has no backend. When a real API arrives, swap the mutators for fetch calls
 * and the consumers stay unchanged.
 */
export interface UseTeamMembers {
  members: User[];
  invite: (input: { name: string; email: string; role: Role }) => User;
  setRole: (userId: string, role: Role) => void;
  setStatus: (userId: string, status: User["status"]) => void;
}

export function useTeamMembers(teamId: TeamId): UseTeamMembers {
  const [members, setMembers] = useState<User[]>(() => getTeamMembers(teamId));

  const invite = useCallback<UseTeamMembers["invite"]>(
    (input) => {
      const now = new Date().toISOString();
      const newUser: User = {
        id: `u_new_${Date.now()}`,
        name: input.name,
        email: input.email,
        role: input.role,
        teamId,
        status: "active",
        joinedAt: now,
        lastActiveAt: now,
      };
      setMembers((prev) => [...prev, newUser]);
      return newUser;
    },
    [teamId],
  );

  const setRole = useCallback<UseTeamMembers["setRole"]>((userId, role) => {
    setMembers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, role } : u)),
    );
  }, []);

  const setStatus = useCallback<UseTeamMembers["setStatus"]>(
    (userId, status) => {
      setMembers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, status } : u)),
      );
    },
    [],
  );

  return { members, invite, setRole, setStatus };
}
