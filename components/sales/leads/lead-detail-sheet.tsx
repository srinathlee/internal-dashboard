"use client";

import {
  AlertTriangle,
  ArrowRight,
  Building2,
  Calendar,
  Edit3,
  Layers,
  Phone,
  StickyNote,
} from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { getInitials } from "@/lib/format";
import { formatCurrency, formatTimestamp, timeAgo } from "@/lib/format-metric";
import {
  LEAD_SOURCE_LABEL,
  LEAD_STAGE_LABEL,
  LEAD_STAGE_ORDER,
} from "@/lib/sales-leads-data";
import { REFERENCE_DATE, getUser } from "@/lib/mock-data";
import type { Lead, LeadStage, LeadTimelineEvent } from "@/lib/types";

import { LeadStageBadge } from "./lead-stage-badge";

const NOW_ISO = `${REFERENCE_DATE}T12:00:00.000Z`;

interface LeadDetailSheetProps {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChangeStage: (leadId: string, next: LeadStage) => void;
}

export function LeadDetailSheet({
  lead,
  open,
  onOpenChange,
  onChangeStage,
}: LeadDetailSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        // Wider than the default sheet — there's a lot of content here.
        className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-md"
      >
        {lead ? <LeadDetailBody lead={lead} onChangeStage={onChangeStage} /> : null}
      </SheetContent>
    </Sheet>
  );
}

