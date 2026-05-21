"use client";

/**
 * Map component that lazily loads Leaflet at runtime.
 *
 * Leaflet + react-leaflet are intentionally **optional dependencies** —
 * the rest of the dashboard works without a map library and the bundle
 * stays small. Install with:
 *
 *     npm i leaflet react-leaflet
 *
 * If they're not installed (or the imports fail), the component renders
 * a placeholder card with installation instructions instead of crashing.
 */

import { useEffect, useRef, useState } from "react";
import { Map as MapIcon } from "lucide-react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  label: string;
  color?: string;
  /** Optional pop-up content rendered as plain text. */
  popup?: string;
}

export interface MapPolygon {
  id: string;
  points: { lat: number; lng: number }[];
  color?: string;
  label?: string;
}

export interface LazyLeafletMapProps {
  center: { lat: number; lng: number };
  zoom?: number;
  markers?: MapMarker[];
  polygons?: MapPolygon[];
  /**
   * Called when the user clicks an empty spot on the map. Coordinates are
   * in WGS84. Used by the territory editor to grow the polygon.
   */
  onMapClick?: (lat: number, lng: number) => void;
  className?: string;
}

// Loose typing for the dynamic-imported Leaflet module. We avoid
// `typeof import("leaflet")` so TypeScript doesn't require the package
// to be installed.
interface LeafletLatLng {
  lat: number;
  lng: number;
}

interface LeafletLayer {
  addTo: (target: unknown) => LeafletLayer;
  remove: () => void;
  bindPopup: (content: string) => LeafletLayer;
}

interface LeafletMap {
  setView: (latlng: [number, number], zoom: number) => LeafletMap;
  on: (
    event: string,
    handler: (e: { latlng: LeafletLatLng }) => void,
  ) => void;
  remove: () => void;
}

interface LeafletModule {
  map: (container: HTMLElement) => LeafletMap;
  tileLayer: (
    url: string,
    opts: { attribution: string },
  ) => LeafletLayer;
  layerGroup: () => LeafletLayer;
  circleMarker: (
    latlng: [number, number],
    opts: Record<string, unknown>,
  ) => LeafletLayer;
  polygon: (
    latlngs: [number, number][],
    opts: Record<string, unknown>,
  ) => LeafletLayer;
  polyline: (
    latlngs: [number, number][],
    opts: Record<string, unknown>,
  ) => LeafletLayer;
}

export function LazyLeafletMap(props: LazyLeafletMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<unknown>(null);
  const markerLayerRef = useRef<unknown>(null);
  const polygonLayerRef = useRef<unknown>(null);
  const [L, setL] = useState<LeafletModule | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Lazy-load Leaflet + its CSS. The string-indirected import keeps the
  // TypeScript compiler from requiring the package to be installed.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const moduleName = "leaflet";
        const cssName = "leaflet/dist/leaflet.css";
        // CSS side-effect import; missing CSS isn't fatal but breaks tiles.
        try {
          await import(/* webpackIgnore: true */ cssName);
        } catch {
          /* ignore */
        }
        const mod = (await import(
          /* webpackIgnore: true */ moduleName
        )) as unknown;
        if (cancelled) return;
        const lib = (mod as { default?: LeafletModule }).default ??
          (mod as LeafletModule);
        setL(lib);
      } catch {
        if (!cancelled) {
          setLoadError(
            "Map library not installed — run `npm i leaflet` to enable.",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Init / update the map whenever Leaflet or props change.
  useEffect(() => {
    if (!L || !containerRef.current) return;
    const existing = mapRef.current as LeafletMap | null;
    let activeMap: LeafletMap;
    if (!existing) {
      const created = L.map(containerRef.current).setView(
        [props.center.lat, props.center.lng],
        props.zoom ?? 11,
      );
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(created);
      mapRef.current = created;
      if (props.onMapClick) {
        created.on("click", (e) => {
          props.onMapClick?.(e.latlng.lat, e.latlng.lng);
        });
      }
      activeMap = created;
    } else {
      existing.setView([props.center.lat, props.center.lng], props.zoom ?? 11);
      activeMap = existing;
    }

    // Rebuild marker + polygon layers each render — Leaflet doesn't diff for us.
    (markerLayerRef.current as LeafletLayer | null)?.remove();
    (polygonLayerRef.current as LeafletLayer | null)?.remove();

    const markerLayer = L.layerGroup().addTo(activeMap);
    for (const m of props.markers ?? []) {
      const marker = L.circleMarker([m.lat, m.lng], {
        radius: 8,
        color: m.color ?? "#8b5cf6",
        weight: 2,
        fillColor: m.color ?? "#8b5cf6",
        fillOpacity: 0.7,
      });
      if (m.popup ?? m.label) marker.bindPopup(m.popup ?? m.label);
      marker.addTo(markerLayer);
    }
    markerLayerRef.current = markerLayer;

    const polygonLayer = L.layerGroup().addTo(activeMap);
    for (const p of props.polygons ?? []) {
      if (p.points.length < 2) continue;
      const latlngs = p.points.map((pt) => [pt.lat, pt.lng] as [number, number]);
      const poly =
        p.points.length >= 3
          ? L.polygon(latlngs, {
              color: p.color ?? "#276EF1",
              weight: 2,
              fillOpacity: 0.15,
            })
          : L.polyline(latlngs, {
              color: p.color ?? "#276EF1",
              weight: 2,
              dashArray: "4 4",
            });
      if (p.label) poly.bindPopup(p.label);
      poly.addTo(polygonLayer);
    }
    polygonLayerRef.current = polygonLayer;
  }, [L, props.center.lat, props.center.lng, props.zoom, props.markers, props.polygons, props.onMapClick]);

  // Tear down on unmount so we don't leak a Leaflet instance per render.
  useEffect(() => {
    return () => {
      const map = mapRef.current as
        | { remove: () => void }
        | null
        | undefined;
      map?.remove();
      mapRef.current = null;
    };
  }, []);

  if (loadError) {
    return (
      <Card
        className={cn(
          "grid h-full min-h-[300px] place-items-center p-6 text-center",
          props.className,
        )}
      >
        <div className="space-y-2">
          <MapIcon
            className="mx-auto h-8 w-8 text-zinc-400"
            aria-hidden
          />
          <p className="text-sm font-medium">Map preview unavailable</p>
          <p className="text-xs text-zinc-500">{loadError}</p>
        </div>
      </Card>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        "h-full min-h-[400px] w-full overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800",
        props.className,
      )}
    />
  );
}
