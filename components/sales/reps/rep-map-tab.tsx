"use client";

import { useMemo, useState } from "react";
import { Navigation } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  LazyLeafletMap,
  type MapMarker,
  type MapPolyline,
} from "@/components/maps/lazy-leaflet-map";
import { errorMessage } from "@/lib/hooks/use-async";
import { useLocationTrack } from "@/lib/hooks/use-locations";

const INDIA_CENTER = { lat: 20.5937, lng: 78.9629 };

function todayYmd(): string {
  return new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD (local)
}

/** Map tab — the rep's GPS track for a chosen day (route + start/end markers). */
export function RepMapTab({ repId }: { repId: string }) {
  const [date, setDate] = useState(todayYmd());
  const track = useLocationTrack({ user_id: repId, date });

  const { polylines, markers, center, hasPoints } = useMemo(() => {
    const sessions = track.data?.tracks ?? [];
    const lines: MapPolyline[] = [];
    const pts: MapMarker[] = [];
    let first: { lat: number; lng: number } | null = null;

    sessions.forEach((s, i) => {
      const points = s.points.map((p) => ({ lat: p.lat, lng: p.lng }));
      if (points.length === 0) return;
      if (!first) first = points[0] ?? null;
      if (points.length >= 2) {
        lines.push({ id: s.session_id, points, color: "#8b5cf6" });
      }
      const start = points[0];
      const end = points[points.length - 1];
      if (start) {
        pts.push({
          id: `${s.session_id}-start`,
          lat: start.lat,
          lng: start.lng,
          label: `Session ${i + 1} start`,
          color: "#10b981",
          radius: 7,
        });
      }
      if (end && points.length > 1) {
        pts.push({
          id: `${s.session_id}-end`,
          lat: end.lat,
          lng: end.lng,
          label: `Session ${i + 1} end`,
          color: "#ef4444",
          radius: 7,
        });
      }
    });

    return {
      polylines: lines,
      markers: pts,
      center: first ?? INDIA_CENTER,
      hasPoints: pts.length > 0,
    };
  }, [track.data]);

  const totalKm = ((track.data?.total_meters ?? 0) / 1000).toFixed(2);
  const sessionCount = track.data?.session_count ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-end gap-2">
          <div className="space-y-1.5">
            <Label htmlFor="map-date" className="text-xs font-medium">
              Date
            </Label>
            <Input
              id="map-date"
              type="date"
              value={date}
              max={todayYmd()}
              onChange={(e) => setDate(e.target.value)}
              className="w-40"
            />
          </div>
        </div>
        <div className="flex gap-6 text-sm">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
              Distance
            </div>
            <div className="font-semibold tabular-nums">{totalKm} km</div>
          </div>
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
              Sessions
            </div>
            <div className="font-semibold tabular-nums">{sessionCount}</div>
          </div>
        </div>
      </div>

      {track.error ? (
        <Card className="p-8 text-center text-sm text-rose-600 dark:text-rose-400">
          Couldn&apos;t load location track: {errorMessage(track.error)}
        </Card>
      ) : track.isLoading && !track.data ? (
        <Card className="h-[440px] animate-pulse" />
      ) : !hasPoints ? (
        <Card className="flex h-[440px] flex-col items-center justify-center gap-2 text-center">
          <Navigation className="h-8 w-8 text-zinc-300 dark:text-zinc-600" aria-hidden />
          <p className="text-sm text-zinc-500">
            No location track recorded on {date}.
          </p>
        </Card>
      ) : (
        <LazyLeafletMap
          center={center}
          zoom={13}
          markers={markers}
          polylines={polylines}
          className="h-[440px]"
        />
      )}
    </div>
  );
}
