"use client";

import { useCallback } from "react";

import {
  createHospital,
  deleteHospitalImage,
  getHospital,
  listHospitals,
  updateHospitalImage,
  type CreateHospitalInput,
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

export function useHospitalMutations() {
  return {
    create: useCallback(
      (input: CreateHospitalInput) => createHospital(input),
      [],
    ),
    setImage: useCallback(
      (id: string, url: string) => updateHospitalImage(id, url),
      [],
    ),
    clearImage: useCallback((id: string) => deleteHospitalImage(id), []),
  };
}
