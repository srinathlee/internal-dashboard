"use client";

import { useMemo, useState } from "react";
import { Map as MapIcon, MapPin, Users } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/layout/page-header";
import { isSalesAdminOrSuperAdmin } from "@/lib/access";
import { useAuth } from "@/lib/auth";
import { getInitials } from "@/lib/format";
import { errorMessage } from "@/lib/hooks/use-async";
import { useFieldPins } from "@/lib/hooks/use-field-pins";
import { useLeadPeople } from "@/lib/hooks/use-leads";

/**
 * Admin / super-admin field-location surface.
 *
 * Lists every rep's recent field pins via GET /api/v1/sales/field-pins
 * (with optional ?userId filter).
 */
export function FieldLocationAdminScreen() {
  const auth = useAuth();
  const [userId, setUserId] = useState<string>("__all__");

  const peopleQuery = useLeadPeople();
  const pinsQuery = useFieldPins({
    userId: userId === "__all__" ? undefined : userId,
  });

  const people = peopleQuery.data ?? [];
  const personById = useMemo(
    () => new Map(people.map((p) => [p.id, p])),
    [people],
  );

  const pins = pinsQuery.data ?? [];
  const sorted = useMemo(
    () =>
      [...pins].sort((a, b) =>
        b.captured_at.localeCompare(a.captured_at),
      ),
    [pins],
  );

  // Latest pin per rep for the "where is everyone right now" view.
  const latestByUser = useMemo(() => {
    const map = new Map<string, (typeof sorted)[number]>();
    for (const pin of sorted) {
      if (!map.has(pin.sales_user_id)) {
        map.set(pin.sales_user_id, pin);
      }
    }
    return map;
  }, [sorted]);

  if (!auth.isLoaded) return <Skeleton />;
  if (!isSalesAdminOrSuperAdmin(auth)) {
    return (
      <div className="space-y-6">
        <PageHeader title="Field location" />
        <Card className="p-12 text-center text-sm text-zinc-500">
          The team field-location view is for super admins.
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team field location"
        description="See where reps last pinned themselves."
      />

      <div className="flex items-center gap-3">
        <Users className="h-4 w-4 text-zinc-400" aria-hidden />
        <Select value={userId} onValueChange={setUserId}>
          <SelectTrigger className="h-9 w-56" aria-label="Filter by rep">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All reps</SelectItem>
            {people.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {pinsQuery.error ? (
        <Card className="p-6 text-sm text-rose-700 dark:text-rose-300">
          Couldn't load field pins: {errorMessage(pinsQuery.error)}
        </Card>
      ) : pinsQuery.isLoading && pins.length === 0 ? (
        <Card className="h-72 animate-pulse" />
      ) : userId === "__all__" ? (
        <Card className="overflow-hidden">
          <div className="px-4 py-3 text-sm font-medium border-b border-zinc-200 dark:border-zinc-800">
            Latest pin per rep ({latestByUser.size})
          </div>
          {latestByUser.size === 0 ? (
            <div className="grid place-items-center py-12 text-center text-sm text-zinc-500">
              <MapIcon className="mb-2 h-6 w-6 text-zinc-400" aria-hidden />
              No pins captured yet.
            </div>
          ) : (
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {Array.from(latestByUser.values()).map((pin) => {
                const p = personById.get(pin.sales_user_id);
                return (
                  <li
                    key={pin.id}
                    className="flex items-center gap-3 px-4 py-3"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-[10px]">
                        {getInitials(p?.name ?? pin.sales_user_id)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">
                        {p?.name ?? "Unknown rep"}
                      </div>
                      <div className="text-xs text-zinc-500 font-mono">
                        {pin.latitude.toFixed(5)}, {pin.longitude.toFixed(5)}
                        {pin.city ? ` · ${pin.city}` : ""}
                      </div>
                    </div>
                    <div className="text-xs text-zinc-500 tabular-nums">
                      {new Date(pin.captured_at).toLocaleString()}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="px-4 py-3 text-sm font-medium border-b border-zinc-200 dark:border-zinc-800">
            Pin history ({sorted.length})
          </div>
          {sorted.length === 0 ? (
            <div className="grid place-items-center py-12 text-center text-sm text-zinc-500">
              No pins for this rep.
            </div>
          ) : (
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {sorted.map((pin, idx) => (
                <li
                  key={pin.id}
                  className="flex items-center gap-3 px-4 py-3"
                >
                  <span
                    aria-hidden
                    className={`grid h-7 w-7 shrink-0 place-items-center rounded-md ${
                      idx === 0
                        ? "bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400"
                        : "bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400"
                    }`}
                  >
                    <MapPin className="h-3.5 w-3.5" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-zinc-500">
                      {new Date(pin.captured_at).toLocaleString()}
                    </div>
                    <div className="text-xs text-zinc-500 font-mono">
                      {pin.latitude.toFixed(5)}, {pin.longitude.toFixed(5)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-4">
      <Card className="h-16 animate-pulse" />
      <Card className="h-72 animate-pulse" />
    </div>
  );
}
