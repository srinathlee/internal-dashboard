/**
 * Section 5 of the Sales API: Field pins (self-service location).
 */

import { apiData } from "./client";
import type { FieldPin } from "./types";

export function createFieldPin(input: {
  lat: number;
  lng: number;
}): Promise<FieldPin> {
  return apiData<FieldPin>("/api/v1/sales/field-pins", {
    method: "POST",
    body: input,
  });
}

export interface ListFieldPinsQuery {
  userId?: string;
  from?: string;
  to?: string;
}

export function listFieldPins(
  q: ListFieldPinsQuery = {},
  signal?: AbortSignal,
): Promise<FieldPin[]> {
  return apiData<FieldPin[]>("/api/v1/sales/field-pins", {
    query: q,
    signal,
  });
}

export function clearFieldPins(
  userId?: string,
): Promise<{ cleared: number; userId: string }> {
  return apiData("/api/v1/sales/field-pins", {
    method: "DELETE",
    body: userId ? { userId } : undefined,
  });
}
