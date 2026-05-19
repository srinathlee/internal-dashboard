"use client";

import { useCallback } from "react";

import {
  createTargetTemplate,
  deleteTargetTemplate,
  getTargetTemplate,
  listTargetTemplates,
  replaceTargetTemplate,
  updateTargetTemplate,
  type CreateTargetTemplateInput,
  type UpdateTargetTemplateInput,
} from "@/lib/api/sales-target-templates";

import { useAsync } from "./use-async";

export function useTargetTemplates() {
  return useAsync((signal) => listTargetTemplates(signal), []);
}

export function useTargetTemplate(id: string | null) {
  return useAsync(
    (signal) => (id ? getTargetTemplate(id, signal) : Promise.resolve(null)),
    [id],
  );
}

export function useTargetTemplateMutations() {
  return {
    create: useCallback(
      (input: CreateTargetTemplateInput) => createTargetTemplate(input),
      [],
    ),
    update: useCallback(
      (id: string, patch: UpdateTargetTemplateInput) =>
        updateTargetTemplate(id, patch),
      [],
    ),
    replace: useCallback(
      (id: string, body: CreateTargetTemplateInput) =>
        replaceTargetTemplate(id, body),
      [],
    ),
    remove: useCallback((id: string) => deleteTargetTemplate(id), []),
  };
}
