"use client";

import { useMemo, useState } from "react";
import {
  Building2,
  Check,
  ChevronDown,
  Plus,
  Search,
  UserCircle2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth";
import { errorMessage } from "@/lib/hooks/use-async";
import { useHospitals } from "@/lib/hooks/use-hospitals";
import { cn } from "@/lib/utils";

import { CreateHospitalModal } from "./create-hospital-modal";
import { EditHospitalModal } from "./edit-hospital-modal";
import { HospitalCard } from "./hospital-card";

type SortKey = "name-asc" | "name-desc" | "branches-desc" | "users-desc";

const SORTS: { value: SortKey; label: string }[] = [
  { value: "name-asc", label: "Name (A → Z)" },
  { value: "name-desc", label: "Name (Z → A)" },
  { value: "branches-desc", label: "Most branches" },
  { value: "users-desc", label: "Most appointments" },
];

const ALL_CREATORS = "__all__";

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
  const [creator, setCreator] = useState<string>(ALL_CREATORS);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const hospitalsQuery = useHospitals({
    q: search.trim() || undefined,
    limit: 100,
  });

  const canCreate = auth.user?.role === "super_admin";
  const canEdit = canCreate;

  const hospitals = hospitalsQuery.data?.hospitals ?? [];

  // The API returns `created_by` as a display name string (e.g. "prudhvi"),
  // so we can group/filter directly on it — no user-id lookup needed.
  const creators = useMemo(() => {
    const set = new Set<string>();
    for (const h of hospitals) {
      const name = h.created_by?.trim();
      if (name) set.add(name);
    }
    return Array.from(set)
      .sort((a, b) => a.localeCompare(b))
      .map((name) => ({ id: name, name }));
  }, [hospitals]);

  const selectedCreatorName =
    creator === ALL_CREATORS ? "All creators" : creator;

  const filtered = useMemo(() => {
    let list = hospitals.filter((h) => {
      if (creator !== ALL_CREATORS && h.created_by !== creator) return false;
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
  }, [hospitals, creator, sort]);

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
          className="flex-1"
          title="All Hospitals"
          description={`${hospitals.length} hospitals · search, sort and filter below`}
          actions={
            canCreate ? (
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" />
                Create hospital
              </Button>
            ) : undefined
          }
        />
      </div>

      {canCreate ? (
        <CreateHospitalModal
          open={createOpen}
          onOpenChange={setCreateOpen}
          onCreated={(name) => {
            toast.success(`Hospital "${name}" created`);
            void hospitalsQuery.refetch();
          }}
        />
      ) : null}

      {canEdit ? (
        <EditHospitalModal
          open={editingId !== null}
          hospitalId={editingId}
          onOpenChange={(next) => {
            if (!next) setEditingId(null);
          }}
          onSaved={() => {
            void hospitalsQuery.refetch();
          }}
        />
      ) : null}

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

          <CreatorFilter
            creators={creators}
            selected={creator}
            selectedName={selectedCreatorName}
            onChange={setCreator}
          />

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
          {search || creator !== ALL_CREATORS
            ? "No hospitals match the current filters."
            : "No hospitals to show yet."}
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((h) => (
            <HospitalCard
              key={h.id}
              hospital={h}
              onEdit={
                canEdit ? (hospital) => setEditingId(hospital.id) : undefined
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CreatorFilter({
  creators,
  selected,
  selectedName,
  onChange,
}: {
  creators: { id: string; name: string }[];
  selected: string;
  selectedName: string;
  onChange: (next: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return creators;
    return creators.filter((c) => c.name.toLowerCase().includes(q));
  }, [creators, query]);

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Filter by creator"
          className="inline-flex h-10 w-full items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 text-sm transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900 sm:w-[12rem]"
        >
          <UserCircle2 className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />
          <span className="min-w-0 flex-1 truncate text-left">
            {selectedName}
          </span>
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 shrink-0 text-zinc-400 transition-transform",
              open && "rotate-180",
            )}
            aria-hidden
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64 p-0">
        <div className="border-b border-zinc-200 p-2 dark:border-zinc-800">
          <div className="relative">
            <Search
              aria-hidden
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400"
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search..."
              className="h-8 border-zinc-200 pl-7 text-sm dark:border-zinc-800"
              autoFocus
            />
          </div>
        </div>

        <ul className="max-h-72 overflow-y-auto py-1">
          <li>
            <button
              type="button"
              onClick={() => {
                onChange(ALL_CREATORS);
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors",
                selected === ALL_CREATORS
                  ? "bg-sky-50 font-semibold text-sky-700 dark:bg-sky-950/40 dark:text-sky-300"
                  : "text-zinc-900 hover:bg-zinc-50 dark:text-zinc-100 dark:hover:bg-zinc-900",
              )}
            >
              <span>All creators</span>
              {selected === ALL_CREATORS ? (
                <Check className="h-3.5 w-3.5" aria-hidden />
              ) : null}
            </button>
          </li>
          {filtered.length === 0 ? (
            <li className="px-3 py-6 text-center text-xs text-zinc-500">
              No matching creators.
            </li>
          ) : (
            filtered.map((c) => {
              const isSelected = selected === c.id;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(c.id);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors",
                      isSelected
                        ? "bg-sky-50 font-semibold text-sky-700 dark:bg-sky-950/40 dark:text-sky-300"
                        : "text-zinc-900 hover:bg-zinc-50 dark:text-zinc-100 dark:hover:bg-zinc-900",
                    )}
                  >
                    <span className="truncate">{c.name}</span>
                    {isSelected ? (
                      <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    ) : null}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </DropdownMenuContent>
    </DropdownMenu>
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
