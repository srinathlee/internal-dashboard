"use client";

import { useState } from "react";
import {
  Activity,
  Check,
  CircleCheck,
  IndianRupee,
  Loader2,
  Lock,
  Mail,
  Phone,
  Sparkles,
  Target,
  User,
  UserPlus,
  Users,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api/client";
import { formatCurrency } from "@/lib/format-metric";
import { errorMessage } from "@/lib/hooks/use-async";
import { useSubadminMutations } from "@/lib/hooks/use-subadmins";
import { cn } from "@/lib/utils";

import { PasswordRevealCard } from "./password-reveal-card";

interface AddMemberStepperModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: string;
  onCreated?: () => void;
}

type Step = 1 | 2 | 3;
type TargetTab = "leads" | "sprint" | "revenue";

interface LeadTargets {
  weekly: number;
  monthly: number;
  quarterly: number;
  yearly: number;
}

interface SprintRow {
  count: number;
  amount: number;
}

interface SprintTargets {
  monthly: SprintRow;
  quarterly: SprintRow;
  yearly: SprintRow;
}

interface RevenueTargets {
  monthly: number;
  quarterly: number;
  half_yearly: number;
  yearly: number;
}

const DEFAULT_LEADS: LeadTargets = {
  weekly: 10,
  monthly: 30,
  quarterly: 120,
  yearly: 480,
};

const DEFAULT_SPRINTS: SprintTargets = {
  monthly: { count: 5, amount: 10_000 },
  quarterly: { count: 20, amount: 45_000 },
  yearly: { count: 80, amount: 180_000 },
};

const DEFAULT_REVENUE: RevenueTargets = {
  monthly: 5_000,
  quarterly: 15_000,
  half_yearly: 70_000,
  yearly: 150_000,
};

type FieldErrors = Partial<
  Record<"name" | "email" | "phone" | "password", string>
>;

/**
 * Three-step "Add member to sales" flow for super admins:
 *   1) Rep details — name / email / phone / initial password
 *   2) Set targets — leads, sprint completion, revenue generation
 *   3) Review     — confirm before creating
 *
 * Posts to POST /api/v1/sales/teams/:teamId/reps, which atomically creates the
 * rep, all three target groups, and dispatches the welcome email.
 */
