import type { AuthContextValue } from "./auth";

/**
 * Sales-team-specific access predicates.
 *
 * These exist outside the permission vocabulary because they encode *scope*
 * decisions — "sales members live inside the Hospitals view only" — rather
 * than discrete capabilities. Components import these helpers instead of
 * comparing role/team strings inline, so the rule lives in one place.
 */

export function isSalesMember(auth: AuthContextValue): boolean {
  return auth.user?.role === "member" && auth.user?.teamId === "sales";
}

export function isSalesAdmin(auth: AuthContextValue): boolean {
  return auth.user?.role === "admin" && auth.user?.teamId === "sales";
}

/** Anyone on the sales team — member or admin. Super admin not included. */
export function isOnSales(auth: AuthContextValue): boolean {
  return auth.user?.teamId === "sales";
}

/** Can view the Sales tabs (Overview / Leads / Pipeline / Scorecard / Field). */
export function isSalesAdminOrSuperAdmin(auth: AuthContextValue): boolean {
  if (!auth.user) return false;
  if (auth.user.role === "super_admin") return true;
  return isSalesAdmin(auth);
}

/** Can view the All Hospitals page (list-only for sales). */
export function canSeeHospitals(auth: AuthContextValue): boolean {
  if (!auth.user) return false;
  if (auth.user.role === "super_admin") return true;
  return isOnSales(auth);
}

/**
 * Can open an individual hospital's detail page and perform actions
 * (edit, create branch/users, manage subscription, etc). Restricted to
 * super_admin — sales sees the list but is view-only on the list itself.
 */
export function canOpenHospital(auth: AuthContextValue): boolean {
  return auth.user?.role === "super_admin";
}

/**
 * Can view any of the Sales-team tab pages (Overview / Leads / Pipeline /
 * Scorecard / Field location). Includes sales members because they live in
 * this surface; admin and super admin both also see it.
 */
export function canSeeSalesTabs(auth: AuthContextValue): boolean {
  if (!auth.user) return false;
  if (auth.user.role === "super_admin") return true;
  return isOnSales(auth);
}
