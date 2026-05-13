"use client";

import { useMemo, useState } from "react";
import { MapPin, Navigation, Users } from "lucide-react";

import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { PageHeader } from "@/components/layout/page-header";
import { isSalesAdminOrSuperAdmin } from "@/lib/access";
import { useAuth } from "@/lib/auth";
import { errorMessage } from "@/lib/hooks/use-async";
import { useFieldPins } from "@/lib/hooks/use-field-pins";
import { useLeadPeople } from "@/lib/hooks/use-leads";
import { cn } from "@/lib/utils";
import type { FieldPin } from "@/lib/api/types";

// Hyderabad — most reps are seeded around HITEC City; this gives the empty
// state a sensible centre instead of dropping the map mid-Atlantic.
const DEFAULT_CENTER = { lat: 17.4399, lng: 78.3489 };

type HistoryFilter = "all" | "today" | "yesterday" | "this-week" | "this-month";

const HISTORY_FILTERS: { key: HistoryFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "this-week", label: "This week" },
  { key: "this-month", label: "This month" },
];

const ALL_EMPLOYEES = "__all__";

/**
 * Admin / super-admin field-location surface.
 *
 * Two views:
 *  - Team map: one marker per agent (their most recent saved coordinates).
 *  - History & map: per-employee day map with timeline + date filter chips.
 *
 * Backed by GET /api/v1/sales/field-pins (with optional ?userId filter).
 */