export function AddMemberStepperModal({
  open,
  onOpenChange,
  teamId,
  onCreated,
}: AddMemberStepperModalProps) {
  const [step, setStep] = useState<Step>(1);

  // Step 1
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");

  // Step 2
  const [leads, setLeads] = useState<LeadTargets>(DEFAULT_LEADS);
  const [sprints, setSprints] = useState<SprintTargets>(DEFAULT_SPRINTS);
  const [revenue, setRevenue] = useState<RevenueTargets>(DEFAULT_REVENUE);
  const [targetTab, setTargetTab] = useState<TargetTab>("leads");

  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [done, setDone] = useState<{ email: string; password: string } | null>(
    null,
  );

  const mutations = useSubadminMutations();

  const setFieldError = (field: keyof FieldErrors, message: string) =>
    setFieldErrors((prev) => ({ ...prev, [field]: message }));
  const clearFieldError = (field: keyof FieldErrors) =>
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });

  const reset = () => {
    setStep(1);
    setName("");
    setEmail("");
    setPhone("");
    setPassword("");
    setLeads(DEFAULT_LEADS);
    setSprints(DEFAULT_SPRINTS);
    setRevenue(DEFAULT_REVENUE);
    setTargetTab("leads");
    setSubmitting(false);
    setFieldErrors({});
    setDone(null);
  };

  const handleClose = (next: boolean) => {
    onOpenChange(next);
    if (!next) window.setTimeout(reset, 200);
  };

  const step1Valid =
    name.trim().length > 0 &&
    email.trim().length > 0 &&
    phone.trim().length > 0 &&
    password.length > 0;

  const handleContinue = () => {
    if (step === 1) {
      if (!step1Valid) {
        toast.error("Fill out every rep detail.");
        return;
      }
      if (password.length < 8) {
        toast.error("Initial password must be at least 8 characters.");
        return;
      }
      setStep(2);
      return;
    }
    if (step === 2) {
      setStep(3);
      return;
    }
  };

  const handleCreate = async () => {
    setSubmitting(true);
    setFieldErrors({});
    try {
      const result = await mutations.createRepWithTargets(teamId, {
        rep: {
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          password,
        },
        targets: { leads, sprints, revenue },
        send_welcome_email: true,
      });

      // Always reveal the password in-app — email is the convenience path,
      // the reveal card is the fallback.
      setDone({ email: result.user.email, password });

      if (result.email.sent) {
        toast.success(`Welcome email sent to ${result.email.to}`);
      } else {
        toast.warning(
          "Couldn't send welcome email — share credentials manually.",
        );
      }
      onCreated?.();
    } catch (err) {
      handleCreateError(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateError = (err: unknown) => {
    if (!(err instanceof ApiError)) {
      toast.error("Couldn't add member", { description: errorMessage(err) });
      return;
    }

    if (err.status === 409 && err.code === "EMAIL_TAKEN") {
      setStep(1);
      setFieldError("email", "This email is already registered.");
      toast.error("Email already in use");
      return;
    }
    if (err.status === 409 && err.code === "PHONE_TAKEN") {
      setStep(1);
      setFieldError("phone", "This phone number is already registered.");
      toast.error("Phone already in use");
      return;
    }

    if (err.status === 400 && err.code === "VALIDATION_ERROR") {
      const errors = extractValidationErrors(err.body);
      const repErrors: FieldErrors = {};
      const targetMessages: string[] = [];
      for (const { field, message } of errors) {
        if (field === "rep.name") repErrors.name = message;
        else if (field === "rep.email") repErrors.email = message;
        else if (field === "rep.phone") repErrors.phone = message;
        else if (field === "rep.password") repErrors.password = message;
        else targetMessages.push(`${field}: ${message}`);
      }
      if (Object.keys(repErrors).length > 0) {
        setFieldErrors(repErrors);
        setStep(1);
        toast.error("Fix the highlighted fields");
        return;
      }
      if (targetMessages.length > 0) {
        setStep(2);
        toast.error("Some targets are invalid", {
          description: targetMessages.join("\n"),
        });
        return;
      }
    }

    toast.error("Couldn't add member", { description: err.message });
  };

  if (done) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-lg">
          <DialogTitle>Member added</DialogTitle>
          <p className="text-sm text-zinc-500">
            Share these credentials with the new member. The password won't be
            shown again.
          </p>
          <PasswordRevealCard
            heading={`${teamId} — New member`}
            email={done.email}
            password={done.password}
          />
          <div className="flex justify-end">
            <Button onClick={() => handleClose(false)}>Done</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto p-0">
        <div className="flex flex-col gap-6 p-6 sm:p-8">
          <header>
            <DialogTitle className="text-xl font-bold">
              Add member to {teamId}
            </DialogTitle>
            <p className="mt-1 text-xs text-zinc-500">Step {step} of 3</p>
          </header>

          <Stepper step={step} />

          {step === 1 ? (
            <RepDetailsStep
              name={name}
              email={email}
              phone={phone}
              password={password}
              errors={fieldErrors}
              onName={(v) => {
                setName(v);
                clearFieldError("name");
              }}
              onEmail={(v) => {
                setEmail(v);
                clearFieldError("email");
              }}
              onPhone={(v) => {
                setPhone(v);
                clearFieldError("phone");
              }}
              onPassword={(v) => {
                setPassword(v);
                clearFieldError("password");
              }}
            />
          ) : null}

          {step === 2 ? (
            <SetTargetsStep
              tab={targetTab}
              onTab={setTargetTab}
              leads={leads}
              onLeads={setLeads}
              sprints={sprints}
              onSprints={setSprints}
              revenue={revenue}
              onRevenue={setRevenue}
            />
          ) : null}

          {step === 3 ? (
            <ReviewStep
              name={name}
              email={email}
              phone={phone}
              leads={leads}
              sprints={sprints}
              revenue={revenue}
            />
          ) : null}

          <footer className="flex items-center justify-between border-t border-zinc-200 pt-5 dark:border-zinc-800">
            {step === 1 ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => handleClose(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep((s) => (s === 3 ? 2 : 1))}
                disabled={submitting}
              >
                Back
              </Button>
            )}

            {step < 3 ? (
              <Button type="button" onClick={handleContinue}>
                Continue
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleCreate}
                disabled={submitting}
                className="gap-1.5"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <UserPlus className="h-4 w-4" aria-hidden />
                )}
                Create rep
              </Button>
            )}
          </footer>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Stepper ---------------------------------------------------------

