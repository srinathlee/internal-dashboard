"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ChevronRight,
  Clock,
  Crosshair,
  History,
  Loader2,
  MapPin,
  Maximize2,
  Trash2,
  Map as MapIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { PageHeader } from "@/components/layout/page-header";
import { useAuth } from "@/lib/auth";
import { canSeeSalesTabs } from "@/lib/access";
import { cn } from "@/lib/utils";
import { errorMessage } from "@/lib/hooks/use-async";
import {
  useFieldPinMutations,
  useFieldPins,
} from "@/lib/hooks/use-field-pins";

interface Pin {
  id: string;
  lat: number;
  lng: number;
  timestamp: string;
}

type LocationStatus = "idle" | "requesting" | "granted" | "denied" | "unavailable";

// Hyderabad — matches the bulk of the seed clinics so the empty map looks
// related to the rest of the app instead of dropping the rep on a random
// continent.
const DEFAULT_CENTER: { lat: number; lng: number } = { lat: 17.4399, lng: 78.3489 };

type HistoryFilter = "all" | "today" | "yesterday" | "this-week" | "this-month";

const HISTORY_FILTERS: { key: HistoryFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "this-week", label: "This week" },
  { key: "this-month", label: "This month" },
];

/**
 * Sales-member field location screen. Two views:
 *  - Pin location: map preview + "Use my current location" call-to-action.
 *  - History & map: filterable list of past pins with a synced map preview.
 *
 * No backend in v1 — pins persist to localStorage scoped per user. The map
 * itself is rendered through OpenStreetMap's embed iframe, which keeps the
 * surface dependency-free at the cost of only painting one marker at a time
 * (older pins live in the timeline list, click to recentre the map).
 */