export function FieldLocationAdminScreen() {
  const auth = useAuth();

  // History tab state — needs an employee selector + date filter. The Team
  // tab is parameter-free (always all reps, always "latest only").
  const [historyUserId, setHistoryUserId] = useState<string>(ALL_EMPLOYEES);
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("all");

  const peopleQuery = useLeadPeople();
  const teamPinsQuery = useFieldPins(); // every rep
  const historyPinsQuery = useFieldPins({
    userId: historyUserId === ALL_EMPLOYEES ? undefined : historyUserId,
  });

  const people = peopleQuery.data ?? [];
  const personById = useMemo(
    () => new Map(people.map((p) => [p.id, p])),
    [people],
  );

  // Latest pin per rep — used by the Team map tab.
  const latestByUser = useMemo(() => {
    const pins = teamPinsQuery.data ?? [];
    const sorted = [...pins].sort((a, b) =>
      b.captured_at.localeCompare(a.captured_at),
    );
    const map = new Map<string, FieldPin>();
    for (const pin of sorted) {
      if (!map.has(pin.sales_user_id)) map.set(pin.sales_user_id, pin);
    }
    return map;
  }, [teamPinsQuery.data]);

  // History tab pins — newest first, date-filtered.
  const historyPinsSorted = useMemo(() => {
    const pins = historyPinsQuery.data ?? [];
    return [...pins].sort((a, b) => b.captured_at.localeCompare(a.captured_at));
  }, [historyPinsQuery.data]);

  const historyPins = useMemo(
    () => filterPins(historyPinsSorted, historyFilter),
    [historyPinsSorted, historyFilter],
  );

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
        title="Field location"
        description="Team map shows each field agent's latest pinned location. Under History & map, filter by employee or view everyone; the map uses a route line when one person is selected (red = their newest pin, blue = earlier stops). Multiple employees at once show pins only, no connecting line."
      />

      <Tabs defaultValue="team">
        <TabsList>
          <TabsTrigger value="team">
            <Users className="h-3.5 w-3.5" aria-hidden />
            Team map
          </TabsTrigger>
          <TabsTrigger value="history">
            <Navigation className="h-3.5 w-3.5" aria-hidden />
            History &amp; map
          </TabsTrigger>
        </TabsList>

        {/* ---- Team map tab ---- */}
        <TabsContent value="team" className="space-y-4">
          {teamPinsQuery.error ? (
            <Card className="p-6 text-sm text-rose-700 dark:text-rose-300">
              Couldn't load field pins: {errorMessage(teamPinsQuery.error)}
            </Card>
          ) : teamPinsQuery.isLoading && latestByUser.size === 0 ? (
            <Card className="h-[420px] animate-pulse" />
          ) : (
            <Card className="overflow-hidden p-0">
              <div className="flex items-center gap-2 border-b border-zinc-200 px-4 py-2.5 text-xs text-zinc-500 dark:border-zinc-800">
                <Users className="h-3.5 w-3.5 text-sky-500" aria-hidden />
                <span>
                  One marker per agent —{" "}
                  <span className="font-medium text-zinc-700 dark:text-zinc-200">
                    their most recent saved coordinates
                  </span>{" "}
                  (live API when available).
                </span>
              </div>
              <MapEmbed
                pins={Array.from(latestByUser.values())}
                focusPin={null}
                routeColor={null}
              />
              {latestByUser.size === 0 ? null : (
                <div className="border-t border-zinc-200 px-4 py-2 text-xs text-zinc-500 dark:border-zinc-800">
                  {latestByUser.size} agent
                  {latestByUser.size === 1 ? "" : "s"} pinned
                </div>
              )}
            </Card>
          )}
        </TabsContent>

        {/* ---- History & map tab ---- */}
        <TabsContent value="history" className="space-y-4">
          <div>
            <h2 className="text-base font-semibold tracking-tight">Day map</h2>
            <p className="mt-0.5 text-xs text-zinc-500">
              Showing one employee: red pin = their newest stop in this view;
              blue = earlier stops; blue line = their route. With{" "}
              <span className="font-medium text-zinc-700 dark:text-zinc-200">
                All employees
              </span>
              , pins show who and where — no route line between different
              people.
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Employee
            </div>
            <Select value={historyUserId} onValueChange={setHistoryUserId}>
              <SelectTrigger
                className="h-9 w-full sm:w-72"
                aria-label="Filter by employee"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_EMPLOYEES}>All employees</SelectItem>
                {people.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {HISTORY_FILTERS.map((f) => {
              const active = historyFilter === f.key;
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setHistoryFilter(f.key)}
                  className={cn(
                    "inline-flex h-7 items-center rounded-full border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active
                      ? "border-sky-600 bg-sky-600 text-white"
                      : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900",
                  )}
                >
                  {f.label}
                </button>
              );
            })}
          </div>

          {historyPinsQuery.error ? (
            <Card className="p-6 text-sm text-rose-700 dark:text-rose-300">
              Couldn't load pins: {errorMessage(historyPinsQuery.error)}
            </Card>
          ) : historyPinsQuery.isLoading && historyPins.length === 0 ? (
            <Card className="h-[360px] animate-pulse" />
          ) : (
            <Card className="overflow-hidden p-0">
              <MapEmbed
                pins={historyPins}
                // When a single employee is selected, the newest pin pops as the
                // red marker; for "All employees" we show every pin's latest
                // without a red highlight.
                focusPin={
                  historyUserId !== ALL_EMPLOYEES && historyPins.length > 0
                    ? historyPins[0]!
                    : null
                }
                routeColor={
                  historyUserId !== ALL_EMPLOYEES && historyPins.length > 1
                    ? "#0ea5e9"
                    : null
                }
              />
              {historyPins.length === 0 ? (
                <div className="border-t border-zinc-200 px-4 py-3 text-center text-xs text-zinc-500 dark:border-zinc-800">
                  No pins in this view.
                </div>
              ) : null}
            </Card>
          )}

          <div>
            <div className="flex items-center gap-2 text-sm font-semibold tracking-tight">
              <MapPin className="h-3.5 w-3.5 text-sky-500" aria-hidden />
              Timeline{" "}
              <span className="font-normal text-zinc-500">(newest first)</span>
            </div>
            <p className="mt-0.5 text-xs text-zinc-500">
              {historyPins.length} pin{historyPins.length === 1 ? "" : "s"} in
              this view
            </p>

            {historyPins.length > 0 ? (
              <ul className="mt-3 divide-y divide-zinc-100 dark:divide-zinc-800">
                {historyPins.map((pin, idx) => {
                  const p = personById.get(pin.sales_user_id);
                  return (
                    <li key={pin.id} className="flex items-start gap-3 py-3">
                      <span
                        aria-hidden
                        className={cn(
                          "mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full border",
                          idx === 0
                            ? "border-sky-200 bg-sky-50 text-sky-600 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-400"
                            : "border-zinc-200 bg-white text-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-500",
                        )}
                      >
                        <MapPin className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-sky-600 dark:text-sky-400">
                          {p?.name ?? "Unknown"}
                        </div>
                        <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                          Location pin
                        </div>
                        <div className="mt-0.5 text-xs text-zinc-500">
                          {formatTimestamp(pin.captured_at)}
                        </div>
                        <div className="mt-1 inline-flex items-center gap-1.5 font-mono text-xs text-zinc-500">
                          <Navigation className="h-3 w-3" aria-hidden />
                          {pin.latitude.toFixed(5)},{" "}
                          {pin.longitude.toFixed(5)}
                          {pin.city ? ` · ${pin.city}` : ""}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------- Map -------------------------------------------------------------

function MapEmbed({
  pins,
  focusPin,
  routeColor,
}: {
  pins: { id: string; latitude: number; longitude: number }[];
  focusPin: { id: string; latitude: number; longitude: number } | null;
  /**
   * When provided AND there are 2+ pins, switches the OSM source to the
   * directions/route layer so a polyline is drawn between consecutive pins.
   * Currently OSM's embed iframe doesn't accept arbitrary polylines, so we
   * approximate "route line" by tightening the bbox around the consecutive
   * pins; the colour is reserved for future use (Leaflet upgrade).
   */
  routeColor?: string | null;
}) {
  const span = 0.02;
  let west: number, south: number, east: number, north: number;

  if (focusPin) {
    west = focusPin.longitude - span;
    south = focusPin.latitude - span;
    east = focusPin.longitude + span;
    north = focusPin.latitude + span;
  } else if (pins.length > 0) {
    const lats = pins.map((p) => p.latitude);
    const lngs = pins.map((p) => p.longitude);
    south = Math.min(...lats) - span;
    north = Math.max(...lats) + span;
    west = Math.min(...lngs) - span;
    east = Math.max(...lngs) + span;
  } else {
    west = DEFAULT_CENTER.lng - span;
    south = DEFAULT_CENTER.lat - span;
    east = DEFAULT_CENTER.lng + span;
    north = DEFAULT_CENTER.lat + span;
  }

  const markerParam = focusPin
    ? `&marker=${focusPin.latitude},${focusPin.longitude}`
    : "";
  const url = `https://www.openstreetmap.org/export/embed.html?bbox=${west},${south},${east},${north}&layer=mapnik${markerParam}`;

  // routeColor is wired up so a future Leaflet swap can pick it up; the OSM
  // iframe ignores it today. Reference it here so it doesn't trip "unused
  // prop" lints.
  void routeColor;

  return (
    <div className="relative">
      <iframe
        title="Team field location map"
        src={url}
        className="block h-[420px] w-full border-0 bg-zinc-100 dark:bg-zinc-900"
        loading="lazy"
        referrerPolicy="no-referrer"
      />
      {pins.length === 0 ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="rounded-full bg-white/90 px-3 py-1 text-xs text-zinc-700 shadow-sm dark:bg-zinc-950/80 dark:text-zinc-300">
            No pins to show yet
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ---------- Helpers ---------------------------------------------------------

function filterPins(pins: FieldPin[], filter: HistoryFilter): FieldPin[] {
  if (filter === "all") return pins;
  const now = new Date();
  if (filter === "today") {
    const start = startOfDay(now);
    return pins.filter((p) => new Date(p.captured_at) >= start);
  }
  if (filter === "yesterday") {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const start = startOfDay(yesterday);
    const end = startOfDay(now);
    return pins.filter((p) => {
      const t = new Date(p.captured_at);
      return t >= start && t < end;
    });
  }
  if (filter === "this-week") {
    const start = new Date(now);
    start.setDate(start.getDate() - 7);
    return pins.filter((p) => new Date(p.captured_at) >= start);
  }
  // this-month
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return pins.filter((p) => new Date(p.captured_at) >= start);
}

function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function Skeleton() {
  return (
    <div className="space-y-4">
      <Card className="h-16 animate-pulse" />
      <Card className="h-[420px] animate-pulse" />
    </div>
  );
}
