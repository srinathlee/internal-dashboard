import type { Permission, ResourceContext, Role, User } from "./types";

/**
 * Grants by role. Keep each permission listed explicitly — never derive
 * one role's grants from another's. When roles split in the future
 * (e.g. Manager vs Admin), grants stay easy to diff.
 */
const ROLE_GRANTS: Record<Role, ReadonlySet<Permission>> = {
  member: new Set<Permission>(["performance:read:self"]),

  admin: new Set<Permission>([
    "performance:read:self",
    "performance:read:team",
    "performance:export:team",
    "team:add_member",
    "team:remove_member",
    "user:invite",
    "targets:set",
  ]),

  super_admin: new Set<Permission>([
    "performance:read:self",
    "performance:read:team",
    "performance:read:all",
    "performance:export:team",
    "performance:export:all",
    "team:add_member",
    "team:remove_member",
    "user:invite",
    "targets:set",
    "audit_log:read",
    "user:assign_role",
  ]),
};

/**
 * Single permission check used by every UI conditional.
 *
 * Rules:
 *   1. Inactive users have no permissions.
 *   2. The role must grant the permission in principle.
 *   3. Scope check (when `resource` is provided):
 *        - super_admin: always allowed
 *        - admin:       only their own team / users in their team
 *        - member:      only themselves
 */
export function can(
  user: User | null,
  permission: Permission,
  resource?: ResourceContext,
): boolean {
  if (!user || user.status !== "active") return false;

  if (!ROLE_GRANTS[user.role].has(permission)) return false;

  // No scope requested → role-level grant is enough.
  if (!resource) return true;

  if (user.role === "super_admin") return true;

  if (user.role === "admin") {
    if (resource.teamId && resource.teamId !== user.teamId) return false;
    return true;
  }

  // member
  if (resource.userId && resource.userId !== user.id) return false;
  if (resource.teamId && resource.teamId !== user.teamId) return false;
  return true;
}

/** Convenience: does this user have *any* of the listed permissions? */
export function canAny(
  user: User | null,
  permissions: Permission[],
  resource?: ResourceContext,
): boolean {
  return permissions.some((p) => can(user, p, resource));
}
