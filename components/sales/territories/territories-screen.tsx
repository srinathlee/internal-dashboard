"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  Loader2,
  MapPinned,
  Plus,
  Save,
  Trash2,
  Undo2,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/layout/page-header";
import { useAuth } from "@/lib/auth";
import { isSalesAdminOrSuperAdmin } from "@/lib/access";
import { getInitials } from "@/lib/format";
import { errorMessage } from "@/lib/hooks/use-async";
import { useGroups } from "@/lib/hooks/use-groups";
import { useSubadmins } from "@/lib/hooks/use-subadmins";
import {
  useTerritories,
  useTerritory,
  useTerritoryMutations,
} from "@/lib/hooks/use-territories";
import { LazyLeafletMap, type MapPolygon } from "@/components/maps/lazy-leaflet-map";
import type {
  LatLng,
  Territory,
} from "@/lib/api/sales-territories";
import { cn } from "@/lib/utils";

const DEFAULT_CENTER = { lat: 17.385, lng: 78.4867 }; // Hyderabad

export function TerritoriesScreen() {
  const auth = useAuth();
  const territoriesQuery = useTerritories();
  const mutations = useTerritoryMutations();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<"list" | "edit" | "new">("list");

  if (!auth.isLoaded) {
    return (
      <div className="space-y-4">
        <Card className="h-20 animate-pulse" />
        <Card className="h-96 animate-pulse" />
      </div>
    );
  }

  if (!isSalesAdminOrSuperAdmin(auth)) {
    return (
      <div className="space-y-6">
        <PageHeader title="Territories" />
        <Card className="p-12 text-center text-sm text-zinc-500">
          Territory management is for sales admins and super admins.
        </Card>
      </div>
    );
  }

  const territories = territoriesQuery.data ?? [];

  if (mode !== "list") {
    return (
      <TerritoryEditor
        territoryId={mode === "edit" ? selectedId : null}
        onBack={() => {
          setMode("list");
          setSelectedId(null);
          void territoriesQuery.refetch();
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Territories"
        description="Draw polygons on the map and assign them to reps or groups."
        actions={
          <Button
            onClick={() => {
              setSelectedId(null);
              setMode("new");
            }}
          >
            <Plus className="h-4 w-4" aria-hidden />
            New territory
          </Button>
        }
      />

      {territoriesQuery.error ? (
        <Card className="border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300">
          {errorMessage(territoriesQuery.error)}
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
        <Card className="overflow-hidden p-0">
          <LazyLeafletMap
            center={DEFAULT_CENTER}
            zoom={10}
            polygons={territories.map((t) => ({
              id: t.id,
              points: t.polygon,
              color: t.color,
              label: t.name,
            }))}
            className="h-[520px] rounded-none border-none"
          />
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
            <h3 className="text-sm font-semibold">
              All territories ({territories.length})
            </h3>
          </div>

          {territoriesQuery.isLoading && territories.length === 0 ? (
            <div className="p-10 text-center text-sm text-zinc-500">
              Loading…
            </div>
          ) : territories.length === 0 ? (
            <div className="p-10 text-center text-sm text-zinc-500">
              No territories yet. Click <strong>New territory</strong>.
            </div>
          ) : (
            <div className="max-h-[480px] overflow-y-auto">
              {territories.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(t.id);
                    setMode("edit");
                  }}
                  className="flex w-full items-start gap-3 border-b border-zinc-100 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                >
                  <span
                    aria-hidden
                    className="mt-1 h-3 w-3 shrink-0 rounded-sm"
                    style={{ backgroundColor: t.color }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">
                      {t.name}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-zinc-500">
                      <span>{t.polygon.length} points</span>
                      {t.assigned_user_name ? (
                        <span className="inline-flex items-center gap-1">
                          <Users className="h-3 w-3" aria-hidden />
                          {t.assigned_user_name}
                        </span>
                      ) : t.group_name ? (
                        <span className="inline-flex items-center gap-1">
                          <Users className="h-3 w-3" aria-hidden />
                          {t.group_name}
                        </span>
                      ) : (
                        <span className="text-amber-600">Unassigned</span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

// ---------- Editor -----------------------------------------------------

function TerritoryEditor({
  territoryId,
  onBack,
}: {
  territoryId: string | null;
  onBack: () => void;
}) {
  const isNew = territoryId === null;
  const territoryQuery = useTerritory(territoryId);
  const mutations = useTerritoryMutations();
  const subadminsQuery = useSubadmins({ limit: 200 });
  const groupsQuery = useGroups();
  const reps = subadminsQuery.data?.sales_subadmins ?? [];
  const groups = groupsQuery.data ?? [];

  const [name, setName] = useState("");
  const [color, setColor] = useState("#276EF1");
  const [polygon, setPolygon] = useState<LatLng[]>([]);
  const [repId, setRepId] = useState<string>("");
  const [groupId, setGroupId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);

  // Seed state from the loaded territory.
  useEffect(() => {
    if (!territoryQuery.data) return;
    const t = territoryQuery.data;
    setName(t.name);
    setColor(t.color || "#276EF1");
    setPolygon(t.polygon);
    setRepId(t.assigned_user_id ?? "");
    setGroupId(t.group_id ?? "");
  }, [territoryQuery.data]);

  const handleMapClick = (lat: number, lng: number) => {
    setPolygon((prev) => [...prev, { lat, lng }]);
  };

  const handleUndo = () => setPolygon((prev) => prev.slice(0, -1));
  const handleClear = () => setPolygon([]);

  const canSave = name.trim().length > 0 && polygon.length >= 3;

  const handleSave = async () => {
    if (!canSave) {
      toast.error("Need a name and at least 3 points.");
      return;
    }
    setSaving(true);
    try {
      const body = {
        name: name.trim(),
        color,
        polygon,
        assigned_user_id: repId || null,
        group_id: groupId || null,
      };
      if (isNew) {
        await mutations.create(body);
        toast.success("Territory created");
      } else {
        await mutations.update(territoryId!, body);
        toast.success("Territory updated");
      }
      onBack();
    } catch (err) {
      toast.error("Couldn't save territory", {
        description: errorMessage(err),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (isNew || !territoryId) return;
    if (
      !window.confirm(
        `Delete territory "${name}"? This can't be undone.`,
      )
    )
      return;
    setRemoving(true);
    try {
      await mutations.remove(territoryId);
      toast.success("Territory deleted");
      onBack();
    } catch (err) {
      toast.error("Couldn't delete territory", {
        description: errorMessage(err),
      });
    } finally {
      setRemoving(false);
    }
  };

  const mapCenter = useMemo(() => {
    if (polygon.length === 0) return DEFAULT_CENTER;
    const sum = polygon.reduce(
      (acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }),
      { lat: 0, lng: 0 },
    );
    return {
      lat: sum.lat / polygon.length,
      lng: sum.lng / polygon.length,
    };
  }, [polygon]);

  const polygons: MapPolygon[] =
    polygon.length > 0
      ? [{ id: "draft", points: polygon, color }]
      : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={isNew ? "New territory" : `Edit ${name || "territory"}`}
        description="Click on the map to add points. You need at least 3 to form a polygon."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ChevronLeft className="h-4 w-4" aria-hidden />
              Back
            </Button>
            {!isNew ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDelete}
                disabled={removing}
                className="text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:text-rose-400 dark:hover:bg-rose-950/40"
              >
                {removing ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Trash2 className="h-4 w-4" aria-hidden />
                )}
                Delete
              </Button>
            ) : null}
            <Button onClick={handleSave} disabled={!canSave || saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Save className="h-4 w-4" aria-hidden />
              )}
              Save
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
        <Card className="overflow-hidden p-0">
          <LazyLeafletMap
            center={mapCenter}
            zoom={11}
            polygons={polygons}
            onMapClick={handleMapClick}
            className="h-[520px] rounded-none border-none"
          />
        </Card>

        <Card className="space-y-4 p-5">
          <div className="space-y-1.5">
            <Label htmlFor="t-name">Name</Label>
            <Input
              id="t-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. South Mumbai"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="t-color">Colour</Label>
            <div className="flex items-center gap-2">
              <Input
                id="t-color"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-9 w-16 cursor-pointer p-1"
              />
              <span className="font-mono text-xs text-zinc-500">{color}</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Assign to</Label>
            <Select
              value={repId || "__none__"}
              onValueChange={(v) => {
                setRepId(v === "__none__" ? "" : v);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pick a rep (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— No rep —</SelectItem>
                {reps.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    <span className="inline-flex items-center gap-2">
                      <Avatar className="h-5 w-5">
                        <AvatarFallback className="text-[9px]">
                          {getInitials(r.name)}
                        </AvatarFallback>
                      </Avatar>
                      {r.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Group</Label>
            <Select
              value={groupId || "__none__"}
              onValueChange={(v) => {
                setGroupId(v === "__none__" ? "" : v);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pick a group (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— No group —</SelectItem>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold uppercase tracking-wider text-zinc-500">
                Polygon
              </span>
              <span className="tabular-nums text-zinc-500">
                {polygon.length} point{polygon.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="mt-2 flex items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleUndo}
                disabled={polygon.length === 0}
                className="flex-1"
              >
                <Undo2 className="h-3.5 w-3.5" aria-hidden />
                Undo
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleClear}
                disabled={polygon.length === 0}
                className="flex-1"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                Clear
              </Button>
            </div>
            <p className="mt-2 inline-flex items-center gap-1 text-[11px] text-zinc-500">
              <MapPinned className="h-3 w-3" aria-hidden />
              Click on the map to add a point.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
