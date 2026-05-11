"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowLeft,
  Building2,
  Calendar,
  Check,
  Clock,
  Copy,
  CreditCard,
  Eye,
  EyeOff,
  FlaskConical,
  Hash,
  Info,
  Loader2,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  ShieldCheck,
  Sparkles,
  Trash2,
  User as UserIcon,
  UserCog,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { useAsync, errorMessage } from "@/lib/hooks/use-async";
import { useHospital } from "@/lib/hooks/use-hospitals";
import { listBranchesForHospital } from "@/lib/api/branches";
import {
  assignSubscription,
  getHospitalSubscription,
  getHospitalSubscriptionHistory,
  listSubscriptionPlans,
  type BillingCycle,
  type HospitalSubscription,
  type SubscriptionEvent,
  type SubscriptionPlan,
} from "@/lib/api/subscriptions";
import {
  getPaymentGatewaySettings,
  updatePaymentGatewaySettings,
  type PaymentGatewaySettings,
} from "@/lib/api/payment-gateway";
import { formatCurrency } from "@/lib/format-metric";
import { cn } from "@/lib/utils";
import type { Hospital } from "@/lib/types";

type Tab = "overview" | "plan" | "payment";

const COMMITMENTS: { id: BillingCycle; label: string; days: number }[] = [
  { id: "monthly", label: "Monthly", days: 30 },
  { id: "quarterly", label: "Quarterly", days: 90 },
  { id: "half_yearly", label: "Half-yearly", days: 180 },
  { id: "yearly", label: "Yearly", days: 365 },
];

// ---------- Top-level screen ----------

export function HospitalDetailScreen({ hospitalId }: { hospitalId: string }) {
  const auth = useAuth();
  const [tab, setTab] = useState<Tab>("overview");
  const hospitalQuery = useHospital(hospitalId);

  if (!auth.isLoaded || (hospitalQuery.isLoading && !hospitalQuery.data)) {
    return <Skeleton />;
  }

  if (hospitalQuery.error || !hospitalQuery.data) {
    return (
      <div className="space-y-6">
        <BackLink />
        <Card className="border-rose-200 bg-rose-50 p-6 dark:border-rose-900/40 dark:bg-rose-950/40">
          <p className="text-sm text-rose-700 dark:text-rose-300">
            Couldn't load hospital: {errorMessage(hospitalQuery.error)}
          </p>
          {/* The detail screen sometimes lands in this error state right
              after navigating back from one of the nested create routes,
              even when the hospital exists. Give the user an obvious way
              to retry without manually refreshing the page. */}
          <div className="mt-4 flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void hospitalQuery.refetch()}
              disabled={hospitalQuery.isLoading}
            >
              {hospitalQuery.isLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : null}
              Try again
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/hospitals">Back to hospitals list</Link>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // Backstop: if the API row doesn't carry `id` (e.g. an unexpected envelope
  // shape), fall back to the URL param so the nested admin/user create links
  // never resolve to `/hospitals/undefined/...`.
  const hospital: Hospital = {
    ...hospitalQuery.data,
    id: hospitalQuery.data.id ?? hospitalId,
  };

  return (
    <div className="space-y-6">
      <BackLink />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">
            {hospital.name}
          </h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            View and manage hospital information
          </p>
        </div>
        <StatusPill status={(hospital as Hospital & { status?: string }).status ?? "ACTIVE"} />
      </div>

      <TabBar value={tab} onChange={setTab} />

      {tab === "overview" ? (
        <OverviewTab hospital={hospital} />
      ) : tab === "plan" ? (
        <PlanSubscriptionTab hospitalId={hospital.id} />
      ) : (
        <PaymentGatewayTab hospitalId={hospital.id} />
      )}
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/hospitals"
      className="inline-flex items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:hover:text-zinc-50"
    >
      <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
      Go Back
    </Link>
  );
}

function StatusPill({ status }: { status: string }) {
  const active = status.toUpperCase() === "ACTIVE";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 self-start rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wider",
        active
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
          : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          active ? "bg-emerald-500" : "bg-zinc-400",
        )}
      />
      {status.toUpperCase()}
    </span>
  );
}

