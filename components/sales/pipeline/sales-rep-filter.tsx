"use client";

import { useMemo, useState } from "react";
import { Check, Plus, Search } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { getInitials } from "@/lib/format";
import type { User } from "@/lib/types";

interface SalesRepFilterProps {
  /** All sales reps available for filtering. */
  reps: User[];
  /** Currently selected rep ids. Empty array = no filter (all reps). */
  selected: string[];
  onChange: (ids: string[]) => void;
  /** Per-rep lead count, keyed by rep id. */
  countsById: Record<string, number>;
}

// Always show at least 3 chips so the strip looks anchored even before
// anyone is picked, and never more than 5 so it doesn't overrun the
// toolbar. Anything beyond MAX collapses into a "+N" overflow chip and
// stays reachable through the dropdown.
const MIN_VISIBLE = 3;
const MAX_VISIBLE = 5;

/**
 * Avatar group + add-trigger that lets admins compare multiple sales reps
 * side-by-side. The chip strip always renders 3-5 reps (selected first,
 * then the next-busiest unselected reps as previews); clicking a chip
 * toggles that rep, and the dotted "+" pill opens a search popover with
 * the full roster.
 */
export function SalesRepFilter({
  reps,
  selected,
  onChange,
  countsById,
}: SalesRepFilterProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  // Build the chip strip in two layers: selected reps come first (in the
  // order the admin picked them), then the busiest unpicked reps fill the
  // remaining slots up to MIN_VISIBLE. This way the strip is always
  // anchored — three chips minimum even with no selection, and the most
  // useful preview avatars surface first.
  const previewReps = useMemo<User[]>(() => {
    const selectedSet = new Set(selected);
    const selectedFirst = reps.filter((r) => selectedSet.has(r.id));
    const unselectedByVolume = reps
      .filter((r) => !selectedSet.has(r.id))
      .sort((a, b) => (countsById[b.id] ?? 0) - (countsById[a.id] ?? 0));

    const target = Math.max(MIN_VISIBLE, selectedFirst.length);
    const cap = Math.min(MAX_VISIBLE, reps.length);
    const slots = Math.min(target, cap);

    const out = [...selectedFirst.slice(0, slots)];
    for (const r of unselectedByVolume) {
      if (out.length >= slots) break;
      out.push(r);
    }
    return out;
  }, [reps, selected, countsById]);

  const overflow = Math.max(
    0,
    selected.length - previewReps.filter((r) => selected.includes(r.id)).length,
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return reps;
    return reps.filter((r) => r.name.toLowerCase().includes(q));
  }, [reps, query]);

  const toggle = (id: string) => {
    onChange(
      selected.includes(id)
        ? selected.filter((x) => x !== id)
        : [...selected, id],
    );
  };

  const repColor = (id: string) =>
    REP_AVATAR_COLORS[hash(id) % REP_AVATAR_COLORS.length]!;

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center -space-x-1.5">
        {previewReps.map((r) => {
          const isSelected = selected.includes(r.id);
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => toggle(r.id)}
              aria-pressed={isSelected}
              title={r.name}
              className={cn(
                "relative grid h-7 w-7 place-items-center rounded-full border-2 text-[10px] font-semibold text-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                repColor(r.id),
                // Selected → solid color + ring halo; unselected → muted
                // so the strip doubles as a preview without implying every
                // chip is filtering.
                isSelected
                  ? "border-background ring-2 ring-zinc-900 ring-offset-1 ring-offset-background dark:ring-zinc-100"
                  : "border-background opacity-70 hover:opacity-100",
              )}
            >
              {getInitials(r.name)}
            </button>
          );
        })}
        {overflow > 0 ? (
          <span
            className="grid h-7 w-7 place-items-center rounded-full border-2 border-background bg-zinc-200 text-[10px] font-semibold text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200"
            title={`${overflow} more selected`}
          >
            +{overflow}
          </span>
        ) : null}
      </div>

      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Filter by sales rep"
            className="grid h-7 w-7 place-items-center rounded-full border-2 border-dashed border-zinc-300 text-zinc-500 transition-colors hover:border-zinc-400 hover:text-zinc-700 dark:border-zinc-700 dark:hover:border-zinc-500 dark:hover:text-zinc-300"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-72 p-0">
          <div className="border-b border-zinc-200 p-2 dark:border-zinc-800">
            <div className="relative">
              <Search
                aria-hidden
                className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400"
              />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter by sales rep..."
                className="h-8 border-zinc-200 pl-7 text-sm dark:border-zinc-800"
                autoFocus
              />
            </div>
          </div>

          <ul className="max-h-72 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-6 text-center text-xs text-zinc-500">
                No matching reps.
              </li>
            ) : (
              filtered.map((r) => {
                const isSelected = selected.includes(r.id);
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => toggle(r.id)}
                      className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-zinc-900"
                    >
                      <Avatar className={cn("h-7 w-7", repColor(r.id))}>
                        <AvatarFallback className="bg-transparent text-[10px] font-semibold text-white">
                          {getInitials(r.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="min-w-0 flex-1 truncate text-zinc-900 dark:text-zinc-100">
                        {r.name}
                      </span>
                      <span className="tabular-nums text-xs text-zinc-500">
                        {countsById[r.id] ?? 0}
                      </span>
                      <span className="grid h-4 w-4 shrink-0 place-items-center text-zinc-700 dark:text-zinc-300">
                        {isSelected ? <Check className="h-3.5 w-3.5" /> : null}
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </DropdownMenuContent>
      </DropdownMenu>

      {selected.length > 0 ? (
        <button
          type="button"
          onClick={() => onChange([])}
          className="text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          Clear
        </button>
      ) : null}
    </div>
  );
}

// Stable, high-contrast colors for rep avatars. Picked deterministically from
// the rep id so the same rep always gets the same color across renders.
const REP_AVATAR_COLORS = [
  "bg-orange-500",
  "bg-sky-500",
  "bg-rose-500",
  "bg-emerald-500",
  "bg-indigo-500",
  "bg-amber-500",
  "bg-violet-500",
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h;
}