function LeadDetailBody({
  lead,
  onChangeStage,
}: {
  lead: Lead;
  onChangeStage: (leadId: string, next: LeadStage) => void;
}) {
  const owner = getUser(lead.ownerId);

  return (
    <>
      {/* Header */}
      <div className="flex items-start gap-3 border-b border-zinc-200 px-6 pb-4 pt-5 pr-12 dark:border-zinc-800">
        <div
          aria-hidden
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400"
        >
          <Building2 className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <SheetTitle className="truncate text-base font-semibold tracking-tight">
            {lead.clinicName}
          </SheetTitle>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
            <span className="truncate">{lead.doctorName}</span>
            <span className="inline-flex items-center gap-1">
              <Phone className="h-3 w-3" aria-hidden />
              <span className="font-mono">{lead.phone}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Stage row */}
      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
        <LeadStageBadge stage={lead.stage} />
        <Select
          value={lead.stage}
          onValueChange={(v) => onChangeStage(lead.id, v as LeadStage)}
        >
          <SelectTrigger
            className="h-7 w-auto gap-1 px-2 text-xs"
            aria-label="Change stage"
          >
            <SelectValue placeholder="Change" />
          </SelectTrigger>
          <SelectContent>
            {LEAD_STAGE_ORDER.map((s) => (
              <SelectItem key={s} value={s}>
                {LEAD_STAGE_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="ml-auto inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
          {LEAD_SOURCE_LABEL[lead.source]}
        </span>
      </div>

      {/* 3 stat cards */}
      <div className="grid grid-cols-3 gap-2 border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
        <StatCard label="Value">
          {lead.value > 0 ? (
            <span className="tabular-nums">
              {formatCurrency(lead.value, "INR")}
            </span>
          ) : (
            <span className="text-zinc-400">—</span>
          )}
        </StatCard>
        <StatCard label="Last activity">
          <span className="tabular-nums">
            {timeAgo(lead.lastActivityAt, NOW_ISO)}
          </span>
        </StatCard>
        <StatCard label="Owner">
          {owner ? (
            <span className="inline-flex items-center gap-1.5 truncate">
              <Avatar className="h-5 w-5">
                <AvatarFallback className="text-[8px]">
                  {getInitials(owner.name)}
                </AvatarFallback>
              </Avatar>
              <span className="truncate">{owner.name.split(" ")[0]}</span>
            </span>
          ) : (
            <span className="text-zinc-400">—</span>
          )}
        </StatCard>
      </div>

      {/* Action quad */}
      <div className="grid grid-cols-4 gap-2 border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
        <ActionTile
          icon={Phone}
          label="Log call"
          onClick={() => toast.info("Log call modal — Phase 2")}
        />
        <ActionTile
          icon={Calendar}
          label="Meeting"
          onClick={() => toast.info("Meeting form — Phase 2")}
        />
        <ActionTile
          icon={StickyNote}
          label="Note"
          onClick={() => toast.info("Note editor — Phase 2")}
        />
        <ActionTile
          icon={Layers}
          label="Stage"
          onClick={() => toast.info("Use the Change selector above to update stage.")}
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="timeline" className="flex flex-1 flex-col">
        <div className="border-b border-zinc-200 px-6 pt-3 dark:border-zinc-800">
          <TabsList className="h-9 bg-transparent border-0 p-0 shadow-none">
            <TabsTrigger value="timeline" className="h-8 gap-1.5">
              Timeline
              <span className="inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-zinc-100 px-1 text-[10px] font-medium tabular-nums text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                {lead.timeline.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="details" className="h-8">
              Details
            </TabsTrigger>
            <TabsTrigger value="about" className="h-8">
              About
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="timeline" className="mt-0 flex-1 px-6 py-5">
          <NextActionBanner lead={lead} />
          <h3 className="mt-5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Activity
          </h3>
          <Timeline events={lead.timeline} />
        </TabsContent>

        <TabsContent value="details" className="mt-0 px-6 py-5 text-sm">
          <DetailsTab lead={lead} />
        </TabsContent>

        <TabsContent value="about" className="mt-0 px-6 py-5 text-sm">
          <AboutTab lead={lead} />
        </TabsContent>
      </Tabs>
    </>
  );
}

// ---------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------

function StatCard({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="px-3 py-2 shadow-none">
      <div className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </div>
      <div className="mt-1 text-sm font-medium text-zinc-900 dark:text-zinc-50">
        {children}
      </div>
    </Card>
  );
}

function ActionTile({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Phone;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col items-center gap-1.5 rounded-lg border border-zinc-200 bg-white py-3 transition-colors hover:border-zinc-300 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700 dark:hover:bg-zinc-900"
    >
      <Icon className="h-4 w-4 text-zinc-500 group-hover:text-zinc-900 dark:group-hover:text-zinc-50" aria-hidden />
      <span className="text-[10px] font-medium text-zinc-700 dark:text-zinc-300">
        {label}
      </span>
    </button>
  );
}

function NextActionBanner({ lead }: { lead: Lead }) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border px-3 py-2.5 text-sm",
        lead.nextAction
          ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200"
          : "border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400",
      )}
    >
      <AlertTriangle
        className={cn(
          "mt-0.5 h-4 w-4 shrink-0",
          lead.nextAction
            ? "text-amber-600 dark:text-amber-400"
            : "text-zinc-400",
        )}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-semibold uppercase tracking-wider opacity-80">
          Next action
        </div>
        <p className="mt-0.5">{lead.nextAction ?? "No next action set."}</p>
      </div>
      <button
        type="button"
        onClick={() => toast.info("Next action editor — Phase 2")}
        className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-amber-900/40"
      >
        <Edit3 className="h-3 w-3" aria-hidden />
        Edit
      </button>
    </div>
  );
}

function Timeline({ events }: { events: LeadTimelineEvent[] }) {
  if (events.length === 0) {
    return (
      <p className="mt-3 text-sm text-zinc-500">No activity yet.</p>
    );
  }

  // Newest first.
  const sorted = [...events].sort((a, b) =>
    a.timestamp < b.timestamp ? 1 : -1,
  );

  return (
    <ol role="list" className="mt-3 space-y-4">
      {sorted.map((e) => (
        <TimelineRow key={e.id} event={e} />
      ))}
    </ol>
  );
}

