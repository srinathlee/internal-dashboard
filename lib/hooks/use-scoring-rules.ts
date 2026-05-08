"use client";

import { useCallback } from "react";

import {
  getLiveScoringRuleSet,
  listScoringRuleSets,
  publishScoringRuleSet,
  restoreScoringRuleSet,
} from "@/lib/api/sales-scoring";
import type { PublishRuleInput } from "@/lib/api/types";

import { useAsync } from "./use-async";

export function useLiveScoringRuleSet() {
  return useAsync((signal) => getLiveScoringRuleSet(signal), []);
}

export function useScoringRuleSets() {
  return useAsync((signal) => listScoringRuleSets(signal), []);
}

export function useScoringRuleMutations() {
  return {
    publish: useCallback(
      (rules: PublishRuleInput[]) => publishScoringRuleSet(rules),
      [],
    ),
    restore: useCallback(
      (versionId: string | number) => restoreScoringRuleSet(versionId),
      [],
    ),
  };
}
