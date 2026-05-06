"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  Calendar,
  History as HistoryIcon,
  Map as MapIcon,
  Maximize2,
  Navigation,
  RefreshCw,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
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
import { getInitials } from "@/lib/format";
import { REFERENCE_DATE, getTeamMembers } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import type { User } from "@/lib/types";

/**
 * Sales-admin field location screen. Two views:
 *  - Team map: one marker per active rep — their most recent pinned location.
 *  - History & map: filter by employee + day window, see pins on the map and
 *    a timeline (newest first). Selecting a single rep also draws a route line
 *    (red = newest stop, blue = earlier).
 *
 * Mock data is generated deterministically per-rep so reload behaviour is
 * stable. When a real API arrives, swap `useTeamPins` for a fetch hook —
 * everything else is presentational.
 */

// ---------- Types & mock data ---------------------------------------------

interface AdminPin {
  id: string;
  userId: string;
  lat: number;
  lng: number;
  /** ISO timestamp. */
  timestamp: string;
}

interface BBox {
  west: number;
  south: number;
  east: number;
  north: number;
}

type DayFilter = "all" | "today" | "yesterday" | "this-week" | "this-month";
type EmployeeFilter = "all" | string;

const DAY_FILTERS: { key: DayFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "this-week", label: "This week" },
  { key: "this-month", label: "This month" },
];

// Hyderabad, around the Hitec City / Kondapur corridor where most seed
// hospitals live. Keeps the mock map visually consistent with the rest of the
// app instead of dropping pins on a random continent.
const TEAM_CENTER = { lat: 17.45, lng: 78.38 };
const TEAM_BBOX_PADDING_DEG = 0.045;

