/**
 * Barrel export for the Sales API surface. Import from "@/lib/api"
 * to access endpoints, types, and the underlying client.
 */

export * from "./client";
export * from "./types";
export * as auth from "./auth";
export * as overview from "./sales-overview";
export * as users from "./sales-users";
export * as leads from "./sales-leads";
export * as subadmins from "./sales-subadmins";
export * as fieldPins from "./sales-field-pins";
export * as scoring from "./sales-scoring";
export * as revenueTargets from "./sales-revenue-targets";
export * as audit from "./sales-audit";
export * as scorecard from "./sales-scorecard";
