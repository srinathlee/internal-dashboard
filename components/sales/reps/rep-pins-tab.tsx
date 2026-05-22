"use client";

import { useMemo } from "react";
import { MapPin } from "lucide-react";

import { Card } from "@/components/ui/card";
import {
  LazyLeafletMap,
  type MapMarker,
} from "@/components/maps/lazy-leaflet-map";
import { errorMessage } from "@/lib/hooks/use-async";
import { useFieldPins } from "@/lib/hooks/use-field-pins";

const INDIA_CENTER = { lat: 20.5937, lng: 78.9629 };

/** Pins tab — every field pin this rep dropped, on a map + as a list. */
export function RepPinsTab({ repId }: { repId: string }) {
  const pinsQuery = useFieldPins({ userId: repId, includeHidden: true });
  const pins = useMemo(
    () => (pinsQuery.data ?? []).filter((p) => p.latitude && p.longitude),
    [pinsQuery.data],
  );

  const markers: MapMarker[] = pins.map((p) => ({
    id: p.id,
    lat: p.latitude,
    lng: p.longitude,
    label: p.name || "Pin",
    color: p.visible_on_map === false ? "#a1a1aa" : "#8b5cf6",
    popup: [p.name, p.note].filter(Boolean).join(" — ") || "Field pin",
  }));

  const center = pins[0]
    ? { lat: pins[0].latitude, lng: pins[0].longitude }
    : INDIA_CENTER;

  if (pinsQuery.isLoading && pins.length === 0) {
    return <Card className="h-[420px] animate-pulse" />;
  }
  if (pinsQuery.error) {
    return (
      <Card className="p-8 text-center text-sm text-rose-600 dark:text-rose-400">
        Couldn&apos;t load pins: {errorMessage(pinsQuery.error)}
      </Card>
    );
  }
  if (pins.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-2 p-12 text-center">
        <MapPin className="h-8 w-8 text-zinc-300 dark:text-zinc-600" aria-hidden />
        <p className="text-sm text-zinc-500">No saved pins for this rep.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <LazyLeafletMap
        center={center}
        zoom={pins.length > 1 ? 11 : 14}
        markers={markers}
        className="h-[420px]"
      />
      <Card className="divide-y divide-zinc-100 overflow-hidden dark:divide-zinc-800">
        {pins.map((p) => (
          <div key={p.id} className="flex items-start gap-3 px-4 py-3">
            <MapPin
              className="mt-0.5 h-4 w-4 shrink-0 text-violet-500"
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-medium">
                  {p.name || "Untitled pin"}
                </span>
                {p.visible_on_map === false ? (
                  <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500 dark:bg-zinc-800">
                    Hidden
                  </span>
                ) : null}
              </div>
              {p.note ? (
                <p className="truncate text-xs text-zinc-500">{p.note}</p>
              ) : null}
            </div>
            <span className="shrink-0 text-xs text-zinc-400">
              {p.captured_at ? p.captured_at.slice(0, 10) : ""}
            </span>
          </div>
        ))}
      </Card>
    </div>
  );
}