function TimelineRow({ event }: { event: LeadTimelineEvent }) {
  const actor = getUser(event.actorId);

  return (
    <li className="flex gap-3">
      <TimelineDot type={event.type} />
      <div className="min-w-0 flex-1 space-y-1.5 pb-1">
        <div className="text-xs text-zinc-500">
          <span className="font-medium text-zinc-900 dark:text-zinc-50">
            {actor?.name ?? "Unknown"}
          </span>
          <span className="mx-1.5 text-zinc-300 dark:text-zinc-700">·</span>
          <span title={formatTimestamp(event.timestamp)}>
            {timeAgo(event.timestamp, NOW_ISO)}
          </span>
          {event.type === "call" && event.durationSec !== undefined && (
            <>
              <span className="mx-1.5 text-zinc-300 dark:text-zinc-700">·</span>
              <span className="font-mono">{formatDuration(event.durationSec)}</span>
            </>
          )}
        </div>
        {event.type === "stage-change" && event.fromStage && event.toStage ? (
          <StageTransition from={event.fromStage} to={event.toStage} />
        ) : null}
        {event.content && (
          <p className="text-sm text-zinc-700 dark:text-zinc-300">{event.content}</p>
        )}
      </div>
    </li>
  );
}

const TIMELINE_DOT_COLOR: Record<LeadTimelineEvent["type"], string> = {
  "stage-change": "bg-emerald-500",
  call: "bg-sky-500",
  meeting: "bg-violet-500",
  note: "bg-zinc-400",
};

function TimelineDot({ type }: { type: LeadTimelineEvent["type"] }) {
  return (
    <div className="flex flex-col items-center" aria-hidden>
      <span
        className={cn(
          "h-2 w-2 shrink-0 rounded-full ring-4 ring-zinc-50 dark:ring-zinc-900",
          TIMELINE_DOT_COLOR[type],
        )}
      />
      <span className="mt-1 w-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
    </div>
  );
}

function StageTransition({
  from,
  to,
}: {
  from: LeadStage;
  to: LeadStage;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <LeadStageBadge stage={from} size="sm" />
      <ArrowRight className="h-3 w-3 text-zinc-400" aria-hidden />
      <LeadStageBadge stage={to} size="sm" />
    </div>
  );
}

function DetailsTab({ lead }: { lead: Lead }) {
  return (
    <dl className="divide-y divide-zinc-100 dark:divide-zinc-800">
      <Row label="Clinic">{lead.clinicName}</Row>
      <Row label="Doctor">{lead.doctorName}</Row>
      <Row label="Phone">
        <span className="font-mono">{lead.phone}</span>
      </Row>
      <Row label="City">{lead.city}</Row>
      <Row label="Stage">
        <LeadStageBadge stage={lead.stage} />
      </Row>
      <Row label="Source">{LEAD_SOURCE_LABEL[lead.source]}</Row>
      <Row label="Value">
        {lead.value > 0 ? formatCurrency(lead.value, "INR") : "—"}
      </Row>
      <Row label="Owner">{getUser(lead.ownerId)?.name ?? "—"}</Row>
      <Row label="Last activity">
        {timeAgo(lead.lastActivityAt, NOW_ISO)}
      </Row>
    </dl>
  );
}

function AboutTab({ lead }: { lead: Lead }) {
  return (
    <div className="space-y-4 text-sm text-zinc-600 dark:text-zinc-400">
      <p>
        {lead.clinicName} is a{" "}
        <span className="font-medium text-zinc-900 dark:text-zinc-50">
          {LEAD_STAGE_LABEL[lead.stage].toLowerCase()}
        </span>{" "}
        lead from {lead.city}, sourced via{" "}
        <span className="font-medium text-zinc-900 dark:text-zinc-50">
          {LEAD_SOURCE_LABEL[lead.source].toLowerCase()}
        </span>
        .
      </p>
      <p className="text-xs text-zinc-500">
        Lead ID:{" "}
        <span className="font-mono text-zinc-700 dark:text-zinc-300">
          {lead.id}
        </span>
      </p>
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-3 gap-3 py-2.5">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </dt>
      <dd className="col-span-2 text-sm text-zinc-900 dark:text-zinc-50">
        {children}
      </dd>
    </div>
  );
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}