const REFERENCE_INSTANT = new Date(`${REFERENCE_DATE}T18:30:00.000Z`).getTime();

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(...parts: string[]): number {
  let h = 2166136261;
  for (const part of parts) {
    for (let i = 0; i < part.length; i++) {
      h ^= part.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
  }
  return h >>> 0;
}

function generatePins(rep: User): AdminPin[] {
  const rng = mulberry32(hashSeed(rep.id, "field-pins-v1"));
  const count = 6 + Math.floor(rng() * 9); // 6–14 pins per rep
  const pins: AdminPin[] = [];
  for (let i = 0; i < count; i++) {
    // Pins drift back from the reference moment by a few hours each step,
    // with random jitter so reps' timelines don't all align.
    const stepHours = 4 + rng() * 18;
    const offsetHours =
      (i + 1) * stepHours + rng() * 12 - (rep.id.charCodeAt(2) % 6);
    const ts = REFERENCE_INSTANT - offsetHours * 3600 * 1000;
    const lat = TEAM_CENTER.lat + (rng() - 0.5) * 0.08;
    const lng = TEAM_CENTER.lng + (rng() - 0.5) * 0.12;
    pins.push({
      id: `pin_${rep.id}_${i}`,
      userId: rep.id,
      lat,
      lng,
      timestamp: new Date(ts).toISOString(),
    });
  }
  pins.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return pins;
}

// ---------- Screen --------------------------------------------------------

export function FieldLocationAdminScreen() {
  const auth = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);

  const reps = useMemo(
    () =>
      getTeamMembers("sales").filter(
        (u) => u.role === "member" && u.status === "active",
      ),
    [],
  );

  // refreshKey is included in the dependency array so "Refresh" forces a
  // re-roll without changing seeds (useful when we wire a real API).
  const pinsByRep = useMemo(() => {
    const map = new Map<string, AdminPin[]>();
    for (const rep of reps) map.set(rep.id, generatePins(rep));
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reps, refreshKey]);

  const allPins = useMemo(() => {
    const out: AdminPin[] = [];
    for (const list of pinsByRep.values()) out.push(...list);
    out.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    return out;
  }, [pinsByRep]);

  const repsById = useMemo(() => {
    const map = new Map<string, User>();
    for (const r of reps) map.set(r.id, r);
    return map;
  }, [reps]);

  if (!auth.isLoaded) return <ScreenSkeleton />;

  if (!isSalesAdminOrSuperAdmin(auth)) {
    return (
      <div className="space-y-6">
        <PageHeader title="Field location" />
        <Card className="p-12 text-center text-sm text-zinc-500">
          The team field-location view is for sales admins and super-admins.
        </Card>
      </div>
    );
  }

  const handleRefresh = () => {
    setRefreshKey((k) => k + 1);
    toast.success("Field locations refreshed.");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Field location"
        description="Team map shows each field agent's latest pinned location. Under History & map, filter by employee or view everyone; the map uses a route line when one person is selected (red = their newest pin, blue = earlier stops). Multiple employees at once show pins only, no connecting line."
      />

      <Tabs defaultValue="team">
        <TabsList>
          <TabsTrigger value="team" className="gap-1.5">
            <Users className="h-3.5 w-3.5" aria-hidden />
            Team map
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5">
            <HistoryIcon className="h-3.5 w-3.5" aria-hidden />
            History &amp; map
          </TabsTrigger>
        </TabsList>

        <TabsContent value="team" className="mt-4 space-y-4">
          <TeamMapTab
            reps={reps}
            pinsByRep={pinsByRep}
            onRefresh={handleRefresh}
          />
        </TabsContent>

        <TabsContent value="history" className="mt-4 space-y-4">
          <HistoryMapTab
            reps={reps}
            repsById={repsById}
            allPins={allPins}
            pinsByRep={pinsByRep}
            onRefresh={handleRefresh}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------- Team map tab --------------------------------------------------

function TeamMapTab({
  reps,
  pinsByRep,
  onRefresh,
}: {
  reps: User[];
  pinsByRep: Map<string, AdminPin[]>;
  onRefresh: () => void;
}) {
  // One marker per agent — their most recent ping.
  const latestPins = useMemo(() => {
    const out: { rep: User; pin: AdminPin }[] = [];
    for (const rep of reps) {
      const pins = pinsByRep.get(rep.id);
      if (pins && pins[0]) out.push({ rep, pin: pins[0] });
    }
    out.sort((a, b) => b.pin.timestamp.localeCompare(a.pin.timestamp));
    return out;
  }, [reps, pinsByRep]);

  const allLatestPinsOnly = latestPins.map((x) => x.pin);
  const bbox = useMemo(
    () => fitBBox(allLatestPinsOnly, TEAM_BBOX_PADDING_DEG),
    [allLatestPinsOnly],
  );

  return (
    <>
      <Card className="flex items-start gap-3 p-3">
        <span
          aria-hidden
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400"
        >
          <Users className="h-4 w-4" />
        </span>
        <p className="text-sm text-zinc-700 dark:text-zinc-300">
          One marker per agent — their most recent saved coordinates{" "}
          <span className="text-zinc-500">(live API when available).</span>
        </p>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="flex items-center justify-between gap-2 border-b border-zinc-200 px-4 py-2.5 text-xs text-zinc-500 dark:border-zinc-800">
          <span>
            <span className="font-medium tabular-nums text-zinc-700 dark:text-zinc-300">
              {latestPins.length}
            </span>{" "}
            agent{latestPins.length === 1 ? "" : "s"} on the map
          </span>
          <button
            type="button"
            onClick={onRefresh}
            aria-label="Refresh team map"
            className="grid h-7 w-7 place-items-center rounded-md border border-zinc-200 text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-zinc-800 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>

        <MapCanvas
          bbox={bbox}
          markers={latestPins.map(({ rep, pin }) => ({
            pin,
            rep,
            tone: "sky",
          }))}
        />
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-zinc-200 px-4 py-2.5 dark:border-zinc-800">
          <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            Latest stops
          </div>
          <div className="text-xs text-zinc-500">
            Sorted by who pinged most recently.
          </div>
        </div>
        {latestPins.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-zinc-500">
            No active reps reporting locations yet.
          </div>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {latestPins.map(({ rep, pin }) => (
              <li
                key={rep.id}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs">
                      {getInitials(rep.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {rep.name}
                    </div>
                    <div className="truncate font-mono text-[11px] text-zinc-500">
                      {formatCoord(pin.lat, pin.lng)}
                    </div>
                  </div>
                </div>
                <span className="shrink-0 text-xs text-zinc-500">
                  {formatRelative(pin.timestamp)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

// ---------- History & map tab --------------------------------------------

function HistoryMapTab({
  reps,
  repsById,
  allPins,
  pinsByRep,
  onRefresh,
}: {
  reps: User[];
  repsById: Map<string, User>;
  allPins: AdminPin[];
  pinsByRep: Map<string, AdminPin[]>;
  onRefresh: () => void;
}) {
  const [employee, setEmployee] = useState<EmployeeFilter>("all");
  const [day, setDay] = useState<DayFilter>("all");
  const [activePinId, setActivePinId] = useState<string | null>(null);

  const sourcePins = useMemo(() => {
    if (employee === "all") {
      // Cap to 50/rep (first page) when viewing everyone, matching the helper
      // copy. Single-employee view shows full history.
      const out: AdminPin[] = [];
      for (const rep of reps) {
        const list = pinsByRep.get(rep.id) ?? [];
        for (const p of list.slice(0, 50)) out.push(p);
      }
      out.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      return out;
    }
    return pinsByRep.get(employee) ?? [];
  }, [employee, reps, pinsByRep]);

  const visiblePins = useMemo(
    () => filterByDay(sourcePins, day),
    [sourcePins, day],
  );

  const singleAgent = employee !== "all";
  const latestPin = visiblePins[0] ?? null;
  const activePin =
    visiblePins.find((p) => p.id === activePinId) ?? latestPin;

  const bbox = useMemo(
    () => fitBBox(visiblePins, TEAM_BBOX_PADDING_DEG),
    [visiblePins],
  );

  const markers = useMemo(() => {
    if (!singleAgent) {
      return visiblePins.map((p) => ({
        pin: p,
        rep: repsById.get(p.userId) ?? null,
        tone: "sky" as MarkerTone,
      }));
    }
    return visiblePins.map((p, idx) => ({
      pin: p,
      rep: repsById.get(p.userId) ?? null,
      // Newest pin in the route is red; everything else uses blue.
      tone: idx === 0 ? ("rose" as MarkerTone) : ("indigo" as MarkerTone),
    }));
  }, [visiblePins, repsById, singleAgent]);

  // Sequential dates ascending → newest segment ends in red.
  const routeLine = singleAgent && visiblePins.length > 1 ? visiblePins : null;

  return (
    <>
      <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            Day map
          </h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            All active agents&apos; recent pins in the time range below. Each
            label is{" "}
            <span className="font-medium text-zinc-700 dark:text-zinc-300">
              Name · place
            </span>
            . Open{" "}
            <span className="font-medium text-zinc-700 dark:text-zinc-300">
              Team map
            </span>{" "}
            for latest-only markers.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onRefresh}>
          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          Refresh
        </Button>
      </Card>

      <Card className="space-y-3 p-4">
        <div className="grid gap-3 sm:max-w-md">
          <div className="space-y-1.5">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Employee
            </div>
            <Select
              value={employee}
              onValueChange={(v) => {
                setEmployee(v as EmployeeFilter);
                setActivePinId(null);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="All employees" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All employees</SelectItem>
                {reps.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-zinc-500">
            {singleAgent
              ? "Showing the full route for this rep — newest pin is red, earlier stops are blue."
              : "Showing up to 50 pins per person (first page). Choose one employee for full history, route line, and load more."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {DAY_FILTERS.map((f) => {
            const active = day === f.key;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => {
                  setDay(f.key);
                  setActivePinId(null);
                }}
                className={cn(
                  "inline-flex h-7 items-center rounded-full border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active
                    ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                    : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900",
                )}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        <MapCanvas
          bbox={bbox}
          markers={markers}
          routeLine={routeLine}
          activeId={activePin?.id ?? null}
        />
        <div className="flex items-center justify-between gap-2 border-t border-zinc-200 px-4 py-2 text-xs dark:border-zinc-800">
          <span className="text-zinc-500">
            {visiblePins.length === 0
              ? "No pins to display in this view."
              : activePin
                ? `Centred on ${formatCoord(activePin.lat, activePin.lng)}`
                : `${visiblePins.length} pin${visiblePins.length === 1 ? "" : "s"} in view`}
          </span>
          {activePin ? (
            <a
              href={osmFullLink(activePin)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
            >
              <Maximize2 className="h-3 w-3" aria-hidden />
              Open in OSM
            </a>
          ) : null}
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between">
          <h3 className="inline-flex items-center gap-1.5 text-sm font-semibold tracking-tight">
            <Navigation className="h-3.5 w-3.5 text-zinc-500" aria-hidden />
            Timeline · newest first
          </h3>
          <span className="text-xs tabular-nums text-zinc-500">
            {visiblePins.length} pin{visiblePins.length === 1 ? "" : "s"} in
            this view
          </span>
        </div>

        {visiblePins.length === 0 ? (
          <div className="mt-4 flex flex-col items-center justify-center py-12 text-center">
            <div
              aria-hidden
              className="grid h-10 w-10 place-items-center rounded-full bg-zinc-100 text-zinc-400 dark:bg-zinc-800"
            >
              <MapIcon className="h-5 w-5" />
            </div>
            <p className="mt-3 text-sm text-zinc-500">
              No pins for this filter combination.
            </p>
            <p className="mt-0.5 text-xs text-zinc-400">
              Try widening the date range or picking a different employee.
            </p>
          </div>
        ) : (
          <ul role="list" className="mt-3 space-y-2">
            {visiblePins.map((pin, idx) => {
              const rep = repsById.get(pin.userId) ?? null;
              const next = visiblePins[idx + 1] ?? null;
              const sincePrev = next ? deltaLabel(next.timestamp, pin.timestamp) : null;
              return (
                <li key={pin.id}>
                  <button
                    type="button"
                    onClick={() =>
                      setActivePinId(activePinId === pin.id ? null : pin.id)
                    }
                    aria-pressed={activePinId === pin.id}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-lg border border-zinc-200 bg-white p-3 text-left shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-zinc-800 dark:bg-zinc-950",
                      activePinId === pin.id
                        ? "border-sky-300 bg-sky-50/40 dark:border-sky-900 dark:bg-sky-950/20"
                        : "hover:bg-zinc-50 dark:hover:bg-zinc-900",
                    )}
                  >
                    <Avatar className="h-9 w-9 shrink-0">
                      <AvatarFallback className="text-xs">
                        {rep ? getInitials(rep.name) : "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-sky-700 dark:text-sky-400">
                        {rep ? abbreviateName(rep.name) : "Unknown"}
                      </div>
                      <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        Location pin
                      </div>
                      <div className="text-xs text-zinc-500">
                        {formatTimestamp(pin.timestamp)}
                      </div>
                      <div className="mt-1 inline-flex items-center gap-1.5 font-mono text-[11px] text-zinc-600 dark:text-zinc-400">
                        <Navigation className="h-3 w-3" aria-hidden />
                        {formatCoord(pin.lat, pin.lng)}
                      </div>
                      {sincePrev ? (
                        <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                          <Calendar className="h-3 w-3" aria-hidden />
                          Since previous pin: {sincePrev}
                        </div>
                      ) : null}
                    </div>
                    <div className="hidden shrink-0 text-right text-[10px] text-zinc-500 sm:block">
                      {next ? (
                        <>
                          <div className="font-medium text-zinc-700 dark:text-zinc-300">
                            {sincePrev}
                          </div>
                          <div>travel to stop below</div>
                        </>
                      ) : (
                        <span className="italic text-zinc-400">
                          earliest pin
                        </span>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}

// ---------- Map canvas (iframe + SVG overlay) -----------------------------

type MarkerTone = "sky" | "rose" | "indigo";

interface MarkerInput {
  pin: AdminPin;
  rep: User | null;
  tone: MarkerTone;
}

const MARKER_FILL: Record<MarkerTone, string> = {
  sky: "#0ea5e9",
  rose: "#e11d48",
  indigo: "#4f46e5",
};

function MapCanvas({
  bbox,
  markers,
  routeLine,
  activeId,
}: {
  bbox: BBox;
  markers: MarkerInput[];
  routeLine?: AdminPin[] | null;
  activeId?: string | null;
}) {
  const url =
    `https://www.openstreetmap.org/export/embed.html?bbox=${bbox.west},${bbox.south},${bbox.east},${bbox.north}&layer=mapnik`;

  const project = (lat: number, lng: number) => {
    const x = ((lng - bbox.west) / (bbox.east - bbox.west)) * 100;
    const y = ((bbox.north - lat) / (bbox.north - bbox.south)) * 100;
    return { x, y };
  };

  return (
    <div className="relative">
      <iframe
        title="Field location map"
        src={url}
        className="block h-[360px] w-full border-0 bg-zinc-100 dark:bg-zinc-900"
        loading="lazy"
        referrerPolicy="no-referrer"
      />

      {/* Route line — drawn first so markers paint above it. */}
      {routeLine && routeLine.length > 1 ? (
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden
        >
          {routeLine.map((p, i) => {
            if (i === 0) return null;
            const a = project(routeLine[i - 1]!.lat, routeLine[i - 1]!.lng);
            const b = project(p.lat, p.lng);
            // Newest segment (i === 1) is red, the rest blue, matching the
            // page description.
            const stroke = i === 1 ? "#e11d48" : "#4f46e5";
            return (
              <line
                key={i}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={stroke}
                strokeWidth="0.45"
                strokeLinecap="round"
                strokeOpacity={0.85}
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
        </svg>
      ) : null}

      {/* Markers */}
      {markers.length > 0 ? (
        <div className="pointer-events-none absolute inset-0">
          {markers.map((m) => {
            const { x, y } = project(m.pin.lat, m.pin.lng);
            const isActive = activeId === m.pin.id;
            return (
              <span
                key={m.pin.id}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${x}%`, top: `${y}%` }}
                aria-hidden
              >
                <span
                  className={cn(
                    "block rounded-full ring-2 ring-white shadow-md transition-transform",
                    isActive ? "scale-125" : "",
                  )}
                  style={{
                    width: isActive ? 14 : 10,
                    height: isActive ? 14 : 10,
                    background: MARKER_FILL[m.tone],
                  }}
                />
              </span>
            );
          })}
        </div>
      ) : null}

      {markers.length === 0 ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="rounded-full bg-white/90 px-3 py-1 text-xs text-zinc-700 shadow-sm dark:bg-zinc-950/80 dark:text-zinc-300">
            No pins to display in this view
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ---------- Helpers -------------------------------------------------------

function fitBBox(pins: AdminPin[], padDeg: number): BBox {
  if (pins.length === 0) {
    const c = TEAM_CENTER;
    return {
      west: c.lng - padDeg,
      south: c.lat - padDeg,
      east: c.lng + padDeg,
      north: c.lat + padDeg,
    };
  }
  let minLat = Infinity,
    maxLat = -Infinity,
    minLng = Infinity,
    maxLng = -Infinity;
  for (const p of pins) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
  }
  // Ensure a minimum span so a single pin doesn't render at world scale.
  const minSpan = padDeg * 0.5;
  if (maxLat - minLat < minSpan) {
    const c = (maxLat + minLat) / 2;
    minLat = c - minSpan / 2;
    maxLat = c + minSpan / 2;
  }
  if (maxLng - minLng < minSpan) {
    const c = (maxLng + minLng) / 2;
    minLng = c - minSpan / 2;
    maxLng = c + minSpan / 2;
  }
  return {
    west: minLng - padDeg,
    south: minLat - padDeg,
    east: maxLng + padDeg,
    north: maxLat + padDeg,
  };
}

function filterByDay(pins: AdminPin[], filter: DayFilter): AdminPin[] {
  if (filter === "all") return pins;
  const ref = new Date(REFERENCE_INSTANT);
  if (filter === "today") {
    const start = startOfDay(ref);
    return pins.filter((p) => new Date(p.timestamp) >= start);
  }
  if (filter === "yesterday") {
    const start = startOfDay(addDays(ref, -1));
    const end = startOfDay(ref);
    return pins.filter((p) => {
      const t = new Date(p.timestamp);
      return t >= start && t < end;
    });
  }
  if (filter === "this-week") {
    const start = addDays(ref, -7);
    return pins.filter((p) => new Date(p.timestamp) >= start);
  }
  // this-month
  const start = new Date(ref.getFullYear(), ref.getMonth(), 1);
  return pins.filter((p) => new Date(p.timestamp) >= start);
}

function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-IN", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function formatCoord(lat: number, lng: number): string {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

function osmFullLink(pin: AdminPin): string {
  return `https://www.openstreetmap.org/?mlat=${pin.lat}&mlon=${pin.lng}#map=15/${pin.lat}/${pin.lng}`;
}

function abbreviateName(name: string): string {
  // Match the screenshot's terse uppercase eyebrow ("RAM" for "Ram Kumar").
  const first = name.trim().split(/\s+/)[0] ?? name;
  return first.toUpperCase();
}

function formatRelative(iso: string): string {
  const t = new Date(iso).getTime();
  const diffMs = REFERENCE_INSTANT - t;
  if (diffMs < 0) return "just now";
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatTimestamp(iso);
}

function deltaLabel(earlierIso: string, laterIso: string): string {
  const ms = Math.max(
    0,
    new Date(laterIso).getTime() - new Date(earlierIso).getTime(),
  );
  const totalMinutes = Math.round(ms / 60000);
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const totalHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (totalHours < 24) {
    return minutes > 0 ? `${totalHours}h ${minutes}m` : `${totalHours}h`;
  }
  return `${totalHours}h ${minutes}m`;
}

// ---------- Skeleton ------------------------------------------------------

function ScreenSkeleton(): ReactNode {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-7 w-48 animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-800" />
        <div className="h-4 w-72 animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-800" />
      </div>
      <Card className="h-[420px] animate-pulse" />
    </div>
  );
}

