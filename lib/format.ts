import type { Role, TeamId } from "./types";

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return (first + last).toUpperCase() || "?";
}

export function roleLabel(role: Role): string {
  switch (role) {
    case "member":
      return "Member";
    case "admin":
      return "Admin";
    case "super_admin":
      return "Super Admin";
  }
}

/**
 * Tailwind class for a team's accent dot. Centralized here so shifting a team's
 * color in `mock-data.ts` doesn't require chasing class strings across the UI.
 */
export function teamDotClass(teamId: TeamId | null): string {
  switch (teamId) {
    case "sales":
      return "bg-blue-500";
    case "onboarding":
      return "bg-teal-500";
    case null:
    default:
      return "bg-zinc-400";
  }
}
