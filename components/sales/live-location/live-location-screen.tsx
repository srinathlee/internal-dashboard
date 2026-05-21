"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BatteryLow,
  CircleDot,
  Loader2,
  MapPin,
  RefreshCw,
  Wifi,
  WifiOff,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { useAuth } from "@/lib/auth";
import { isSalesAdminOrSuperAdmin } from "@/lib/access";
import { getInitials } from "@/lib/format";
import { errorMessage } from "@/lib/hooks/use-async";
import { useLocationTeamStatus } from "@/lib/hooks/use-locations";
import { connectLocationSocket } from "@/lib/realtime/location-socket";
import { LazyLeafletMap, type MapMarker } from "@/components/maps/lazy-leaflet-map";
import { cn } from "@/lib/utils";
import type {
  TeamStatusMember,
  TrackingStatus,
} from "@/lib/api/sales-locations";

/**
 * Live location screen for admins.
 *
 * The REST endpoint `/location/team-status` is the canonical source of
 * truth — we refetch it every 30s. When `socket.io-client` is installed,
 * we layer the Socket.IO stream on top so updates show up in real time
 * between polls. When it isn't, the page degrades to the 30s poll.
 */
export function LiveLocationScreen() {
  const auth = useAuth();
  const status = useLocationTeamStatus();
  const [liveOverrides, setLiveOverrides] = useState<
    Record<string, { lat: number; lng: number; ts: string }>
  >({});
  const [socketState, setSocketState] = useState<
    "connecting" | "live" | "offline"
  >("connecting");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Periodic refetch so the list stays fresh on its own even if the WS
  // never connects.
  useEffect(() => {
    const id = window.setInterval(() => void status.refetch(), 30_000);
    return () => window.clearInterval(id);
  }, [status]);

  // Live socket layer — only activates when `socket.io-client` is installed.
  useEffect(() => {
    let adapter: { disconnect: () => void } | null = null;
    let cancelled = false;
    (async () => {
      const a = await connectLocationSocket({
        handlers: {
          onConnect: () => setSocketState("live"),
          onDisconnect: () => setSocketState("offline"),
          onUpdate: (e) => {
            setLiveOverrides((prev) => ({
              ...prev,
              [e.user_id]: {
                lat: e.lat,
                lng: e.lng,
                ts: e.timestamp,
              },
            }));
          },
          onSessionStart: () => void status.refetch(),
          onSessionStop: () => void status.refetch(),
        },
      });
      if (cancelled) {
        a.disconnect();
        return;
      }
      adapter = a;
      a.subscribeAdmin();
    })();
    return () => {
      cancelled = true;
      adapter?.disconnect();
    };
  }, [status]);

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
        <PageHeader title="Live location" />
        <Card className="p-12 text-center text-sm text-zinc-500">
          Live location is for sales admins and super admins.
        </Card>
      </div>
    );
  }

  const data = status.data;
  const members: TeamStatusMember[] = (data?.members ?? []).map((m) => {
    const override = liveOverrides[m.user_id];
    return override
      ? {
          ...m,
          lat: override.lat,
          lng: override.lng,
          last_updated_at: override.ts,
          tracking_status: "LIVE" as TrackingStatus,
          is_live: true,
        }
      : m;
  });

  const liveMembers = members.filter((m) => m.lat !== null && m.lng !== null);
  const markers: MapMarker[] = liveMembers.map((m) => ({
    id: m.user_id,
    lat: m.lat as number,
    lng: m.lng as number,
    label: m.user_name,
    color: m.is_live ? "#10b981" : "#9ca3af",
    popup: `${m.user_name} · ${
      m.is_live ? "Live" : "Last seen"
    }${m.last_updated_at ? ` ${new Date(m.last_updated_at).toLocaleTimeString()}` : ""}`,
  }));

  const mapCenter = useMemo(() => {
    if (liveMembers.length === 0) return { lat: 17.385, lng: 78.4867 }; // Hyderabad
    const avg = liveMembers.reduce(
      (acc, m) => ({
        lat: acc.lat + (m.lat as number),
        lng: acc.lng + (m.lng as number),
      }),
      { lat: 0, lng: 0 },
    );
    return {
      lat: avg.lat / liveMembers.length,
      lng: avg.lng / liveMembers.length,
    };
  }, [liveMembers]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Live location"
        description="Real-time map of reps in the field. Updates every 30 seconds, or instantly when live updates are enabled."
        actions={
          <div className="flex items-center gap-2">
            <SocketBadge state={socketState} />
            <Button
              variant="outline"
              size="sm"
              onClick={() => void status.refetch()}
              disabled={status.isLoading}
            >
              {status.isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <RefreshCw className="h-4 w-4" aria-hidden />
              )}
              Refresh
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Kpi
          label="Live"
          value={status.isLoading ? "—" : String(data?.live_count ?? 0)}
          tone="emerald"
          icon={CircleDot}
        />
        <Kpi
          label="Active, no GPS"
          value={
            status.isLoading
              ? "—"
              : String(data?.active_no_location_count ?? 0)
          }
          tone="amber"
          icon={Activity}
        />
        <Kpi
          label="Not started"
          value={
            status.isLoading ? "—" : String(data?.not_started_count ?? 0)
          }
          tone="zinc"
          icon={Activity}
        />
        <Kpi
          label="Total reps"
          value={status.isLoading ? "—" : String(data?.total_count ?? 0)}
          tone="zinc"
          icon={Activity}
        />
      </div>

      {status.error ? (
        <Card className="border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300">
          {errorMessage(status.error)}
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
        <Card className="overflow-hidden p-0">
          <LazyLeafletMap
            center={mapCenter}
            zoom={liveMembers.length > 0 ? 11 : 10}
            markers={markers}
            className="h-[520px] rounded-none border-none"
          />
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
            <h3 className="text-sm font-semibold">Team status</h3>
          </div>
          <div className="max-h-[480px] overflow-y-auto">
            {members.length === 0 ? (
              <div className="p-10 text-center text-sm text-zinc-500">
                {status.isLoading ? "Loading…" : "No reps in your team."}
              </div>
            ) : (
              members.map((m) => (
                <MemberRow
                  key={m.user_id}
                  member={m}
                  active={selectedId === m.user_id}
                  onClick={() => setSelectedId(m.user_id)}
                />
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function SocketBadge({
  state,
}: {
  state: "connecting" | "live" | "offline";
}) {
  if (state === "live") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
        <Wifi className="h-3 w-3" aria-hidden />
        Live
      </span>
    );
  }
  if (state === "connecting") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
        Connecting
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
      <WifiOff className="h-3 w-3" aria-hidden />
      Polling
    </span>
  );
}

function Kpi({
  label,
  value,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string;
  tone: "emerald" | "amber" | "zinc";
  icon: typeof Activity;
}) {
  const toneClass = {
    emerald: "text-emerald-500 bg-emerald-50 dark:bg-emerald-950/40",
    amber: "text-amber-500 bg-amber-50 dark:bg-amber-950/40",
    zinc: "text-zinc-500 bg-zinc-100 dark:bg-zinc-900",
  }[tone];
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <span className={cn("grid h-9 w-9 place-items-center rounded-md", toneClass)}>
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            {label}
          </div>
          <div className="text-2xl font-bold tabular-nums">{value}</div>
        </div>
      </div>
    </Card>
  );
}

function MemberRow({
  member,
  active,
  onClick,
}: {
  member: TeamStatusMember;
  active: boolean;
  onClick: () => void;
}) {
  const status = member.tracking_status;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-start gap-3 border-b border-zinc-100 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900",
        active && "bg-violet-50/40 dark:bg-violet-950/20",
      )}
    >
      <Avatar className="h-8 w-8">
        <AvatarFallback className="text-[10px]">
          {getInitials(member.user_name)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold">
            {member.user_name}
          </span>
          <StatusPill status={status} />
        </div>
        {member.lat !== null && member.lng !== null ? (
          <div className="mt-1 flex items-center gap-1 text-[11px] text-zinc-500">
            <MapPin className="h-3 w-3" aria-hidden />
            <span className="tabular-nums">
              {member.lat.toFixed(4)}, {member.lng.toFixed(4)}
            </span>
          </div>
        ) : (
          <div className="mt-1 text-[11px] text-zinc-400">
            No GPS yet
          </div>
        )}
        <div className="mt-0.5 flex items-center gap-3 text-[11px] text-zinc-500">
          {member.last_updated_at ? (
            <span>
              Updated{" "}
              {new Date(member.last_updated_at).toLocaleTimeString(undefined, {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          ) : null}
          {member.battery_level !== null && member.battery_level !== undefined ? (
            <span
              className={cn(
                "inline-flex items-center gap-0.5",
                member.battery_level < 20 && "text-rose-500",
              )}
            >
              <BatteryLow className="h-3 w-3" aria-hidden />
              {Math.round(member.battery_level)}%
            </span>
          ) : null}
        </div>
      </div>
    </button>
  );
}

function StatusPill({ status }: { status: TrackingStatus }) {
  if (status === "LIVE") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
        <span
          aria-hidden
          className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500"
        />
        Live
      </span>
    );
  }
  if (status === "ACTIVE_NO_LOCATION") {
    return (
      <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
        Pending GPS
      </span>
    );
  }
  return (
    <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
      Offline
    </span>
  );
}
