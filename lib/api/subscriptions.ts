/**
 * Hospital subscription plans & assignment API.
 *
 * Endpoints (per docs/BACKEND_API_SPEC_HOSPITAL_CREATION.md §8-10):
 *   GET  /api/v1/subscriptions/plans
 *   POST /api/v1/subscriptions/plans                  (super_admin)
 *   PUT  /api/v1/subscriptions/plans/:id              (super_admin)
 *   DELETE /api/v1/subscriptions/plans/:id            (super_admin)
 *   POST /api/v1/subscriptions/assign                 (super_admin)
 *   GET  /api/v1/subscriptions/hospital/:hospitalId
 *   GET  /api/v1/subscriptions/hospital/:hospitalId/history
 */

import { apiData } from "./client";

export type BillingCycle = "monthly" | "quarterly" | "half_yearly" | "yearly";

export interface SubscriptionPlan {
  id: number;
  name: string;
  call_limit?: number;
  appointments_limit?: number;
  branch_limit: number;
  price?: number;
  monthly_price: number;
  quarterly_price_per_month?: number;
  half_yearly_price_per_month?: number;
  yearly_price_per_month?: number;
  billing_cycles?: BillingCycle[];
  description?: string;
}

export interface HospitalSubscription {
  id: string;
  hospital_id: string;
  plan_id: number;
  plan_name: string;
  billing_cycle: BillingCycle;
  payment_mode: "online" | "offline" | "free";
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED" | "TRIAL";
  is_active: boolean;
  start_date: string;
  end_date: string;
  appointments_limit: number;
  appointments_used: number;
  usage_percent: number;
  next_billing_date: string;
  days_until_renewal: number;
  price: number;
}

export interface SubscriptionEvent {
  id: string;
  hospital_id: string;
  event_type:
    | "CREATED"
    | "ASSIGNED"
    | "RENEWED"
    | "UPDATED"
    | "SUSPENDED"
    | "EXPIRED"
    | "PAYMENT";
  occurred_at: string;
  details?: Record<string, unknown>;
}

export function listSubscriptionPlans(
  signal?: AbortSignal,
): Promise<SubscriptionPlan[]> {
  return apiData<SubscriptionPlan[]>("/api/v1/subscriptions/plans", {
    signal,
  });
}

export interface AssignSubscriptionInput {
  hospital_id: string;
  plan_id: number;
  billing_cycle: BillingCycle;
  payment_mode: "online" | "offline" | "free";
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED" | "TRIAL";
  renew_subscription?: boolean;
}

export function assignSubscription(
  input: AssignSubscriptionInput,
): Promise<HospitalSubscription> {
  return apiData<HospitalSubscription>("/api/v1/subscriptions/assign", {
    method: "POST",
    body: input,
  });
}

export function getHospitalSubscription(
  hospitalId: string,
  signal?: AbortSignal,
): Promise<HospitalSubscription | null> {
  return apiData<HospitalSubscription | null>(
    `/api/v1/subscriptions/hospital/${hospitalId}`,
    { signal },
  );
}

export function getHospitalSubscriptionHistory(
  hospitalId: string,
  signal?: AbortSignal,
): Promise<SubscriptionEvent[]> {
  return apiData<SubscriptionEvent[]>(
    `/api/v1/subscriptions/hospital/${hospitalId}/history`,
    { signal },
  );
}