function TabBar({
  value,
  onChange,
}: {
  value: Tab;
  onChange: (next: Tab) => void;
}) {
  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "plan", label: "Plan & subscription" },
    { id: "payment", label: "Payment gateway" },
  ];
  return (
    <div className="flex border-b border-zinc-200 dark:border-zinc-800">
      {tabs.map((t) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            aria-pressed={active}
            className={cn(
              "border-b-2 px-4 py-2 text-sm font-medium transition-colors",
              active
                ? "border-sky-500 text-sky-700 dark:text-sky-400"
                : "border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50",
            )}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

// =================================================================
// OVERVIEW TAB
// =================================================================

function OverviewTab({ hospital }: { hospital: Hospital }) {
  const branches = useAsync(
    (signal) => listBranchesForHospital(hospital.id, signal).catch(() => []),
    [hospital.id],
  );
  const branchList = branches.data ?? [];

  // The current Hospital type only has aggregate counts (adminCount, userCount,
  // branchCount) — not per-row people lists. The richer cards below fall back
  // to "list-not-available" copy when the new endpoints aren't ready.
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <BasicInformationCard hospital={hospital} />
        <NyraAINumberCard hospital={hospital} />
        <BranchesCard branches={branchList} isLoading={branches.isLoading} />
        <HospitalAdminsCard hospital={hospital} />
        <BranchManagersCard hospital={hospital} />
        <DoctorsCard hospital={hospital} />
        <ReceptionistsCard hospital={hospital} />
        <ClinicConfigCard hospital={hospital} />
      </div>
      <div className="space-y-4">
        <StatisticsCard
          hospital={hospital}
          branches={branchList.length || hospital.branchCount}
        />
        <ActionsCard hospital={hospital} />
        <AdditionalInfoCard hospital={hospital} />
      </div>
    </div>
  );
}

function SectionCard({
  icon: Icon,
  title,
  iconTone = "sky",
  action,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: React.ReactNode;
  iconTone?: "sky" | "violet" | "emerald" | "amber" | "rose" | "zinc";
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  const tone = {
    sky: "bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400",
    violet:
      "bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400",
    emerald:
      "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400",
    amber:
      "bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400",
    rose: "bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400",
    zinc: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  }[iconTone];

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <span
            aria-hidden
            className={cn("grid h-6 w-6 place-items-center rounded-md", tone)}
          >
            <Icon className="h-3.5 w-3.5" />
          </span>
          {title}
        </h2>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </Card>
  );
}

function Detail({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        <Icon className="h-3 w-3" aria-hidden />
        {label}
      </div>
      <div className="mt-1 truncate text-sm">{value}</div>
    </div>
  );
}

// ---------- Basic information ----------

function BasicInformationCard({ hospital }: { hospital: Hospital }) {
  const h = hospital as Hospital & {
    email?: string | null;
    emergency_phone?: string | null;
    location?: string[] | null;
    hospital_type?: string | string[] | null;
  };
  const types = Array.isArray(h.hospital_type)
    ? h.hospital_type
    : h.hospital_type
      ? [h.hospital_type]
      : [];
  return (
    <SectionCard icon={Building2} title="Basic information">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Detail icon={Building2} label="Hospital name" value={hospital.name} />
        <Detail
          icon={MapPin}
          label="Location"
          value={
            (Array.isArray(h.location) && h.location.length > 0
              ? h.location.join(", ")
              : hospital.city) || (
              <span className="text-zinc-400">—</span>
            )
          }
        />
        <Detail
          icon={Phone}
          label="Phone"
          value={hospital.nyraAiNumber ?? <span className="text-zinc-400">—</span>}
        />
        <Detail
          icon={Phone}
          label="Emergency phone"
          value={h.emergency_phone ?? <span className="text-zinc-400">—</span>}
        />
        <Detail
          icon={UserCog}
          label="Created by"
          value={<span className="text-zinc-400">—</span>}
        />
        <Detail
          icon={Mail}
          label="E-mail"
          value={h.email ?? <span className="text-zinc-400">—</span>}
        />
        <div className="sm:col-span-2">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Hospital type
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {types.length === 0 ? (
              <span className="text-sm text-zinc-400">—</span>
            ) : (
              types.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center rounded-full bg-sky-50 px-2.5 py-1 text-xs text-sky-700 dark:bg-sky-950/40 dark:text-sky-300"
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </span>
              ))
            )}
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

// ---------- Nyra AI number ----------

function NyraAINumberCard({ hospital }: { hospital: Hospital }) {
  return (
    <SectionCard icon={Phone} title="Nyra AI number" iconTone="violet">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Detail
          icon={Hash}
          label="Inbound number"
          value={
            <span className="font-mono">{hospital.nyraAiNumber ?? "—"}</span>
          }
        />
        <Detail
          icon={Hash}
          label="Outbound number"
          value={
            <span className="font-mono">{hospital.nyraAiNumber ?? "—"}</span>
          }
        />
      </div>
    </SectionCard>
  );
}

// ---------- Branches ----------

function BranchesCard({
  branches,
  isLoading,
}: {
  branches: { id: string; name: string; status?: string }[];
  isLoading: boolean;
}) {
  return (
    <SectionCard
      icon={Building2}
      title={`Branches (${branches.length})`}
      action={
        <Button
          variant="outline"
          size="sm"
          onClick={() => toast("Add branch — coming soon")}
        >
          <Plus className="h-3.5 w-3.5" />
          Add branch
        </Button>
      }
    >
      {isLoading && branches.length === 0 ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : branches.length === 0 ? (
        <p className="text-sm text-zinc-500">No branches yet.</p>
      ) : (
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {branches.map((b) => (
            <li
              key={b.id}
              className="flex items-center justify-between py-2.5 text-sm"
            >
              <span className="font-medium">{b.name}</span>
              <StatusPill status={b.status ?? "ACTIVE"} />
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

// ---------- Empty-ish placeholder cards ----------
// The current Hospital payload doesn't carry per-row admin / doctor /
// receptionist lists — we surface aggregate counts where we have them and
// a "Add" affordance so the page reads cleanly while the backend wires
// the corresponding list endpoints.

function HospitalAdminsCard({ hospital }: { hospital: Hospital }) {
  return (
    <SectionCard
      icon={ShieldCheck}
      title={`Hospital admins (${hospital.adminCount})`}
      iconTone="violet"
      action={
        <Button asChild size="sm">
          <Link href={`/hospitals/${hospital.id}/admins/new`}>
            <Plus className="h-3.5 w-3.5" />
            Add admin
          </Link>
        </Button>
      }
    >
      {hospital.adminCount === 0 ? (
        <p className="text-sm text-zinc-500">No hospital admins assigned.</p>
      ) : (
        <p className="text-sm text-zinc-500">
          {hospital.adminCount} admin
          {hospital.adminCount === 1 ? "" : "s"} on this hospital. Roster
          listing pending backend endpoint.
        </p>
      )}
    </SectionCard>
  );
}

function BranchManagersCard({ hospital: _h }: { hospital: Hospital }) {
  return (
    <SectionCard
      icon={Users}
      title="Branch managers (0)"
      iconTone="sky"
    >
      <p className="text-sm text-zinc-500">
        No branch managers assigned to this hospital.
      </p>
    </SectionCard>
  );
}

function DoctorsCard({ hospital: _h }: { hospital: Hospital }) {
  return (
    <SectionCard icon={UserIcon} title="Doctors (0)" iconTone="violet">
      <p className="text-sm text-zinc-500">No doctors yet.</p>
    </SectionCard>
  );
}

function ReceptionistsCard({ hospital: _h }: { hospital: Hospital }) {
  return (
    <SectionCard
      icon={UserIcon}
      title="Receptionists (0)"
      iconTone="sky"
    >
      <p className="text-sm text-zinc-500">No receptionists for this hospital.</p>
    </SectionCard>
  );
}

// ---------- Clinic configuration ----------

function ClinicConfigCard({ hospital }: { hospital: Hospital }) {
  const h = hospital as Hospital & {
    hospital_type?: string | string[] | null;
    op_fee?: number | null;
    treatments?: string[] | null;
    start_language?: string | null;
    localized_names?: Record<string, string> | null;
  };
  const types = Array.isArray(h.hospital_type)
    ? h.hospital_type
    : h.hospital_type
      ? [h.hospital_type]
      : [];
  const treatments = h.treatments ?? [];
  const localized = h.localized_names ?? {};

  return (
    <SectionCard
      icon={Building2}
      title="Clinic Configuration"
      iconTone="emerald"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Clinic type
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {types.length === 0 ? (
              <span className="text-sm text-zinc-400">—</span>
            ) : (
              types.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center rounded-full bg-sky-50 px-2.5 py-1 text-xs text-sky-700 dark:bg-sky-950/40 dark:text-sky-300"
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </span>
              ))
            )}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            AI language
          </div>
          <div className="mt-2">
            {h.start_language ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-2.5 py-1 text-xs text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">
                <Sparkles className="h-3 w-3" aria-hidden />
                {h.start_language}
              </span>
            ) : (
              <span className="text-sm text-zinc-400">—</span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          OP consultation fee
        </div>
        <div className="mt-1 text-base font-semibold">
          {typeof h.op_fee === "number" ? (
            formatCurrency(h.op_fee, "INR")
          ) : (
            <span className="text-zinc-400">—</span>
          )}
        </div>
      </div>

      {Object.keys(localized).length > 0 ? (
        <div className="mt-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Hospital name (languages)
          </div>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {Object.entries(localized).map(([lang, name]) => (
              <div
                key={lang}
                className="rounded-md border border-zinc-200 p-2 dark:border-zinc-800"
              >
                <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  {lang}
                </div>
                <div className="mt-0.5 truncate text-sm">{name}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {treatments.length > 0 ? (
        <div className="mt-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Treatments offered
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {treatments.map((t) => (
              <span
                key={t}
                className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-1 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
              >
                {t.replace(/[-_]/g, " ")}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </SectionCard>
  );
}

// ---------- Right-column cards ----------

function StatisticsCard({
  hospital,
  branches,
}: {
  hospital: Hospital;
  branches: number;
}) {
  const rows = [
    { label: "Total users", value: hospital.userCount },
    { label: "Admins", value: hospital.adminCount },
    { label: "Managers", value: 0 },
    { label: "Doctors", value: 0 },
    { label: "Receptionists", value: 0 },
    { label: "Branches", value: branches },
  ];
  return (
    <SectionCard icon={Activity} title="Statistics" iconTone="emerald">
      <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {rows.map((r) => (
          <li
            key={r.label}
            className="flex items-center justify-between py-2.5 text-sm"
          >
            <span className="text-zinc-700 dark:text-zinc-300">{r.label}</span>
            <span className="font-semibold tabular-nums">{r.value}</span>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

function ActionsCard({ hospital }: { hospital: Hospital }) {
  return (
    <SectionCard icon={Sparkles} title="Actions" iconTone="amber">
      <div className="space-y-2">
        <Button
          className="w-full justify-center bg-sky-600 hover:bg-sky-700"
          onClick={() => toast("Edit hospital — coming soon")}
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit hospital
        </Button>
        <Button
          asChild
          className="w-full justify-center bg-emerald-600 hover:bg-emerald-700"
        >
          <Link href={`/hospitals/${hospital.id}/admins/new`}>
            <UserPlus className="h-3.5 w-3.5" />
            Add admin
          </Link>
        </Button>
        <Button
          asChild
          className="w-full justify-center bg-violet-600 hover:bg-violet-700"
        >
          <Link href={`/hospitals/${hospital.id}/users/new`}>
            <UserPlus className="h-3.5 w-3.5" />
            Add user
          </Link>
        </Button>
        <Button
          variant="outline"
          className="w-full justify-center border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-900/40 dark:text-rose-300 dark:hover:bg-rose-950/40"
          onClick={() =>
            toast(`Delete ${hospital.name} — coming soon`, {
              description: "Soft-delete via DELETE /api/hospitals/:id",
            })
          }
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete hospital
        </Button>
      </div>
    </SectionCard>
  );
}

function AdditionalInfoCard({ hospital }: { hospital: Hospital }) {
  const h = hospital as Hospital & {
    created_at?: string | null;
    updated_at?: string | null;
  };
  const handleCopy = () => {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    void navigator.clipboard.writeText(hospital.id);
    toast.success("Copied hospital ID");
  };
  return (
    <SectionCard icon={Info} title="Additional information" iconTone="sky">
      <div className="space-y-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Hospital ID
          </div>
          <div className="mt-1 flex items-center gap-2">
            <code className="truncate rounded bg-zinc-100 px-2 py-1 font-mono text-xs dark:bg-zinc-800">
              {hospital.id}
            </code>
            <button
              type="button"
              onClick={handleCopy}
              aria-label="Copy hospital ID"
              className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
            >
              <Copy className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Created
            </div>
            <div className="mt-1 text-sm">
              {h.created_at ? fmtDateTime(h.created_at) : "—"}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Last updated
            </div>
            <div className="mt-1 text-sm">
              {h.updated_at ? fmtDateTime(h.updated_at) : "Not yet updated"}
            </div>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

// =================================================================
// PLAN & SUBSCRIPTION TAB
// =================================================================

function PlanSubscriptionTab({ hospitalId }: { hospitalId: string }) {
  const subscription = useAsync(
    (signal) =>
      getHospitalSubscription(hospitalId, signal).catch(() => null),
    [hospitalId],
  );
  const plansQuery = useAsync(
    (signal) => listSubscriptionPlans(signal).catch(() => [] as SubscriptionPlan[]),
    [],
  );
  const history = useAsync(
    (signal) =>
      getHospitalSubscriptionHistory(hospitalId, signal).catch(
        () => [] as SubscriptionEvent[],
      ),
    [hospitalId],
  );

  const [commitment, setCommitment] = useState<BillingCycle>("monthly");
  const [pendingPlanId, setPendingPlanId] = useState<number | null>(null);
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    if (subscription.data?.billing_cycle) {
      setCommitment(subscription.data.billing_cycle);
    }
  }, [subscription.data?.billing_cycle]);

  const plans = plansQuery.data ?? [];
  const activeSub = subscription.data;

  const handleAssign = async () => {
    if (!pendingPlanId) {
      toast.error("Pick a plan first.");
      return;
    }
    setAssigning(true);
    try {
      await assignSubscription({
        hospital_id: hospitalId,
        plan_id: pendingPlanId,
        billing_cycle: commitment,
        payment_mode: "offline",
        status: "ACTIVE",
      });
      toast.success("Subscription updated");
      void subscription.refetch();
      void history.refetch();
      setPendingPlanId(null);
    } catch (err) {
      toast.error("Couldn't update subscription", {
        description: errorMessage(err),
      });
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div className="space-y-4">
      <ActiveSubscriptionCard
        subscription={activeSub}
        isLoading={subscription.isLoading}
        onChangePlan={() => {
          // Scrolls into view; the plan cards below handle the actual pick.
          document
            .getElementById("plans-and-pricing")
            ?.scrollIntoView({ behavior: "smooth", block: "start" });
        }}
      />

      <div id="plans-and-pricing" className="space-y-3">
        <div>
          <h2 className="text-base font-semibold">Plans &amp; pricing</h2>
          <p className="text-xs text-zinc-500">
            Compare tiers by billing period. Your current selection is
            highlighted.
          </p>
        </div>

        <CommitmentTabs value={commitment} onChange={setCommitment} />

        {plansQuery.isLoading && plans.length === 0 ? (
          <Card className="h-48 animate-pulse" />
        ) : plans.length === 0 ? (
          <Card className="p-6 text-sm text-zinc-500">
            No subscription plans available yet.
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {plans.map((p) => (
              <PlanCard
                key={p.id}
                plan={p}
                commitment={commitment}
                isActive={activeSub?.plan_id === p.id}
                isPending={pendingPlanId === p.id}
                onPick={() => setPendingPlanId(p.id)}
              />
            ))}
          </div>
        )}

        {pendingPlanId !== null ? (
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setPendingPlanId(null)}
              disabled={assigning}
            >
              Cancel
            </Button>
            <Button onClick={handleAssign} disabled={assigning}>
              {assigning ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              Apply {plans.find((p) => p.id === pendingPlanId)?.name}
            </Button>
          </div>
        ) : null}

        <DetailedComparison plans={plans} />
      </div>

      <div className="space-y-3">
        <h2 className="text-base font-semibold">Subscription history</h2>
        <SubscriptionHistory
          events={history.data ?? []}
          isLoading={history.isLoading}
        />
      </div>
    </div>
  );
}

function ActiveSubscriptionCard({
  subscription,
  isLoading,
  onChangePlan,
}: {
  subscription: HospitalSubscription | null | undefined;
  isLoading: boolean;
  onChangePlan: () => void;
}) {
  if (isLoading && !subscription) {
    return <Card className="h-40 animate-pulse" />;
  }
  if (!subscription) {
    return (
      <Card className="p-5">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          Subscription
        </div>
        <div className="mt-1 text-base font-semibold">No active plan</div>
        <p className="mt-1 text-sm text-zinc-500">
          Assign a plan from the list below to activate billing.
        </p>
      </Card>
    );
  }

  const usagePct = Math.min(100, subscription.usage_percent);
  const billingLabel =
    COMMITMENTS.find((c) => c.id === subscription.billing_cycle)?.label ??
    subscription.billing_cycle;
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Subscription
            </span>
            <StatusPill status={subscription.status} />
          </div>
          <div className="mt-1 text-xl font-semibold tracking-tight">
            {subscription.plan_name}
          </div>
          <div className="text-xs text-zinc-500">{billingLabel} billing</div>
        </div>
        <div className="text-right">
          <div className="text-xl font-bold tabular-nums text-sky-600 dark:text-sky-400">
            {formatCurrency(subscription.price, "INR")}
            <span className="ml-0.5 text-xs text-zinc-500">/mo</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={onChangePlan}
          >
            <Pencil className="h-3.5 w-3.5" />
            Change plan
          </Button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-500">Appointments</span>
            <span className="font-semibold tabular-nums">{usagePct}%</span>
          </div>
          <div className="mt-1 text-sm font-semibold tabular-nums">
            {subscription.appointments_used.toLocaleString()} /{" "}
            {subscription.appointments_limit.toLocaleString()}
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
            <span
              aria-hidden
              className={cn(
                "block h-full rounded-full",
                usagePct >= 80
                  ? "bg-rose-500"
                  : usagePct >= 50
                    ? "bg-amber-500"
                    : "bg-emerald-500",
              )}
              style={{ width: `${usagePct}%` }}
            />
          </div>
        </div>
        <div className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
          <div className="text-xs text-zinc-500">Branches</div>
          <div className="mt-1 text-sm font-semibold">
            {subscription.days_until_renewal} days until renewal
          </div>
          <div className="mt-2 text-xs text-zinc-500">
            Renews {fmtDate(subscription.next_billing_date)}
          </div>
        </div>
      </div>
    </Card>
  );
}

function CommitmentTabs({
  value,
  onChange,
}: {
  value: BillingCycle;
  onChange: (next: BillingCycle) => void;
}) {
  return (
    <div className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-950">
      {COMMITMENTS.map((c) => {
        const active = c.id === value;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onChange(c.id)}
            aria-pressed={active}
            className={cn(
              "flex flex-col items-center rounded-md px-3 py-1 text-xs font-medium transition-colors",
              active
                ? "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300"
                : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50",
            )}
          >
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" aria-hidden />
              {c.label}
            </span>
            <span className="text-[9px] text-zinc-500">{c.days} Days</span>
          </button>
        );
      })}
    </div>
  );
}

function priceFor(plan: SubscriptionPlan, cycle: BillingCycle): number | null {
  switch (cycle) {
    case "monthly":
      return plan.monthly_price ?? plan.price ?? null;
    case "quarterly":
      return plan.quarterly_price_per_month ?? null;
    case "half_yearly":
      return plan.half_yearly_price_per_month ?? null;
    case "yearly":
      return plan.yearly_price_per_month ?? null;
  }
}

function discountFor(plan: SubscriptionPlan, cycle: BillingCycle): number {
  const base = plan.monthly_price ?? plan.price ?? 0;
  const here = priceFor(plan, cycle);
  if (!base || !here || cycle === "monthly") return 0;
  return Math.max(0, Math.round(((base - here) / base) * 100));
}

function PlanCard({
  plan,
  commitment,
  isActive,
  isPending,
  onPick,
}: {
  plan: SubscriptionPlan;
  commitment: BillingCycle;
  isActive: boolean;
  isPending: boolean;
  onPick: () => void;
}) {
  const price = priceFor(plan, commitment);
  const discount = discountFor(plan, commitment);
  const bullets: string[] = [];
  if (plan.description) bullets.push(plan.description);
  const limit = plan.appointments_limit ?? plan.call_limit;
  if (limit) bullets.push(`Up to ${limit} appointments per month`);
  if (plan.branch_limit)
    bullets.push(
      `Up to ${plan.branch_limit} ${plan.branch_limit === 1 ? "Branch" : "Branches"}`,
    );

  return (
    <button
      type="button"
      onClick={onPick}
      className={cn(
        "relative rounded-lg border-2 p-4 text-left transition-colors",
        isActive
          ? "border-sky-500 bg-sky-50/40 dark:bg-sky-950/20"
          : isPending
            ? "border-violet-500 bg-violet-50/40 dark:bg-violet-950/20"
            : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700",
        price === null && "opacity-50",
      )}
      disabled={price === null}
    >
      {isActive ? (
        <span className="absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-sky-500 px-2 py-0.5 text-[9px] font-semibold text-white">
          ACTIVE PLAN
        </span>
      ) : null}
      <div className="flex items-center gap-1.5 text-sm font-semibold">
        <Sparkles className="h-3.5 w-3.5 text-sky-500" aria-hidden />
        {plan.name}
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-xl font-bold tabular-nums">
          {price !== null ? formatCurrency(price, "INR") : "—"}
        </span>
        <span className="text-xs text-zinc-500">/mo</span>
      </div>
      <div
        className={cn(
          "mt-1 text-[10px] font-semibold uppercase tracking-wider",
          discount > 0
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-zinc-400",
        )}
      >
        {discount > 0 ? `${discount}% discount` : "0% discount"}
      </div>
      <ul className="mt-3 space-y-1 text-xs text-zinc-600 dark:text-zinc-400">
        {bullets.map((b, i) => (
          <li key={i} className="flex items-start gap-1">
            <Check
              className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500"
              aria-hidden
            />
            <span>{b}</span>
          </li>
        ))}
      </ul>
    </button>
  );
}

function DetailedComparison({ plans }: { plans: SubscriptionPlan[] }) {
  if (plans.length === 0) return null;
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
        <Info className="h-4 w-4 text-zinc-400" aria-hidden />
        <h3 className="text-sm font-medium">Detailed comparison</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50/50 text-[10px] uppercase tracking-wider text-zinc-500 dark:bg-zinc-900/50">
            <tr className="text-left">
              <th className="px-4 py-2 font-semibold">Commitment</th>
              {plans.map((p) => (
                <th key={p.id} className="px-4 py-2 font-semibold">
                  {p.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {COMMITMENTS.map((c) => (
              <tr
                key={c.id}
                className="border-t border-zinc-100 dark:border-zinc-800"
              >
                <td className="px-4 py-3 font-medium">{c.label}</td>
                {plans.map((p) => {
                  const price = priceFor(p, c.id);
                  const discount = discountFor(p, c.id);
                  return (
                    <td key={p.id} className="px-4 py-3">
                      {price === null ? (
                        <span className="text-zinc-400">—</span>
                      ) : (
                        <>
                          <div className="font-semibold tabular-nums">
                            {formatCurrency(price, "INR")}
                          </div>
                          <span
                            className={cn(
                              "mt-0.5 inline-block rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider",
                              discount > 0
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                                : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800",
                            )}
                          >
                            {c.id === "yearly" && discount > 0
                              ? "BEST VALUE"
                              : discount > 0
                                ? "SAVE"
                                : "0%"}
                          </span>
                        </>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function SubscriptionHistory({
  events,
  isLoading,
}: {
  events: SubscriptionEvent[];
  isLoading: boolean;
}) {
  if (isLoading && events.length === 0) {
    return <Card className="h-24 animate-pulse" />;
  }
  if (events.length === 0) {
    return (
      <Card className="border-dashed p-6 text-center text-sm text-zinc-500">
        No subscription history yet.
      </Card>
    );
  }
  return (
    <Card className="overflow-hidden">
      <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {events.map((e) => (
          <li
            key={e.id}
            className="flex items-center justify-between px-4 py-3 text-sm"
          >
            <span className="font-medium">{e.event_type}</span>
            <span className="text-xs text-zinc-500">
              {fmtDateTime(e.occurred_at)}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

// =================================================================
// PAYMENT GATEWAY TAB
// =================================================================

function PaymentGatewayTab({ hospitalId }: { hospitalId: string }) {
  const settingsQuery = useAsync(
    (signal) =>
      getPaymentGatewaySettings(hospitalId, signal).catch(
        () => null as PaymentGatewaySettings | null,
      ),
    [hospitalId],
  );

  const [form, setForm] = useState<PaymentGatewaySettings>({
    razorpay_enabled: false,
    razorpay_key_id: "",
    razorpay_key_secret: "",
    razorpay_webhook_url: "",
    razorpay_webhook_secret: "",
    whatsapp_payment_links_enabled: false,
    whatsapp_provider_key: "",
  });
  const [showSecret, setShowSecret] = useState(false);
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settingsQuery.data) {
      setForm({
        razorpay_enabled: settingsQuery.data.razorpay_enabled ?? false,
        razorpay_key_id: settingsQuery.data.razorpay_key_id ?? "",
        // Backend masks the secret on read — show as empty so the user
        // doesn't think they're seeing the real value.
        razorpay_key_secret: "",
        razorpay_webhook_url: settingsQuery.data.razorpay_webhook_url ?? "",
        razorpay_webhook_secret: "",
        whatsapp_payment_links_enabled:
          settingsQuery.data.whatsapp_payment_links_enabled ?? false,
        whatsapp_provider_key: settingsQuery.data.whatsapp_provider_key ?? "",
      });
    }
  }, [settingsQuery.data]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updatePaymentGatewaySettings({
        hospital_id: hospitalId,
        razorpay_enabled: form.razorpay_enabled,
        razorpay_key_id: form.razorpay_key_id || undefined,
        // Only send secrets when the user actually typed something —
        // empty = "keep existing", per the spec.
        razorpay_key_secret: form.razorpay_key_secret || undefined,
        razorpay_webhook_url: form.razorpay_webhook_url || undefined,
        razorpay_webhook_secret: form.razorpay_webhook_secret || undefined,
        whatsapp_payment_links_enabled: form.whatsapp_payment_links_enabled,
        whatsapp_provider_key: form.whatsapp_provider_key || undefined,
      });
      toast.success("Payment gateway settings saved");
      void settingsQuery.refetch();
    } catch (err) {
      toast.error("Couldn't save settings", { description: errorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-5">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400"
        >
          <CreditCard className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-base font-semibold">
            Razorpay &amp; WhatsApp payment links
          </h2>
          <p className="mt-0.5 text-sm text-zinc-500">
            Configure per-hospital keys and toggles for campaign recharge and
            other payment links. Webhook verification should use the raw
            request body and your webhook secret.
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        <Card className="bg-zinc-50/50 p-4 dark:bg-zinc-900/40">
          <div className="flex items-start gap-3">
            <span
              aria-hidden
              className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400"
            >
              <CreditCard className="h-3.5 w-3.5" />
            </span>
            <div>
              <h3 className="text-sm font-semibold">Razorpay &amp; WhatsApp</h3>
              <p className="mt-0.5 text-xs text-zinc-500">
                Enable online payments and optional WhatsApp payment links for
                this hospital. Secrets are masked in responses; leave blank to
                keep existing values when the API masks them.
              </p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-4">
            <Toggle
              checked={form.razorpay_enabled}
              onChange={(v) => setForm((f) => ({ ...f, razorpay_enabled: v }))}
              label="Razorpay enabled"
            />
            <Toggle
              checked={form.whatsapp_payment_links_enabled}
              onChange={(v) =>
                setForm((f) => ({ ...f, whatsapp_payment_links_enabled: v }))
              }
              label="WhatsApp payment links"
            />
          </div>
        </Card>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Razorpay Key ID</Label>
            <Input
              value={form.razorpay_key_id}
              onChange={(e) =>
                setForm((f) => ({ ...f, razorpay_key_id: e.target.value }))
              }
              placeholder="rzp_test_…"
              className="font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Razorpay Key Secret</Label>
            <div className="relative">
              <Input
                type={showSecret ? "text" : "password"}
                value={form.razorpay_key_secret}
                onChange={(e) =>
                  setForm((f) => ({ ...f, razorpay_key_secret: e.target.value }))
                }
                placeholder="Required for new setup"
                className="pr-10 font-mono"
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => setShowSecret((v) => !v)}
                aria-label={showSecret ? "Hide secret" : "Show secret"}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              >
                {showSecret ? (
                  <EyeOff className="h-3.5 w-3.5" aria-hidden />
                ) : (
                  <Eye className="h-3.5 w-3.5" aria-hidden />
                )}
              </button>
            </div>
          </div>
          <div className="sm:col-span-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Webhook URL</Label>
              <Input
                value={form.razorpay_webhook_url}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    razorpay_webhook_url: e.target.value,
                  }))
                }
                placeholder="https://your-domain/api/razorpay/webhook"
                className="font-mono"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Webhook secret</Label>
            <div className="relative">
              <Input
                type={showWebhookSecret ? "text" : "password"}
                value={form.razorpay_webhook_secret}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    razorpay_webhook_secret: e.target.value,
                  }))
                }
                className="pr-10 font-mono"
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => setShowWebhookSecret((v) => !v)}
                aria-label={
                  showWebhookSecret
                    ? "Hide webhook secret"
                    : "Show webhook secret"
                }
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              >
                {showWebhookSecret ? (
                  <EyeOff className="h-3.5 w-3.5" aria-hidden />
                ) : (
                  <Eye className="h-3.5 w-3.5" aria-hidden />
                )}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">
              WhatsApp provider key{" "}
              <span className="text-zinc-400">(optional)</span>
            </Label>
            <Input
              value={form.whatsapp_provider_key ?? ""}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  whatsapp_provider_key: e.target.value,
                }))
              }
              className="font-mono"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 pt-2">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : null}
            Save settings
          </Button>
          <Button
            variant="outline"
            onClick={() => toast("Test connection — coming soon")}
          >
            <FlaskConical className="h-3.5 w-3.5" />
            Test connection
          </Button>
        </div>
      </div>
    </Card>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-3.5 w-3.5 rounded border-zinc-300"
      />
      <span className="text-zinc-700 dark:text-zinc-300">{label}</span>
    </label>
  );
}

// ---------- Helpers ----------

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// ---------- Skeleton ----------

function Skeleton() {
  return (
    <div className="space-y-6">
      <div className="h-4 w-24 animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-800" />
      <div className="h-8 w-72 animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-800" />
      <div className="h-10 animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-800" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card className="h-48 animate-pulse" />
          <Card className="h-32 animate-pulse" />
          <Card className="h-40 animate-pulse" />
        </div>
        <div className="space-y-4">
          <Card className="h-48 animate-pulse" />
          <Card className="h-40 animate-pulse" />
        </div>
      </div>
    </div>
  );
}
