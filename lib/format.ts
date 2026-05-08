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
 * Tailwind class for a team's accent dot. Centralized here so shifting a
 * team's color doesn't require chasing class strings across the UI.
 *
 * Accepts any string ID (and `null`) so dynamically-created teams from the
 * backend get a sensible default color even before they're added here.
 */
export function teamDotClass(teamId: TeamId | string | null): string {
  switch (teamId) {
    case "sales":
      return "bg-blue-500";
    case "onboarding":
      return "bg-teal-500";
    case null:
    case undefined:
      return "bg-zinc-400";
    default:
      return "bg-indigo-500";
  }
}

/**
 * Display name for a team id. Used by surfaces (sidebar footer, badges)
 * that need a human-readable label without round-tripping the API for
 * the team object.
 */
export function teamDisplayName(teamId: TeamId | string | null): string {
  if (!teamId) return "";
  switch (teamId) {
    case "sales":
      return "Sales";
    case "onboarding":
      return "Onboarding";
    default:
      return teamId.charAt(0).toUpperCase() + teamId.slice(1);
  }
}
