"use client";

import {
  getHospital,
  listHospitals,
  type ListHospitalsQuery,
} from "@/lib/api/hospitals";

import { useAsync } from "./use-async";

export function useHospitals(q: ListHospitalsQuery = {}) {
  return useAsync(
    (signal) => listHospitals(q, signal),
    [q.q, q.city, q.sort, q.page, q.limit],
  );
}

export function useHospital(id: string | null) {
  return useAsync(
    (signal) => (id ? getHospital(id, signal) : Promise.resolve(null)),
    [id],
  );
}