function Stepper({ step }: { step: Step }) {
  const items: { key: Step; label: string; icon: typeof User }[] = [
    { key: 1, label: "Rep details", icon: User },
    { key: 2, label: "Set targets", icon: Target },
    { key: 3, label: "Review", icon: CircleCheck },
  ];
  return (
    <div className="flex items-center gap-2">
      {items.map((item, idx) => {
        const done = step > item.key;
        const active = step === item.key;
        const Icon = done ? Check : item.icon;
        return (
          <div key={item.key} className="flex flex-1 items-center gap-2">
            <div className="flex items-center gap-2">
              <span
                aria-hidden
                className={cn(
                  "grid h-9 w-9 shrink-0 place-items-center rounded-lg border transition-colors",
                  active &&
                    "border-indigo-500 bg-indigo-50 text-indigo-600 ring-2 ring-indigo-500/30 dark:bg-indigo-950/40 dark:text-indigo-300",
                  done &&
                    "border-emerald-500 bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300",
                  !active &&
                    !done &&
                    "border-zinc-200 bg-zinc-50 text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900",
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span
                className={cn(
                  "text-sm font-semibold",
                  active && "text-zinc-900 dark:text-zinc-50",
                  done && "text-emerald-600 dark:text-emerald-400",
                  !active && !done && "text-zinc-400",
                )}
              >
                {item.label}
              </span>
            </div>
            {idx < items.length - 1 ? (
              <span
                aria-hidden
                className={cn(
                  "h-px flex-1 rounded-full",
                  step > item.key
                    ? "bg-emerald-400"
                    : "bg-zinc-200 dark:bg-zinc-800",
                )}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

// ---------- Step 1: Rep details --------------------------------------------

function RepDetailsStep({
  name,
  email,
  phone,
  password,
  errors,
  onName,
  onEmail,
  onPhone,
  onPassword,
}: {
  name: string;
  email: string;
  phone: string;
  password: string;
  errors: FieldErrors;
  onName: (v: string) => void;
  onEmail: (v: string) => void;
  onPhone: (v: string) => void;
  onPassword: (v: string) => void;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Rep details</h3>
        <p className="mt-1 text-sm text-zinc-500">
          Members can view their own performance and manage their own leads,
          but can't create or edit other users.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <IconField id="m-name" label="Full name" icon={User} error={errors.name}>
          <Input
            id="m-name"
            value={name}
            onChange={(e) => onName(e.target.value)}
            placeholder="e.g. Arjun Mehta"
            className={cn("pl-9", errors.name && fieldErrorClass)}
            aria-invalid={errors.name ? true : undefined}
            autoFocus
          />
        </IconField>
        <IconField id="m-email" label="Email" icon={Mail} error={errors.email}>
          <Input
            id="m-email"
            type="email"
            value={email}
            onChange={(e) => onEmail(e.target.value)}
            placeholder="arjun@nyra.ai"
            className={cn("pl-9", errors.email && fieldErrorClass)}
            aria-invalid={errors.email ? true : undefined}
          />
        </IconField>
        <IconField id="m-phone" label="Phone" icon={Phone} error={errors.phone}>
          <Input
            id="m-phone"
            type="tel"
            value={phone}
            onChange={(e) => onPhone(e.target.value)}
            placeholder="9876543210"
            className={cn("pl-9", errors.phone && fieldErrorClass)}
            aria-invalid={errors.phone ? true : undefined}
          />
        </IconField>
        <IconField
          id="m-pw"
          label="Initial password"
          icon={Lock}
          hint="Min 8 chars · shown once"
          error={errors.password}
        >
          <Input
            id="m-pw"
            type="text"
            value={password}
            onChange={(e) => onPassword(e.target.value)}
            placeholder="••••••••"
            className={cn("pl-9 font-mono", errors.password && fieldErrorClass)}
            aria-invalid={errors.password ? true : undefined}
          />
        </IconField>
      </div>
    </section>
  );
}

const fieldErrorClass =
  "border-red-500 focus-visible:ring-red-500/30 dark:border-red-500";

function IconField({
  id,
  label,
  icon: Icon,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  icon: typeof User;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label
        htmlFor={id}
        className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500"
      >
        {label}
      </Label>
      <div className="relative">
        <Icon
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400"
        />
        {children}
      </div>
      {error ? (
        <p className="text-[11px] font-medium text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-[11px] text-zinc-500">{hint}</p>
      ) : null}
    </div>
  );
}

// ---------- Step 2: Set targets --------------------------------------------

function SetTargetsStep({
  tab,
  onTab,
  leads,
  onLeads,
  sprints,
  onSprints,
  revenue,
  onRevenue,
}: {
  tab: TargetTab;
  onTab: (t: TargetTab) => void;
  leads: LeadTargets;
  onLeads: (next: LeadTargets) => void;
  sprints: SprintTargets;
  onSprints: (next: SprintTargets) => void;
  revenue: RevenueTargets;
  onRevenue: (next: RevenueTargets) => void;
}) {
  const TABS: {
    key: TargetTab;
    label: string;
    icon: typeof Users;
    accent: string;
    underline: string;
  }[] = [
    {
      key: "leads",
      label: "Leads",
      icon: Users,
      accent: "text-sky-500",
      underline: "bg-sky-500",
    },
    {
      key: "sprint",
      label: "Sprint completion",
      icon: Activity,
      accent: "text-amber-500",
      underline: "bg-amber-500",
    },
    {
      key: "revenue",
      label: "Revenue generation",
      icon: IndianRupee,
      accent: "text-emerald-500",
      underline: "bg-emerald-500",
    },
  ];

  return (
    <section className="space-y-5">
      <div className="flex items-center gap-2">
        <Sparkles
          className="h-5 w-5 text-violet-500"
          aria-hidden
        />
        <h3 className="text-lg font-semibold">Set targets for</h3>
      </div>
      <p className="-mt-3 text-sm text-zinc-500">
        Default values are pre-filled. Adjust any target to match this rep's
        expectations.
      </p>

      <div className="grid grid-cols-3 rounded-lg border border-zinc-200 bg-zinc-50/60 p-1 dark:border-zinc-800 dark:bg-zinc-900/40">
        {TABS.map((t) => {
          const active = tab === t.key;
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => onTab(t.key)}
              className={cn(
                "relative inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active
                  ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-zinc-50"
                  : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200",
              )}
            >
              <Icon
                className={cn("h-3.5 w-3.5", active ? t.accent : "")}
                aria-hidden
              />
              {t.label}
              {active ? (
                <span
                  aria-hidden
                  className={cn(
                    "absolute inset-x-3 -bottom-px h-0.5 rounded-full",
                    t.underline,
                  )}
                />
              ) : null}
            </button>
          );
        })}
      </div>

      {tab === "leads" ? (
        <LeadsPanel value={leads} onChange={onLeads} />
      ) : tab === "sprint" ? (
        <SprintPanel value={sprints} onChange={onSprints} />
      ) : (
        <RevenuePanel value={revenue} onChange={onRevenue} />
      )}
    </section>
  );
}

function PanelBanner({
  icon: Icon,
  title,
  subtitle,
  tone,
}: {
  icon: typeof Users;
  title: string;
  subtitle: string;
  tone: "sky" | "amber" | "emerald";
}) {
  const toneClass = {
    sky: "border-sky-200/70 bg-sky-50 text-sky-700 dark:border-sky-900/40 dark:bg-sky-950/30 dark:text-sky-200",
    amber:
      "border-amber-200/70 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200",
    emerald:
      "border-emerald-200/70 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200",
  }[tone];

  return (
    <div className={cn("flex items-start gap-3 rounded-lg border p-4", toneClass)}>
      <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
      <div>
        <div className="text-sm font-semibold">{title}</div>
        <div className="mt-0.5 text-xs opacity-80">{subtitle}</div>
      </div>
    </div>
  );
}

function LeadsPanel({
  value,
  onChange,
}: {
  value: LeadTargets;
  onChange: (next: LeadTargets) => void;
}) {
  const setField = <K extends keyof LeadTargets>(k: K, raw: string) => {
    const n = Math.max(0, Number(raw) || 0);
    const next = { ...value, [k]: n };
    // Match the helper tip: changing monthly auto-suggests quarterly = monthly*4
    if (k === "monthly") next.quarterly = n * 4;
    onChange(next);
  };

  const rows: { key: keyof LeadTargets; label: string }[] = [
    { key: "weekly", label: "Weekly" },
    { key: "monthly", label: "Monthly" },
    { key: "quarterly", label: "Quarterly" },
    { key: "yearly", label: "Yearly" },
  ];

  return (
    <div className="space-y-4">
      <PanelBanner
        icon={Users}
        tone="sky"
        title="Lead generation targets"
        subtitle="Number of new leads the rep should generate per period"
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {rows.map((r) => (
          <TargetBox
            key={r.key}
            label={r.label}
            suffix="leads"
            value={value[r.key]}
            onChange={(raw) => setField(r.key, raw)}
          />
        ))}
      </div>
      <p className="flex items-center gap-1.5 text-xs text-zinc-500">
        <Zap className="h-3.5 w-3.5 text-violet-500" aria-hidden />
        Tip: Quarterly is auto-suggested as monthly × 4 when you change monthly
      </p>
    </div>
  );
}

function SprintPanel({
  value,
  onChange,
}: {
  value: SprintTargets;
  onChange: (next: SprintTargets) => void;
}) {
  const rows: { key: keyof SprintTargets; label: string }[] = [
    { key: "monthly", label: "Monthly" },
    { key: "quarterly", label: "Quarterly" },
    { key: "yearly", label: "Yearly" },
  ];

  const setCount = (k: keyof SprintTargets, raw: string) => {
    onChange({
      ...value,
      [k]: { ...value[k], count: Math.max(0, Number(raw) || 0) },
    });
  };
  const setAmount = (k: keyof SprintTargets, raw: string) => {
    onChange({
      ...value,
      [k]: { ...value[k], amount: Math.max(0, Number(raw) || 0) },
    });
  };

  return (
    <div className="space-y-4">
      <PanelBanner
        icon={Activity}
        tone="amber"
        title="Sprint completion targets"
        subtitle="Number of sprints to complete and the total sprint deal value"
      />

      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800">
        <div className="grid grid-cols-[1fr_1fr_1fr] items-center gap-3 border-b border-zinc-200 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:border-zinc-800">
          <div />
          <div className="text-center">No. of sprints</div>
          <div className="text-center">Sprint amount (₹)</div>
        </div>
        {rows.map((r, i) => (
          <div
            key={r.key}
            className={cn(
              "grid grid-cols-[1fr_1fr_1fr] items-start gap-3 px-4 py-4",
              i > 0 && "border-t border-zinc-200 dark:border-zinc-800",
            )}
          >
            <div className="self-center text-sm font-medium">{r.label}</div>
            <Input
              type="number"
              min={0}
              value={value[r.key].count}
              onChange={(e) => setCount(r.key, e.target.value)}
              className="text-center tabular-nums"
            />
            <div className="space-y-1">
              <div className="relative">
                <IndianRupee
                  aria-hidden
                  className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400"
                />
                <Input
                  type="number"
                  min={0}
                  value={value[r.key].amount}
                  onChange={(e) => setAmount(r.key, e.target.value)}
                  className="pl-8 text-center tabular-nums"
                />
              </div>
              <div className="text-center text-[10px] text-zinc-500">
                {formatCurrency(value[r.key].amount, "INR")}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RevenuePanel({
  value,
  onChange,
}: {
  value: RevenueTargets;
  onChange: (next: RevenueTargets) => void;
}) {
  const set = <K extends keyof RevenueTargets>(k: K, raw: string) => {
    onChange({ ...value, [k]: Math.max(0, Number(raw) || 0) });
  };
  const rows: { key: keyof RevenueTargets; label: string }[] = [
    { key: "monthly", label: "Monthly" },
    { key: "quarterly", label: "Quarterly" },
    { key: "half_yearly", label: "Half-yearly" },
    { key: "yearly", label: "Yearly" },
  ];

  return (
    <div className="space-y-4">
      <PanelBanner
        icon={IndianRupee}
        tone="emerald"
        title="Revenue generation targets"
        subtitle="Total revenue the rep should generate per period"
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {rows.map((r) => (
          <div
            key={r.key}
            className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                {r.label}
              </span>
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300">
                {formatCurrency(value[r.key], "INR")}
              </span>
            </div>
            <div className="relative mt-2">
              <IndianRupee
                aria-hidden
                className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400"
              />
              <Input
                type="number"
                min={0}
                value={value[r.key]}
                onChange={(e) => set(r.key, e.target.value)}
                className="h-10 pl-9 text-base font-semibold tabular-nums"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TargetBox({
  label,
  suffix,
  value,
  onChange,
}: {
  label: string;
  suffix: string;
  value: number;
  onChange: (raw: string) => void;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        {label}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <Input
          type="number"
          min={0}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 text-center text-base font-semibold tabular-nums"
        />
        <span className="text-xs text-zinc-500">{suffix}</span>
      </div>
    </div>
  );
}

// ---------- Step 3: Review --------------------------------------------------

function ReviewStep({
  name,
  email,
  phone,
  leads,
  sprints,
  revenue,
}: {
  name: string;
  email: string;
  phone: string;
  leads: LeadTargets;
  sprints: SprintTargets;
  revenue: RevenueTargets;
}) {
  return (
    <section className="space-y-5">
      <div>
        <h3 className="text-lg font-semibold">Review &amp; create</h3>
        <p className="mt-1 text-sm text-zinc-500">
          Confirm the details and targets before adding this rep to your team.
        </p>
      </div>

      <div className="flex items-center gap-3 rounded-lg border border-violet-200 bg-violet-50/60 p-4 dark:border-violet-900/40 dark:bg-violet-950/30">
        <div
          aria-hidden
          className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-violet-500 text-base font-bold text-white"
        >
          {initial(name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-semibold">
            {name || "—"}
          </div>
          <div className="truncate text-xs text-zinc-500">{email || "—"}</div>
        </div>
        <div className="text-xs text-zinc-500">{phone || "—"}</div>
      </div>

      <ReviewBlock title="Lead targets" icon={Users} tone="sky">
        <ReviewRow label="Weekly" value={`${leads.weekly} leads`} />
        <ReviewRow label="Monthly" value={`${leads.monthly} leads`} />
        <ReviewRow label="Quarterly" value={`${leads.quarterly} leads`} />
        <ReviewRow label="Yearly" value={`${leads.yearly} leads`} />
      </ReviewBlock>

      <ReviewBlock title="Sprint targets" icon={Activity} tone="amber">
        <ReviewRow
          label="Monthly"
          value={`${sprints.monthly.count} sprints · ${formatCurrency(sprints.monthly.amount, "INR")}`}
        />
        <ReviewRow
          label="Quarterly"
          value={`${sprints.quarterly.count} sprints · ${formatCurrency(sprints.quarterly.amount, "INR")}`}
        />
        <ReviewRow
          label="Yearly"
          value={`${sprints.yearly.count} sprints · ${formatCurrency(sprints.yearly.amount, "INR")}`}
        />
      </ReviewBlock>

      <ReviewBlock title="Revenue targets" icon={IndianRupee} tone="emerald">
        <ReviewRow label="Monthly" value={formatCurrency(revenue.monthly, "INR")} />
        <ReviewRow
          label="Quarterly"
          value={formatCurrency(revenue.quarterly, "INR")}
        />
        <ReviewRow
          label="Half-yearly"
          value={formatCurrency(revenue.half_yearly, "INR")}
        />
        <ReviewRow label="Yearly" value={formatCurrency(revenue.yearly, "INR")} />
      </ReviewBlock>
    </section>
  );
}

function ReviewBlock({
  title,
  icon: Icon,
  tone,
  children,
}: {
  title: string;
  icon: typeof Users;
  tone: "sky" | "amber" | "emerald";
  children: React.ReactNode;
}) {
  const toneClass = {
    sky: "text-sky-600 dark:text-sky-400",
    amber: "text-amber-600 dark:text-amber-400",
    emerald: "text-emerald-600 dark:text-emerald-400",
  }[tone];
  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
      <div className="flex items-center gap-2 border-b border-zinc-200 px-4 py-2.5 dark:border-zinc-800">
        <Icon className={cn("h-4 w-4", toneClass)} aria-hidden />
        <span className={cn("text-sm font-semibold", toneClass)}>{title}</span>
      </div>
      <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
        {children}
      </div>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 text-sm">
      <span className="text-zinc-500">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}

function initial(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  return trimmed[0]!.toUpperCase();
}

function extractValidationErrors(
  body: unknown,
): { field: string; message: string }[] {
  if (!body || typeof body !== "object") return [];
  const errObj = (body as { error?: unknown }).error;
  if (!errObj || typeof errObj !== "object") return [];
  const details = (errObj as { details?: unknown }).details;
  if (!details || typeof details !== "object") return [];
  const errors = (details as { errors?: unknown }).errors;
  if (!Array.isArray(errors)) return [];
  return errors.flatMap((e) => {
    if (!e || typeof e !== "object") return [];
    const field = (e as { field?: unknown }).field;
    const message = (e as { message?: unknown }).message;
    if (typeof field !== "string" || typeof message !== "string") return [];
    return [{ field, message }];
  });
}
