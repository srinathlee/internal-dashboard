"use client";

import { useMemo, useState } from "react";
import { Footprints, MapPinned, Route, Users } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

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
import { useAuth } from "@/lib/auth";
import {
  isSalesAdminOrSuperAdmin,
  isSalesMember,
  isOnSales,
} from "@/lib/access";
import { getInitials } from "@/lib/format";
import { errorMessage } from "@/lib/hooks/use-async";
import {
  useDistanceHistory,
  useDistanceToday,
  useTeamDistance,
} from "@/lib/hooks/use-distance";
import { cn } from "@/lib/utils";

export function DistanceScreen() {
  const auth = useAuth();
  const member = isSalesMember(auth);
  const admin = isSalesAdminOrSuperAdmin(auth);

  if (!auth.isLoaded) {
    return (
      <div className="space-y-4">
        <Card className="h-20 animate-pulse" />
        <Card className="h-72 animate-pulse" />
      </div>
    );
  }

  if (!isOnSales(auth) && auth.user?.role !== "super_admin") {
    return (
      <div className="space-y-6">
        <PageHeader title="Distance" />
        <Card className="p-12 text-center text-sm text-zinc-500">
          Distance tracking is for the sales team.
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Distance"
        description="Field kilometres logged from live tracking sessions."
      />
      {member ? <MyDistance /> : null}
      {admin ? <TeamDistance /> : null}
    </div>
  );
}

// ---------- Rep view ------------------------------------------------------

function MyDistance() {
  const [days, setDays] = useState(7);
  const todayQuery = useDistanceToday();
  const historyQuery = useDistanceHistory(days);

  const today = todayQuery.data;
  const history = historyQuery.data?.history ?? [];
  // Recharts wants oldest-first so the timeline reads left-to-right.
  const chartData = useMemo(
    () =>
      history
        .slice()
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((d) => ({
          date: d.date.slice(5),
          km: Number(d.km.toFixed(1)),
        })),
    [history],
  );

  return (
    <section className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Kpi
          icon={Footprints}
          label="Today"
          value={
            todayQuery.isLoading
              ? "—"
              : today
                ? `${today.km.toFixed(1)} km`
                : "0 km"
          }
          hint={
            today
              ? `${today.sessions} session${today.sessions === 1 ? "" : "s"}`
              : "No sessions yet"
          }
        />
        <Kpi
          icon={Route}
          label={`Last ${days} days`}
          value={
            historyQuery.isLoading
              ? "—"
              : `${chartData.reduce((s, d) => s + d.km, 0).toFixed(1)} km`
          }
          hint="Sum of daily totals"
        />
        <Kpi
          icon={MapPinned}
          label="Daily average"
          value={
            historyQuery.isLoading || chartData.length === 0
              ? "—"
              : `${(chartData.reduce((s, d) => s + d.km, 0) / chartData.length).toFixed(1)} km`
          }
          hint={`Over ${chartData.length} day${chartData.length === 1 ? "" : "s"}`}
        />
      </div>

      <Card className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">Daily distance</h3>
            <p className="text-xs text-zinc-500">
              Kilometres traveled per day from your live tracking sessions.
            </p>
          </div>
          <Select
            value={String(days)}
            onValueChange={(v) => setDays(Number(v))}
          >
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 days</SelectItem>
              <SelectItem value="14">14 days</SelectItem>
              <SelectItem value="30">30 days</SelectItem>
              <SelectItem value="60">60 days</SelectItem>
              <SelectItem value="90">90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="mt-4 h-64">
          {historyQuery.error ? (
            <div className="grid h-full place-items-center text-sm text-rose-500">
              {errorMessage(historyQuery.error)}
            </div>
          ) : chartData.length === 0 ? (
            <div className="grid h-full place-items-center text-sm text-zinc-500">
              {historyQuery.isLoading ? "Loading…" : "No distance recorded yet."}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 5, right: 10, left: -10, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-zinc-200 dark:stroke-zinc-800"
                />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  unit=" km"
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 8,
                    border: "1px solid rgba(0,0,0,0.08)",
                  }}
                />
                <Bar dataKey="km" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>
    </section>
  );
}

// ---------- Admin view ----------------------------------------------------

function TeamDistance() {
  const todayString = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const teamQuery = useTeamDistance({ date: todayString });

  const data = teamQuery.data;
  const members = data?.members ?? [];

  return (
    <section className="space-y-4">
      <h2 className="text-sm font-semibold">Team distance — today</h2>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Kpi
          icon={Users}
          label="Reps active"
          value={teamQuery.isLoading ? "—" : String(members.length)}
          hint="With at least one session today"
        />
        <Kpi
          icon={Route}
          label="Total distance"
          value={
            teamQuery.isLoading
              ? "—"
              : `${(data?.total_km ?? 0).toFixed(1)} km`
          }
          hint="Sum across reps"
        />
        <Kpi
          icon={MapPinned}
          label="Average per rep"
          value={
            teamQuery.isLoading
              ? "—"
              : `${(data?.average_km ?? 0).toFixed(1)} km`
          }
          hint="Mean of active reps"
        />
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3 dark:border-zinc-800">
          <h3 className="text-sm font-semibold">Rep breakdown</h3>
          <span className="text-xs text-zinc-500">{todayString}</span>
        </div>

        {teamQuery.error ? (
          <div className="p-6 text-center text-sm text-rose-500">
            {errorMessage(teamQuery.error)}
          </div>
        ) : members.length === 0 ? (
          <div className="p-10 text-center text-sm text-zinc-500">
            {teamQuery.isLoading
              ? "Loading…"
              : "No reps recorded distance today."}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-zinc-50/40 text-[10px] uppercase tracking-wider text-zinc-500 dark:bg-zinc-900/40">
              <tr className="text-left">
                <th className="px-5 py-2 font-semibold">Rep</th>
                <th className="px-5 py-2 text-right font-semibold">Sessions</th>
                <th className="px-5 py-2 text-right font-semibold">Visits</th>
                <th className="px-5 py-2 text-right font-semibold">Distance</th>
              </tr>
            </thead>
            <tbody>
              {members
                .slice()
                .sort((a, b) => b.km - a.km)
                .map((m) => (
                  <tr
                    key={m.user_id}
                    className="border-t border-zinc-100 dark:border-zinc-800"
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar className="h-7 w-7">
                          <AvatarFallback className="text-[10px]">
                            {getInitials(m.user_name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{m.user_name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      {m.sessions}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      {m.visits_today ?? "—"}
                    </td>
                    <td className="px-5 py-3 text-right font-semibold tabular-nums">
                      {m.km.toFixed(1)} km
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </Card>
    </section>
  );
}

// ---------- Shared --------------------------------------------------------

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Footprints;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <span className={cn("grid h-9 w-9 place-items-center rounded-md bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400")}>
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            {label}
          </div>
          <div className="text-2xl font-bold tabular-nums">{value}</div>
          {hint ? <div className="text-xs text-zinc-500">{hint}</div> : null}
        </div>
      </div>
    </Card>
  );
}
