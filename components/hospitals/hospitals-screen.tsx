"use client";

import { useMemo, useState } from "react";
import { Building2, Search } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/layout/page-header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { errorMessage } from "@/lib/hooks/use-async";
import { useHospitals } from "@/lib/hooks/use-hospitals";

import { HospitalCard } from "./hospital-card";

type SortKey = "name-asc" | "name-desc" | "branches-desc" | "users-desc";

const SORTS: { value: SortKey; label: string }[] = [
  { value: "name-asc", label: "Name (A → Z)" },
  { value: "name-desc", label: "Name (Z → A)" },
  { value: "branches-desc", label: "Most branches" },
  { value: "users-desc", label: "Most appointments" },
];

const ALL_CITY = "__all__";

/**
 * "All hospitals" is the rep's clinic directory.
 *
 * Backed by GET /api/v1/sales/hospitals (spec §8). Sorting is done
 * client-side after we have the rows so the dropdown can flip without an
 * extra round-trip; search and city filtering are sent server-side via
 * the query params.
 */
export function HospitalsScreen() {
  const auth = useAuth();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("name-asc");
  const [city, setCity] = useState<string>(ALL_CITY);

  const hospitalsQuery = useHospitals({
    q: search.trim() || undefined,
    city: city === ALL_CITY ? undefined : city,
    limit: 100,
  });

  const hospitals = hospitalsQuery.data?.hospitals ?? [];

  const cities = useMemo(
    () =>
      Array.from(new Set(hospitals.map((h) => h.city).filter(Boolean))).sort(),
    [hospitals],
  );

  const filtered = useMemo(() => {
    let list = hospitals.filter((h) => {
      if (city !== ALL_CITY && h.city !== city) return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      switch (sort) {
        case "name-asc":
          return a.name.localeCompare(b.name);
        case "name-desc":
          return b.name.localeCompare(a.name);
        case "branches-desc":
          return b.branchCount - a.branchCount;
        case "users-desc":
          return b.userCount - a.userCount;
      }
    });
    return list;
  }, [hospitals, city, sort]);

  if (!auth.isLoaded) return <Skeleton />;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div
          aria-hidden
          className="grid h-9 w-9 place-items-center rounded-lg bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400"
        >
          <Building2 className="h-4 w-4" />
        </div>
        <PageHeader
          title="All Hospitals"
          description={`${hospitals.length} hospitals · search, sort and filter below`}
        />
      </div>

      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
            />
            <Input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, address, city, or phone…"
              className="h-10 pl-9"
              aria-label="Search hospitals"
            />
          </div>

          <Select value={city} onValueChange={setCity}>
            <SelectTrigger
              className="h-10 w-full sm:w-[10rem]"
              aria-label="Filter by city"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_CITY}>All cities</SelectItem>
              {cities.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger
              className="h-10 w-full sm:w-[12rem]"
              aria-label="Sort hospitals"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORTS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {hospitalsQuery.error ? (
        <Card className="border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-300">
          Couldn't load hospitals: {errorMessage(hospitalsQuery.error)}
        </Card>
      ) : hospitalsQuery.isLoading && filtered.length === 0 ? (
        <Skeleton inline />
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center text-sm text-zinc-500">
          {search || city !== ALL_CITY
            ? "No hospitals match the current filters."
            : "No hospitals to show yet."}
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((h) => (
            <HospitalCard key={h.id} hospital={h} />
          ))}
        </div>
      )}
    </div>
  );
}

function Skeleton({ inline = false }: { inline?: boolean } = {}) {
  return (
    <div className={inline ? "space-y-3" : "space-y-6"}>
      {!inline && (
        <>
          <div className="space-y-2">
            <div className="h-7 w-48 animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-800" />
            <div className="h-4 w-72 animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-800" />
          </div>
          <Card className="h-16 animate-pulse" />
        </>
      )}
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i} className="h-24 animate-pulse" />
      ))}
    </div>
  );
}
