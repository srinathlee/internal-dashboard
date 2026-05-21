"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Loader2,
  Plus,
  Search,
  Trash2,
  TrendingUp,
  UserCog,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/layout/page-header";
import { useAuth } from "@/lib/auth";
import { isSalesAdminOrSuperAdmin } from "@/lib/access";
import { getInitials } from "@/lib/format";
import { formatCurrency } from "@/lib/format-metric";
import { errorMessage } from "@/lib/hooks/use-async";
import {
  useGroup,
  useGroupAnalytics,
  useGroupMutations,
  useGroups,
} from "@/lib/hooks/use-groups";
import { useSubadmins } from "@/lib/hooks/use-subadmins";
import type {
  CreateGroupInput,
  GroupAnalyticsPeriod,
  SalesGroup,
  SalesGroupColor,
} from "@/lib/api/sales-groups";
import { cn } from "@/lib/utils";

const COLORS: { value: SalesGroupColor; label: string; class: string }[] = [
  { value: "blue", label: "Blue", class: "bg-sky-500" },
  { value: "red", label: "Red", class: "bg-rose-500" },
  { value: "green", label: "Green", class: "bg-emerald-500" },
  { value: "purple", label: "Purple", class: "bg-violet-500" },
  { value: "orange", label: "Orange", class: "bg-orange-500" },
];

const COLOR_BG: Record<SalesGroupColor, string> = {
  blue: "bg-sky-500",
  red: "bg-rose-500",
  green: "bg-emerald-500",
  purple: "bg-violet-500",
  orange: "bg-orange-500",
};

export function GroupsScreen() {
  const auth = useAuth();
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const groupsQuery = useGroups({
    q: search.trim() || undefined,
  });

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
        <PageHeader title="Groups" />
        <Card className="p-12 text-center text-sm text-zinc-500">
          Group management is for sales admins and super admins.
        </Card>
      </div>
    );
  }

  const groups = groupsQuery.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Groups"
        description="Organise reps into zones or sub-teams. Each rep belongs to at most one group."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden />
            New group
          </Button>
        }
      />

      <div className="relative max-w-sm">
        <Search
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
        />
        <Input
          type="search"
          placeholder="Search groups"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {groupsQuery.error ? (
        <Card className="border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300">
          {errorMessage(groupsQuery.error)}
        </Card>
      ) : null}

      {groupsQuery.isLoading && groups.length === 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="h-32 animate-pulse" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <Card className="p-12 text-center text-sm text-zinc-500">
          No groups yet. Click <strong>New group</strong> to create one.
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((g) => (
            <GroupCard
              key={g.id}
              group={g}
              onClick={() => setSelectedId(g.id)}
            />
          ))}
        </div>
      )}

      <CreateGroupDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => void groupsQuery.refetch()}
      />

      <GroupDetailDialog
        groupId={selectedId}
        open={selectedId !== null}
        onOpenChange={(o) => {
          if (!o) setSelectedId(null);
        }}
        onMutated={() => void groupsQuery.refetch()}
      />
    </div>
  );
}

// ---------- Group card --------------------------------------------------

function GroupCard({
  group,
  onClick,
}: {
  group: SalesGroup;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex h-full flex-col rounded-xl border border-zinc-200 bg-white p-5 text-left transition-colors hover:border-zinc-300 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700 dark:hover:bg-zinc-900"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden
            className={cn("h-3 w-3 rounded-full", COLOR_BG[group.color])}
          />
          <span className="text-base font-semibold">{group.name}</span>
        </div>
        <ChevronRight
          aria-hidden
          className="h-4 w-4 shrink-0 text-zinc-400 transition-transform group-hover:translate-x-0.5"
        />
      </div>
      {group.description ? (
        <p className="mt-2 line-clamp-2 text-xs text-zinc-500">
          {group.description}
        </p>
      ) : null}
      <div className="mt-auto flex items-center gap-2 pt-4 text-xs text-zinc-500">
        <Users className="h-3.5 w-3.5" aria-hidden />
        <span>
          {group.member_count} member{group.member_count === 1 ? "" : "s"}
        </span>
        {!group.is_active ? (
          <span className="ml-auto rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300">
            Inactive
          </span>
        ) : null}
      </div>
    </button>
  );
}

// ---------- Create group dialog -----------------------------------------

function CreateGroupDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState<SalesGroupColor>("blue");
  const [selectedReps, setSelectedReps] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  const subadminsQuery = useSubadmins({ limit: 200 });
  const reps = subadminsQuery.data?.sales_subadmins ?? [];
  const mutations = useGroupMutations();

  const reset = () => {
    setName("");
    setDescription("");
    setColor("blue");
    setSelectedReps(new Set());
    setSubmitting(false);
  };

  const handleClose = (next: boolean) => {
    onOpenChange(next);
    if (!next) window.setTimeout(reset, 200);
  };

  const toggleRep = (id: string) =>
    setSelectedReps((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Name is required.");
      return;
    }
    setSubmitting(true);
    try {
      const input: CreateGroupInput = {
        name: name.trim(),
        description: description.trim() || undefined,
        color,
        member_ids:
          selectedReps.size > 0 ? Array.from(selectedReps) : undefined,
      };
      await mutations.create(input);
      toast.success("Group created");
      onCreated();
      handleClose(false);
    } catch (err) {
      toast.error("Couldn't create group", {
        description: errorMessage(err),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New group</DialogTitle>
          <DialogDescription>
            Reps can belong to only one group at a time. Adding a rep here
            moves them out of any previous group.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="g-name">Name</Label>
            <Input
              id="g-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. South Zone"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="g-desc">Description</Label>
            <Textarea
              id="g-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this group covers (optional)"
              rows={2}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Colour
            </Label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setColor(c.value)}
                  aria-pressed={color === c.value}
                  className={cn(
                    "flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                    color === c.value
                      ? "border-zinc-900 dark:border-zinc-100"
                      : "border-zinc-200 dark:border-zinc-800",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn("h-3 w-3 rounded-full", c.class)}
                  />
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Add members ({selectedReps.size})
            </Label>
            <div className="max-h-48 overflow-y-auto rounded-md border border-zinc-200 dark:border-zinc-800">
              {subadminsQuery.isLoading ? (
                <div className="p-4 text-center text-xs text-zinc-500">
                  Loading…
                </div>
              ) : reps.length === 0 ? (
                <div className="p-4 text-center text-xs text-zinc-500">
                  No reps available.
                </div>
              ) : (
                reps.map((r) => {
                  const checked = selectedReps.has(r.id);
                  return (
                    <label
                      key={r.id}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 border-b border-zinc-100 px-3 py-2 text-sm transition-colors last:border-b-0 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900",
                        checked && "bg-violet-50/40 dark:bg-violet-950/20",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleRep(r.id)}
                        className="h-3.5 w-3.5"
                      />
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-[10px]">
                          {getInitials(r.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{r.name}</span>
                      <span className="ml-auto truncate text-xs text-zinc-500">
                        {r.email}
                      </span>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleClose(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !name.trim()}>
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Plus className="h-4 w-4" aria-hidden />
              )}
              Create group
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Group detail dialog (members + analytics) -----------------

function GroupDetailDialog({
  groupId,
  open,
  onOpenChange,
  onMutated,
}: {
  groupId: string | null;
  open: boolean;
  onOpenChange: (next: boolean) => void;
  onMutated: () => void;
}) {
  const groupQuery = useGroup(open ? groupId : null);
  const [period, setPeriod] = useState<GroupAnalyticsPeriod>("MONTHLY");
  const analyticsQuery = useGroupAnalytics(open ? groupId : null, period);
  const mutations = useGroupMutations();

  const group = groupQuery.data;
  const analytics = analyticsQuery.data;

  const handleRemoveMember = async (userId: string) => {
    if (!groupId) return;
    if (!window.confirm("Remove this rep from the group?")) return;
    try {
      await mutations.removeMember(groupId, userId);
      toast.success("Rep removed from group");
      await groupQuery.refetch();
      await analyticsQuery.refetch();
      onMutated();
    } catch (err) {
      toast.error("Couldn't remove rep", { description: errorMessage(err) });
    }
  };

  const handleDelete = async () => {
    if (!groupId || !group) return;
    if (
      !window.confirm(
        `Delete group "${group.name}"? Members will be unassigned but not deleted.`,
      )
    )
      return;
    try {
      await mutations.remove(groupId);
      toast.success("Group deleted");
      onMutated();
      onOpenChange(false);
    } catch (err) {
      toast.error("Couldn't delete group", {
        description: errorMessage(err),
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        {!group ? (
          <div className="grid h-32 place-items-center text-sm text-zinc-500">
            {groupQuery.isLoading ? "Loading…" : "Group not found."}
          </div>
        ) : (
          <>
            <DialogHeader>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span
                    aria-hidden
                    className={cn(
                      "h-3 w-3 rounded-full",
                      COLOR_BG[group.color],
                    )}
                  />
                  <DialogTitle>{group.name}</DialogTitle>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleDelete}
                  className="text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:text-rose-400 dark:hover:bg-rose-950/40"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  Delete
                </Button>
              </div>
              {group.description ? (
                <DialogDescription>{group.description}</DialogDescription>
              ) : null}
            </DialogHeader>

            {/* Analytics */}
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Performance</h3>
              <Select
                value={period}
                onValueChange={(v) =>
                  setPeriod(v as GroupAnalyticsPeriod)
                }
              >
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MONTHLY">Monthly</SelectItem>
                  <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                  <SelectItem value="HALF_YEARLY">Half-yearly</SelectItem>
                  <SelectItem value="YEARLY">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {analyticsQuery.error ? (
              <Card className="border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300">
                {errorMessage(analyticsQuery.error)}
              </Card>
            ) : analyticsQuery.isLoading && !analytics ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Card key={i} className="h-20 animate-pulse" />
                ))}
              </div>
            ) : analytics ? (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Stat label="Members" value={String(analytics.summary.total_members)} />
                  <Stat label="Active" value={String(analytics.summary.active_members)} />
                  <Stat label="Leads" value={String(analytics.summary.total_leads)} />
                  <Stat
                    label="Pending FU"
                    value={String(analytics.follow_ups.pending)}
                    tone={analytics.follow_ups.overdue > 0 ? "amber" : undefined}
                  />
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {Object.entries(analytics.targets).map(([key, t]) => (
                    <TargetRow key={key} metricKey={key} target={t} />
                  ))}
                </div>
              </>
            ) : null}

            {/* Members */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">
                Members ({group.members.length})
              </h3>
              {group.members.length === 0 ? (
                <Card className="p-6 text-center text-sm text-zinc-500">
                  No members yet.
                </Card>
              ) : (
                <Card className="overflow-hidden">
                  <table className="w-full text-sm">
                    <tbody>
                      {group.members.map((m) => (
                        <tr
                          key={m.id}
                          className="border-b border-zinc-100 last:border-b-0 dark:border-zinc-800"
                        >
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2.5">
                              <Avatar className="h-7 w-7">
                                <AvatarFallback className="text-[10px]">
                                  {m.initials || getInitials(m.name)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <div className="truncate font-medium">{m.name}</div>
                                <div className="truncate text-xs text-zinc-500">
                                  {m.email}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => void handleRemoveMember(m.id)}
                              className="text-zinc-500 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
                            >
                              <UserCog className="h-3.5 w-3.5" aria-hidden />
                              Remove
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "amber";
}) {
  return (
    <Card className="p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        {label}
      </div>
      <div
        className={cn(
          "mt-1 text-xl font-bold tabular-nums",
          tone === "amber" && "text-amber-600 dark:text-amber-400",
        )}
      >
        {value}
      </div>
    </Card>
  );
}

const STATUS_CHIP: Record<string, string> = {
  ACHIEVED: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  ON_TRACK: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  AT_RISK: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  BEHIND: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
  UNSET: "bg-zinc-50 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400",
};

const STATUS_ICON: Record<string, typeof CheckCircle2> = {
  ACHIEVED: CheckCircle2,
  ON_TRACK: TrendingUp,
  AT_RISK: AlertTriangle,
  BEHIND: AlertTriangle,
  UNSET: TrendingUp,
};

function TargetRow({
  metricKey,
  target,
}: {
  metricKey: string;
  target: {
    target: number;
    actual: number;
    progress_pct: number | null;
    members_with_target: number;
    status: string;
  };
}) {
  const isCurrency =
    metricKey === "sprint_amount" || metricKey === "revenue";
  const fmt = (n: number) =>
    isCurrency ? formatCurrency(n, "INR") : n.toLocaleString("en-IN");
  const Icon = STATUS_ICON[target.status] ?? TrendingUp;
  const pct = target.progress_pct ?? 0;
  const barPct = Math.max(0, Math.min(100, pct));
  return (
    <Card className="p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold capitalize">
          {metricKey.replace(/_/g, " ")}
        </span>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
            STATUS_CHIP[target.status] ?? STATUS_CHIP.UNSET,
          )}
        >
          <Icon className="h-3 w-3" aria-hidden />
          {target.status.replace(/_/g, " ").toLowerCase()}
        </span>
      </div>
      <div className="mt-1.5 text-base font-bold tabular-nums">
        {target.target === 0 ? "—" : fmt(target.actual)}
        {target.target > 0 ? (
          <span className="ml-1 text-xs font-normal text-zinc-500">
            / {fmt(target.target)}
          </span>
        ) : null}
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
        <span
          aria-hidden
          className={cn("block h-full rounded-full", "bg-violet-500")}
          style={{ width: `${barPct}%` }}
        />
      </div>
    </Card>
  );
}
