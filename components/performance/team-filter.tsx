"use client";

import { cn } from "@/lib/utils";
import { teamDotClass } from "@/lib/format";
import { teams } from "@/lib/mock-data";
import type { TeamId } from "@/lib/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type TeamFilterValue = "all" | TeamId;

interface TeamFilterProps {
  value: TeamFilterValue;
  onChange: (next: TeamFilterValue) => void;
  className?: string;
}

export function TeamFilter({ value, onChange, className }: TeamFilterProps) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as TeamFilterValue)}>
      <SelectTrigger className={cn("w-[10rem]", className)} aria-label="Filter by team">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">
          <span className="flex items-center gap-2">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
            All teams
          </span>
        </SelectItem>
        {teams.map((t) => (
          <SelectItem key={t.id} value={t.id}>
            <span className="flex items-center gap-2">
              <span
                aria-hidden
                className={cn("h-1.5 w-1.5 rounded-full", teamDotClass(t.id))}
              />
              {t.name}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