export function FieldLocationScreen() {
  const auth = useAuth();
  const [status, setStatus] = useState<LocationStatus>("idle");
  const [activePinId, setActivePinId] = useState<string | null>(null);
  const [filter, setFilter] = useState<HistoryFilter>("all");

  const pinsQuery = useFieldPins();
  const { drop, clearAll } = useFieldPinMutations();

  const pins = useMemo<Pin[]>(() => {
    return (pinsQuery.data ?? []).map((p) => ({
      id: p.id,
      lat: p.latitude,
      lng: p.longitude,
      timestamp: p.captured_at,
    }));
  }, [pinsQuery.data]);

  const sortedPins = useMemo(
    () =>
      pins
        .slice()
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
    [pins],
  );

  // Default the active pin to the most recent.
  useEffect(() => {
    if (!activePinId && sortedPins.length > 0) {
      setActivePinId(sortedPins[0]!.id);
    }
  }, [activePinId, sortedPins]);

  const filteredPins = useMemo(
    () => filterPins(sortedPins, filter),
    [sortedPins, filter],
  );

  if (!auth.isLoaded) return <Skeleton />;

  if (!canSeeSalesTabs(auth)) {
    return (
      <div className="space-y-6">
        <PageHeader title="Field location" />
        <Card className="p-12 text-center text-sm text-zinc-500">
          You don't have permission to view field location.
        </Card>
      </div>
    );
  }

  const handleCapture = () => {
    if (!("geolocation" in navigator)) {
      setStatus("unavailable");
      toast.error("Geolocation isn't available on this device.");
      return;
    }
    setStatus("requesting");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const pin = await drop({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
          setActivePinId(pin.id);
          setStatus("granted");
          toast.success("Location pinned");
          void pinsQuery.refetch();
        } catch (err) {
          setStatus("unavailable");
          toast.error("Couldn't save your pin", {
            description: errorMessage(err),
          });
        }
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setStatus("denied");
        } else {
          setStatus("unavailable");
        }
        toast.error("Couldn't capture your location");
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 },
    );
  };

  const handleClear = async () => {
    try {
      await clearAll();
      setActivePinId(null);
      toast.success("Pin history cleared");
      void pinsQuery.refetch();
    } catch (err) {
      toast.error("Couldn't clear pins", { description: errorMessage(err) });
    }
  };

  const hydrated = !pinsQuery.isLoading;

  const activePin =
    sortedPins.find((p) => p.id === activePinId) ?? sortedPins[0] ?? null;
  const center = activePin
    ? { lat: activePin.lat, lng: activePin.lng }
    : DEFAULT_CENTER;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Field location"
        description="Drop a pin from the field, then review your route under History & map. Pins are stored locally on this device — use HTTPS on phones so the browser can read GPS."
      />

      <Tabs defaultValue="pin">
        <TabsList>
          <TabsTrigger value="pin">
            <MapPin className="h-3.5 w-3.5" aria-hidden />
            Pin location
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="h-3.5 w-3.5" aria-hidden />
            History &amp; map
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pin" className="space-y-4">
          {status === "denied" ? (
            <PermissionWarning />
          ) : null}

          <Card className="overflow-hidden p-0">
            <div className="border-b border-zinc-200 px-4 py-2.5 text-xs text-zinc-500 dark:border-zinc-800">
              {activePin
                ? `Last pin captured ${formatTimestamp(activePin.timestamp)} · ${formatCoord(activePin.lat, activePin.lng)}`
                : "No pin captured yet — tap the button below to drop your first one."}
            </div>
            <MapEmbed center={center} marker={activePin} />
            <div className="flex items-center justify-between gap-3 border-t border-zinc-200 p-3 dark:border-zinc-800">
              <div className="text-xs text-zinc-500">
                {hydrated
                  ? `${pins.length} pin${pins.length === 1 ? "" : "s"} captured`
                  : "Loading…"}
              </div>
              <Button onClick={handleCapture} disabled={status === "requesting"}>
                {status === "requesting" ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Crosshair className="h-4 w-4" aria-hidden />
                )}
                Use my current location
              </Button>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold tracking-tight">Day map</h2>
                <span className="text-xs text-zinc-500">
                  {filteredPins.length} pin{filteredPins.length === 1 ? "" : "s"}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-zinc-500">
                The latest stop in this view appears as a red marker. Click any timeline entry to re-centre the map.
              </p>
            </div>
            {pins.length > 0 ? (
              <Button variant="outline" size="sm" onClick={handleClear}>
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                Clear history
              </Button>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {HISTORY_FILTERS.map((f) => {
              const active = filter === f.key;
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFilter(f.key)}
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

          <Card className="overflow-hidden p-0">
            <MapEmbed
              center={center}
              marker={activePin}
              footer={
                <div className="flex items-center justify-between text-xs text-zinc-500">
                  <span>
                    {activePin
                      ? `Centred on ${formatCoord(activePin.lat, activePin.lng)}`
                      : "No pins to display"}
                  </span>
                  {activePin ? (
                    <a
                      href={osmFullLink(activePin)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                    >
                      <Maximize2 className="h-3 w-3" aria-hidden />
                      Open full map
                    </a>
                  ) : null}
                </div>
              }
            />
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold tracking-tight">
                Timeline · newest first
              </h3>
              <span className="text-xs text-zinc-500 tabular-nums">
                {filteredPins.length} entries
              </span>
            </div>
            {filteredPins.length === 0 ? (
              <div className="mt-4 flex flex-col items-center justify-center py-12 text-center">
                <div
                  aria-hidden
                  className="grid h-10 w-10 place-items-center rounded-full bg-zinc-100 text-zinc-400 dark:bg-zinc-800"
                >
                  <MapIcon className="h-5 w-5" />
                </div>
                <p className="mt-3 text-sm text-zinc-500">
                  No pins in this view.
                </p>
                <p className="mt-0.5 text-xs text-zinc-400">
                  Pins from the Pin location tab show up here.
                </p>
              </div>
            ) : (
              <ul role="list" className="mt-3 divide-y divide-zinc-100 dark:divide-zinc-800">
                {filteredPins.map((pin, idx) => (
                  <li key={pin.id} className="py-3 first:pt-0 last:pb-0">
                    <button
                      type="button"
                      onClick={() => setActivePinId(pin.id)}
                      className={cn(
                        "flex w-full items-start gap-3 rounded-md p-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        activePinId === pin.id
                          ? "bg-zinc-50 dark:bg-zinc-900"
                          : "hover:bg-zinc-50 dark:hover:bg-zinc-900",
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md",
                          idx === 0
                            ? "bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400"
                            : "bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400",
                        )}
                      >
                        <MapPin className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2 text-xs text-zinc-500">
                          <Clock className="h-3 w-3" aria-hidden />
                          <span>{formatTimestamp(pin.timestamp)}</span>
                          {idx === 0 ? (
                            <span className="ml-1 inline-flex h-4 items-center rounded-full bg-rose-50 px-1.5 text-[9px] font-semibold uppercase tracking-wider text-rose-700 dark:bg-rose-950/40 dark:text-rose-400">
                              Latest
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-0.5 text-sm text-zinc-900 dark:text-zinc-100">
                          Location pin
                        </p>
                        <p className="mt-0.5 truncate font-mono text-xs text-zinc-500">
                          {formatCoord(pin.lat, pin.lng)}
                        </p>
                      </div>
                      <ChevronRight
                        aria-hidden
                        className={cn(
                          "mt-2 h-4 w-4 shrink-0 transition-colors",
                          activePinId === pin.id
                            ? "text-zinc-700 dark:text-zinc-300"
                            : "text-zinc-300",
                        )}
                      />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------- Permission warning ------------------------------------------

function PermissionWarning() {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div>
        <div className="font-medium">Location is blocked for this site.</div>
        <div className="text-xs text-amber-800 dark:text-amber-400/80">
          Allow location in your browser or system settings for this page, then try again.
        </div>
      </div>
    </div>
  );
}

// ---------- Map embed ---------------------------------------------------

function MapEmbed({
  center,
  marker,
  footer,
}: {
  center: { lat: number; lng: number };
  marker: Pin | null;
  footer?: React.ReactNode;
}) {
  // Build a small bounding box around the centre so the iframe doesn't render
  // at world scale. ~0.02° ≈ a couple of km — gives a city-block view that
  // matches the reference design.
  const span = 0.02;
  const west = center.lng - span;
  const south = center.lat - span;
  const east = center.lng + span;
  const north = center.lat + span;
  const url = marker
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${west},${south},${east},${north}&layer=mapnik&marker=${marker.lat},${marker.lng}`
    : `https://www.openstreetmap.org/export/embed.html?bbox=${west},${south},${east},${north}&layer=mapnik`;

  return (
    <div className="relative">
      <iframe
        title="Field location map"
        src={url}
        className="block h-[360px] w-full border-0 bg-zinc-100 dark:bg-zinc-900"
        loading="lazy"
        referrerPolicy="no-referrer"
      />
      {!marker ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="rounded-full bg-white/90 px-3 py-1 text-xs text-zinc-700 shadow-sm dark:bg-zinc-950/80 dark:text-zinc-300">
            Drop a pin to see it on the map
          </div>
        </div>
      ) : null}
      {footer ? (
        <div className="border-t border-zinc-200 px-4 py-2 dark:border-zinc-800">
          {footer}
        </div>
      ) : null}
    </div>
  );
}

function osmFullLink(pin: Pin): string {
  return `https://www.openstreetmap.org/?mlat=${pin.lat}&mlon=${pin.lng}#map=16/${pin.lat}/${pin.lng}`;
}

// ---------- Helpers ------------------------------------------------------

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-IN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function formatCoord(lat: number, lng: number): string {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

function filterPins(pins: Pin[], filter: HistoryFilter): Pin[] {
  if (filter === "all") return pins;
  const now = new Date();
  if (filter === "today") {
    const start = startOfDay(now);
    return pins.filter((p) => new Date(p.timestamp) >= start);
  }
  if (filter === "yesterday") {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const start = startOfDay(yesterday);
    const end = startOfDay(now);
    return pins.filter((p) => {
      const t = new Date(p.timestamp);
      return t >= start && t < end;
    });
  }
  if (filter === "this-week") {
    const start = new Date(now);
    start.setDate(start.getDate() - 7);
    return pins.filter((p) => new Date(p.timestamp) >= start);
  }
  // this-month
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return pins.filter((p) => new Date(p.timestamp) >= start);
}

function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

// ---------- Skeleton ----------------------------------------------------

function Skeleton() {
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
