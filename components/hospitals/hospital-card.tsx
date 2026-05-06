import {
  Building2,
  ChevronRight,
  Hash,
  ShieldCheck,
  User as UserIcon,
  UserCheck,
  type LucideIcon,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Hospital, User } from "@/lib/types";

interface HospitalCardProps {
  hospital: Hospital;
  /** User who created this hospital — provides the "Created by" name. */
  creator?: User;
}

/**
 * Hospital row matching the screenshot:
 *   chevron · icon · ( name + address + chip row )
 *
 * Chips: Admins, Users, Branches, Created by, NYRA AI Number.
 */
export function HospitalCard({ hospital, creator }: HospitalCardProps) {
  return (
    <Card className="flex items-stretch gap-4 p-5 transition-colors hover:border-zinc-300 dark:hover:border-zinc-700">
      <div className="flex flex-col items-center gap-3">
        <ChevronRight
          className="h-4 w-4 text-zinc-400"
          aria-hidden
        />
        <div
          aria-hidden
          className="grid h-12 w-12 place-items-center rounded-full bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400"
        >
          <Building2 className="h-5 w-5" />
        </div>
      </div>

      <div className="min-w-0 flex-1 space-y-2">
        <div>
          <h3 className="truncate text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            {hospital.name}
          </h3>
          <p className="mt-0.5 truncate text-sm text-zinc-500">
            {hospital.address}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Chip
            icon={ShieldCheck}
            label={`${hospital.adminCount} ${hospital.adminCount === 1 ? "Admin" : "Admins"}`}
          />
          <Chip
            icon={UserIcon}
            label={`${hospital.userCount} ${hospital.userCount === 1 ? "User" : "Users"}`}
          />
          <Chip
            icon={Building2}
            label={`${hospital.branchCount} ${hospital.branchCount === 1 ? "Branch" : "Branches"}`}
          />
          <Chip
            icon={UserCheck}
            label={
              <>
                Created by{" "}
                <span className={cn("font-medium", !creator && "text-zinc-400")}>
                  {creator ? creator.name.split(" ")[0] : "—"}
                </span>
              </>
            }
          />
          <Chip
            icon={Hash}
            label={
              <>
                <span className="text-zinc-500">NYRA AI Number</span>{" "}
                <span className="font-mono">{hospital.nyraAiNumber}</span>
              </>
            }
          />
        </div>
      </div>
    </Card>
  );
}

function Chip({
  icon: Icon,
  label,
}: {
  icon: LucideIcon;
  label: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-50 px-2.5 py-1 text-xs text-zinc-700 ring-1 ring-inset ring-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-800">
      <Icon className="h-3 w-3 text-zinc-400" aria-hidden />
      {label}
    </span>
  );
}
