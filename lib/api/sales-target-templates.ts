/**
 * Sales target templates — preset target configurations applied when a new
 * rep is created via the Add Member stepper.
 *
 * Base: /api/v1/sales/target-templates.
 * SALES_SUBADMIN has read-only access; SALES_ADMIN + SUPER_ADMIN can mutate.
 */

import { apiData, apiRequest } from "./client";
import type { MetricKey, MetricPeriod } from "./sales-metric-targets";

export type TargetTemplateValues = Partial<
  Record<MetricKey, Partial<Record<MetricPeriod, number>>>
>;

export interface TargetTemplate {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  is_default: boolean;
  targets: TargetTemplateValues;
  created_by: string;
  created_at: string;
}

export interface ListTargetTemplatesResponse {
  templates: TargetTemplate[];
}

export function listTargetTemplates(
  signal?: AbortSignal,
): Promise<TargetTemplate[]> {
  // Server returns `{ data: { templates: [...] } }`; apiData strips the data
  // envelope but leaves the `templates` wrapper.
  return apiData<ListTargetTemplatesResponse | TargetTemplate[]>(
    "/api/v1/sales/target-templates",
    { signal },
  ).then((res) => (Array.isArray(res) ? res : res.templates ?? []));
}

export function getTargetTemplate(
  id: string,
  signal?: AbortSignal,
): Promise<TargetTemplate> {
  return apiData<TargetTemplate>(`/api/v1/sales/target-templates/${id}`, {
    signal,
  });
}

export interface CreateTargetTemplateInput {
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  targets: TargetTemplateValues;
}

export function createTargetTemplate(
  input: CreateTargetTemplateInput,
): Promise<TargetTemplate> {
  return apiData<TargetTemplate>("/api/v1/sales/target-templates", {
    method: "POST",
    body: input,
  });
}

export type UpdateTargetTemplateInput = Partial<CreateTargetTemplateInput>;

export function updateTargetTemplate(
  id: string,
  patch: UpdateTargetTemplateInput,
): Promise<TargetTemplate> {
  return apiData<TargetTemplate>(`/api/v1/sales/target-templates/${id}`, {
    method: "PATCH",
    body: patch,
  });
}

/** Full-replace variant of update. All fields must be provided. */
export function replaceTargetTemplate(
  id: string,
  body: CreateTargetTemplateInput,
): Promise<TargetTemplate> {
  return apiData<TargetTemplate>(`/api/v1/sales/target-templates/${id}`, {
    method: "PUT",
    body,
  });
}

export function deleteTargetTemplate(id: string): Promise<void> {
  return apiRequest<void>(`/api/v1/sales/target-templates/${id}`, {
    method: "DELETE",
  });
}
