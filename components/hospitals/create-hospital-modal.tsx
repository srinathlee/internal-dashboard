"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  Clock,
  Coins,
  Image as ImageIcon,
  Loader2,
  Plus,
  Settings as SettingsIcon,
  Sparkles,
  Upload,
  UserCog,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
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
import { useAuth } from "@/lib/auth";
import { errorMessage } from "@/lib/hooks/use-async";
import { useHospitalMutations } from "@/lib/hooks/use-hospitals";
import { uploadFile } from "@/lib/api/hospitals";
import { formatCurrency } from "@/lib/format-metric";
import { cn } from "@/lib/utils";
import type { CreateHospitalInput } from "@/lib/api/hospitals";

// ---------- Static option lists ----------

const HOSPITAL_TYPES = [
  { id: "dental", label: "Dental" },
  { id: "eye", label: "Eye" },
  { id: "skin", label: "Skin" },
  { id: "hair", label: "Hair" },
];

interface PlanCard {
  id: string;
  name: string;
  prices: Partial<Record<Commitment, number>>;
  bestValueAt?: Commitment;
  bullets: string[];
}

const PLANS: PlanCard[] = [
  {
    id: "foundation_micro",
    name: "Foundation Micro",
    prices: { monthly: 3500 },
    bullets: ["Up to 300 appointments per month", "Up to 1 branches"],
  },
  {
    id: "mini",
    name: "Mini",
    prices: {
      monthly: 1500,
      quarterly: 4500,
      half_yearly: 8000,
      yearly: 15000,
    },
    bestValueAt: "yearly",
    bullets: [
      "Mini plan for less than 150 Appointments",
      "Up to 1 branches",
    ],
  },
  {
    id: "foundation_lite",
    name: "Foundation Lite",
    prices: { monthly: 6500 },
    bullets: ["Up to 600 appointments per month", "Up to 1 branches"],
  },
  {
    id: "foundation_standard",
    name: "Foundation Standard",
    prices: { monthly: 10000 },
    bullets: ["Up to 1000 appointments per month", "Up to 1 branches"],
  },
  {
    id: "foundation_plus",
    name: "Foundation Plus",
    prices: { monthly: 14000 },
    bullets: ["Up to 1500 appointments per month", "Up to 1 branches"],
  },
];

type Commitment = "monthly" | "quarterly" | "half_yearly" | "yearly";

const COMMITMENTS: { id: Commitment; label: string; days: number }[] = [
  { id: "monthly", label: "Monthly", days: 30 },
  { id: "quarterly", label: "Quarterly", days: 90 },
  { id: "half_yearly", label: "Half-yearly", days: 180 },
  { id: "yearly", label: "Yearly", days: 365 },
];

const TIMEZONES = [
  { id: "Asia/Kolkata", label: "Asia/Kolkata (IST)" },
  { id: "Asia/Dubai", label: "Asia/Dubai (GST)" },
  { id: "Asia/Singapore", label: "Asia/Singapore (SGT)" },
  { id: "Europe/London", label: "Europe/London (GMT)" },
  { id: "America/New_York", label: "America/New_York (EST)" },
  { id: "UTC", label: "UTC" },
];

const CURRENCIES = [
  { id: "INR", label: "INR (₹)" },
  { id: "USD", label: "USD ($)" },
  { id: "EUR", label: "EUR (€)" },
  { id: "GBP", label: "GBP (£)" },
  { id: "AED", label: "AED (د.إ)" },
];

interface Language {
  code: string;
  label: string;
}

const LANGUAGES: Language[] = [
  { code: "as-IN", label: "Assamese" },
  { code: "bn-IN", label: "Bengali" },
  { code: "brx-IN", label: "Bodo" },
  { code: "doi-IN", label: "Dogri" },
  { code: "en-IN", label: "English" },
  { code: "gu-IN", label: "Gujarati" },
  { code: "hi-IN", label: "Hindi" },
  { code: "kn-IN", label: "Kannada" },
  { code: "ks-IN", label: "Kashmiri" },
  { code: "kok-IN", label: "Konkani" },
  { code: "mai-IN", label: "Maithili" },
  { code: "ml-IN", label: "Malayalam" },
  { code: "mni-IN", label: "Manipuri" },
  { code: "mr-IN", label: "Marathi" },
  { code: "ne-IN", label: "Nepali" },
  { code: "or-IN", label: "Odia" },
  { code: "pa-IN", label: "Punjabi" },
  { code: "sa-IN", label: "Sanskrit" },
  { code: "sat-IN", label: "Santali" },
  { code: "sd-IN", label: "Sindhi" },
  { code: "ta-IN", label: "Tamil" },
  { code: "te-IN", label: "Telugu" },
  { code: "ur-IN", label: "Urdu" },
];

const DEFAULT_ALLOWED_LANGS = ["en-IN", "hi-IN", "te-IN"];

// ---------- Step / wizard state ----------

type Step = 1 | 2 | 3 | 4;

interface WizardState {
  // Step 1
  name: string;
  location: string;
  address: string;
  phone: string;
  emergencyPhone: string;
  selectedTypes: string[];
  otherTypes: string[];
  otherInput: string;
  createdBy: string;
  imageUrl: string;

  // Step 2
  commitment: Commitment;
  planId: string | null; // null = skipped

  // Step 3
  timezone: string;
  currency: string;
  preferredLang: string;
  allowAllLangs: boolean;
  allowedLangs: string[];
  localizedNames: Record<string, string>;

  // Step 4
  adminName: string;
  adminEmail: string;
  adminPassword: string;
  adminPhone: string;
}

function initialState(createdBy: string): WizardState {
  return {
    name: "",
    location: "",
    address: "",
    phone: "",
    emergencyPhone: "",
    selectedTypes: ["dental"],
    otherTypes: [],
    otherInput: "",
    createdBy,
    imageUrl: "",
    commitment: "yearly",
    planId: null,
    timezone: "Asia/Kolkata",
    currency: "INR",
    preferredLang: "te-IN",
    allowAllLangs: false,
    allowedLangs: DEFAULT_ALLOWED_LANGS,
    localizedNames: {},
    adminName: "",
    adminEmail: "",
    adminPassword: "",
    adminPhone: "",
  };
}

// ---------- Main component ----------

export function CreateHospitalModal({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  /** Called after success with the created hospital name (for the toast). */
  onCreated?: (hospitalName: string) => void;
}) {
  const auth = useAuth();
  const { create } = useHospitalMutations();

  const [state, setState] = useState<WizardState>(() =>
    initialState(auth.user?.name ?? ""),
  );
  const [step, setStep] = useState<Step>(1);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [createdName, setCreatedName] = useState<string | null>(null);

  // Reset on close so re-opening always starts fresh.
  useEffect(() => {
    if (!open) {
      setStep(1);
      setSuccess(false);
      setCreatedName(null);
      setState(initialState(auth.user?.name ?? ""));
    }
  }, [open, auth.user?.name]);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const allTypes = [
        ...state.selectedTypes,
        ...state.otherTypes.map((t) => t.toLowerCase()),
      ];
      const plan = state.planId
        ? { plan_id: state.planId, commitment: state.commitment }
        : null;

      const input: CreateHospitalInput = {
        name: state.name.trim(),
        location: state.location.trim() || null,
        address: state.address.trim() || null,
        phone: state.phone.trim() || null,
        emergency_phone: state.emergencyPhone.trim() || null,
        hospital_type: allTypes,
        created_by: state.createdBy.trim() || null,
        hospital_image_url: state.imageUrl.trim() || null,
        plan,
        settings: {
          timezone: state.timezone,
          currency: state.currency,
          preferred_ai_language: state.preferredLang,
          allowed_ai_languages: state.allowAllLangs
            ? "all"
            : state.allowedLangs,
          localized_names: Object.fromEntries(
            Object.entries(state.localizedNames).filter(
              ([, v]) => v.trim().length > 0,
            ),
          ),
        },
        admin: {
          name: state.adminName.trim(),
          email: state.adminEmail.trim(),
          password: state.adminPassword,
          phone: state.adminPhone.trim(),
        },
      };

      // `hospital_image_url` rides inline on the create body (see
      // CreateHospitalInput), so a single POST handles the image too — no
      // chained PUT needed. PUT /:id/image stays available in the
      // mutations hook for the future Hospital settings surface.
      await create(input);

      setCreatedName(state.name.trim());
      setSuccess(true);
      onCreated?.(state.name.trim());
    } catch (err) {
      toast.error("Couldn't create hospital", {
        description: errorMessage(err),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-hidden p-0 sm:max-w-4xl">
        <DialogTitle className="sr-only">Create hospital</DialogTitle>
        <div className="flex max-h-[92vh] flex-col">
          {/* Header — DialogContent already renders an X close button in the
              top-right corner, so we don't add a secondary close affordance. */}
          <div className="border-b border-zinc-100 px-6 py-5 pr-12 dark:border-zinc-800">
            <h2 className="text-2xl font-semibold tracking-tight">
              Create hospital &amp; admin
            </h2>
            <p className="mt-0.5 text-sm text-zinc-500">
              Step {success ? 4 : step} of 4 ·{" "}
              {success ? "Done" : STEP_META[step].label}
            </p>
          </div>

          {/* Stepper */}
          <div className="border-b border-zinc-100 px-6 py-4 dark:border-zinc-800">
            <Stepper currentStep={step} success={success} />
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {success ? (
              <SuccessPanel
                hospitalName={createdName ?? state.name}
                onCreateAnother={() => {
                  setSuccess(false);
                  setStep(1);
                  setState(initialState(auth.user?.name ?? ""));
                  setCreatedName(null);
                }}
                onClose={() => onOpenChange(false)}
              />
            ) : step === 1 ? (
              <Step1Hospital state={state} setState={setState} />
            ) : step === 2 ? (
              <Step2Plan state={state} setState={setState} />
            ) : step === 3 ? (
              <Step3Settings state={state} setState={setState} />
            ) : (
              <Step4Admin state={state} setState={setState} />
            )}
          </div>

          {/* Footer */}
          {!success ? (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 px-6 py-4 dark:border-zinc-800">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <div className="flex items-center gap-2">
                {step > 1 ? (
                  <Button
                    variant="outline"
                    onClick={() => setStep((s) => (s - 1) as Step)}
                    disabled={submitting}
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Back
                  </Button>
                ) : null}
                {step < 4 ? (
                  <Button
                    onClick={() => {
                      const err = validateStep(step, state);
                      if (err) {
                        toast.error(err);
                        return;
                      }
                      setStep((s) => (s + 1) as Step);
                    }}
                  >
                    Continue
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                ) : (
                  <Button onClick={handleSubmit} disabled={submitting}>
                    {submitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-3.5 w-3.5" />
                    )}
                    Create hospital
                  </Button>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Stepper ----------

const STEP_META: Record<Step, { label: string; short: string }> = {
  1: { label: "Hospital information", short: "Hospital" },
  2: { label: "Subscription plan", short: "Plan" },
  3: { label: "Clinic settings", short: "Settings" },
  4: { label: "Hospital admin", short: "Admin" },
};

function Stepper({
  currentStep,
  success,
}: {
  currentStep: Step;
  success: boolean;
}) {
  const steps: Step[] = [1, 2, 3, 4];
  return (
    <ol className="flex items-center gap-2">
      {steps.map((s, i) => {
        const done = success ? true : s < currentStep;
        const active = !success && s === currentStep;
        return (
          <li key={s} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                "grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] font-semibold transition-colors",
                done
                  ? "bg-emerald-500 text-white"
                  : active
                    ? "bg-violet-500 text-white"
                    : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
              )}
            >
              {done ? <Check className="h-3 w-3" aria-hidden /> : s}
            </span>
            <span
              className={cn(
                "whitespace-nowrap text-xs font-medium",
                active
                  ? "text-zinc-900 dark:text-zinc-50"
                  : "text-zinc-500",
              )}
            >
              {STEP_META[s].short}
            </span>
            {i < steps.length - 1 ? (
              <span
                aria-hidden
                className={cn(
                  "h-px flex-1",
                  done ? "bg-emerald-300" : "bg-zinc-200 dark:bg-zinc-800",
                )}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

// ---------- Validation ----------

function validateStep(step: Step, s: WizardState): string | null {
  if (step === 1) {
    if (!s.name.trim()) return "Hospital name is required.";
    if (s.selectedTypes.length + s.otherTypes.length === 0) {
      return "Pick at least one hospital type.";
    }
  }
  if (step === 3) {
    if (!s.allowAllLangs && s.allowedLangs.length === 0) {
      return "Allow at least one AI language, or enable no restriction.";
    }
  }
  return null;
}

// ---------- Step 1 — Hospital info ----------

function Step1Hospital({
  state,
  setState,
}: {
  state: WizardState;
  setState: React.Dispatch<React.SetStateAction<WizardState>>;
}) {
  const toggleType = (id: string) => {
    setState((s) => ({
      ...s,
      selectedTypes: s.selectedTypes.includes(id)
        ? s.selectedTypes.filter((t) => t !== id)
        : [...s.selectedTypes, id],
    }));
  };

  const addOther = () => {
    const v = state.otherInput.trim();
    if (!v) return;
    setState((s) => ({
      ...s,
      otherTypes: [...s.otherTypes, v],
      otherInput: "",
    }));
  };

  return (
    <Card className="border-0 p-0 shadow-none">
      <SectionHeader
        icon={Building2}
        title="Hospital information"
        subtitle="Hospital name is required; other fields are optional."
        tone="violet"
      />

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Hospital name" required>
          <Input
            value={state.name}
            onChange={(e) =>
              setState((s) => ({ ...s, name: e.target.value }))
            }
            placeholder="e.g. Apollo Family Medical"
          />
        </Field>
        <Field label="Location">
          <Input
            value={state.location}
            onChange={(e) =>
              setState((s) => ({ ...s, location: e.target.value }))
            }
            placeholder="Search for a location…"
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Address">
            <Input
              value={state.address}
              onChange={(e) =>
                setState((s) => ({ ...s, address: e.target.value }))
              }
              placeholder="Street, area, city"
            />
          </Field>
        </div>
        <Field label="Phone">
          <Input
            inputMode="numeric"
            value={state.phone}
            onChange={(e) =>
              setState((s) => ({ ...s, phone: e.target.value }))
            }
            placeholder="10-digit number"
          />
        </Field>
        <Field label="Emergency phone">
          <Input
            inputMode="numeric"
            value={state.emergencyPhone}
            onChange={(e) =>
              setState((s) => ({ ...s, emergencyPhone: e.target.value }))
            }
            placeholder="10-digit emergency number"
          />
        </Field>
      </div>

      <div className="mt-5 space-y-2">
        <Label className="text-sm font-medium">
          Hospital type <span className="text-rose-500">*</span>
        </Label>
        <div className="flex flex-wrap gap-2">
          {HOSPITAL_TYPES.map((t) => {
            const active = state.selectedTypes.includes(t.id);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => toggleType(t.id)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm transition-colors",
                  active
                    ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                    : "border-zinc-200 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900",
                )}
                aria-pressed={active}
              >
                {active ? <Check className="h-3 w-3" aria-hidden /> : null}
                {t.label}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-xs text-zinc-500">Other:</span>
          <Input
            value={state.otherInput}
            onChange={(e) =>
              setState((s) => ({ ...s, otherInput: e.target.value }))
            }
            placeholder="e.g. physiotherapy"
            className="h-8 max-w-xs text-xs"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addOther();
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addOther}
            disabled={!state.otherInput.trim()}
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </Button>
        </div>
        {state.otherTypes.length > 0 ? (
          <div className="flex flex-wrap gap-2 pt-1">
            {state.otherTypes.map((t, i) => (
              <span
                key={`${t}-${i}`}
                className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2 py-1 text-xs dark:border-zinc-800"
              >
                {t}
                <button
                  type="button"
                  onClick={() =>
                    setState((s) => ({
                      ...s,
                      otherTypes: s.otherTypes.filter((_, j) => j !== i),
                    }))
                  }
                  className="text-zinc-400 hover:text-rose-600"
                  aria-label={`Remove ${t}`}
                >
                  <X className="h-3 w-3" aria-hidden />
                </button>
              </span>
            ))}
          </div>
        ) : null}
        <p className="text-xs text-zinc-500">
          Pick one or more. Controls which body-chart tabs (Teeth / Eye /
          Skin / Hair) appear on invoices and medical sheets.
        </p>
      </div>

      <div className="mt-5">
        <Field label="Created by">
          <Input
            value={state.createdBy}
            onChange={(e) =>
              setState((s) => ({ ...s, createdBy: e.target.value }))
            }
          />
        </Field>
      </div>

      <HospitalImageField
        imageUrl={state.imageUrl}
        onChange={(url) => setState((s) => ({ ...s, imageUrl: url }))}
      />
    </Card>
  );
}

// ---------- Step 2 — Plan ----------

function Step2Plan({
  state,
  setState,
}: {
  state: WizardState;
  setState: React.Dispatch<React.SetStateAction<WizardState>>;
}) {
  return (
    <Card className="border-0 p-0 shadow-none">
      <SectionHeader
        icon={Sparkles}
        title="Subscription plan"
        subtitle="Choose a plan now or skip and assign later."
        tone="violet"
        suffix={
          <span className="text-xs text-zinc-500">(Optional)</span>
        }
      />

      <Card className="mt-5 border-violet-200 bg-violet-50/40 p-3 text-xs text-zinc-700 dark:border-violet-900/40 dark:bg-violet-950/20 dark:text-zinc-300">
        Choose a plan for this hospital. You can skip this and assign a plan
        later. All plans include Nyra AI voice assistant capabilities.
      </Card>

      <div className="mt-5 flex justify-center">
        <div className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-950">
          {COMMITMENTS.map((c) => {
            const active = c.id === state.commitment;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() =>
                  setState((s) => ({ ...s, commitment: c.id }))
                }
                aria-pressed={active}
                className={cn(
                  "flex flex-col items-center rounded-md px-3 py-1 text-xs font-medium transition-colors",
                  active
                    ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
                    : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50",
                )}
              >
                <span>{c.label}</span>
                <span className="text-[9px] text-zinc-500">{c.days} days</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {PLANS.map((p) => {
          const price = p.prices[state.commitment];
          const active = state.planId === p.id;
          const isBestValue = p.bestValueAt === state.commitment;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() =>
                setState((s) => ({ ...s, planId: p.id }))
              }
              className={cn(
                "relative rounded-lg border-2 p-4 text-left transition-colors",
                active
                  ? "border-violet-500 bg-violet-50/40 dark:bg-violet-950/20"
                  : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700",
                price === undefined && "opacity-50",
              )}
              disabled={price === undefined}
            >
              {isBestValue ? (
                <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-violet-500 px-2 py-0.5 text-[9px] font-semibold text-white">
                  BEST VALUE
                </span>
              ) : null}
              <div className="flex items-center gap-1.5 text-sm font-semibold">
                <Sparkles className="h-3.5 w-3.5 text-violet-500" aria-hidden />
                {p.name}
              </div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-xl font-bold tabular-nums">
                  {price !== undefined
                    ? formatCurrency(price, "INR")
                    : "—"}
                </span>
                <span className="text-xs text-zinc-500">/mo</span>
              </div>
              <ul className="mt-3 space-y-1 text-xs text-zinc-600 dark:text-zinc-400">
                {p.bullets.map((b, i) => (
                  <li key={i} className="flex items-start gap-1">
                    <Check
                      className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500"
                      aria-hidden
                    />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
              <div
                className={cn(
                  "mt-3 inline-flex items-center justify-center rounded-md border px-2 py-1 text-xs font-medium",
                  active
                    ? "border-violet-500 bg-violet-500 text-white"
                    : "border-zinc-200 text-zinc-700 dark:border-zinc-800 dark:text-zinc-300",
                )}
              >
                {active ? "Selected" : "Select plan"}
              </div>
            </button>
          );
        })}

        {/* Skip card */}
        <button
          type="button"
          onClick={() => setState((s) => ({ ...s, planId: null }))}
          className={cn(
            "rounded-lg border-2 border-dashed p-4 text-left transition-colors",
            state.planId === null
              ? "border-violet-500 bg-violet-50/40 dark:bg-violet-950/20"
              : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700",
          )}
        >
          <div className="flex items-center gap-1.5 text-sm font-semibold">
            <Clock className="h-3.5 w-3.5 text-zinc-500" aria-hidden />
            Skip for now
          </div>
          <p className="mt-2 text-xs text-zinc-500">
            Assign a plan later from hospital settings.
          </p>
          <div
            className={cn(
              "mt-3 inline-flex items-center justify-center rounded-md border px-2 py-1 text-xs font-medium",
              state.planId === null
                ? "border-violet-500 bg-violet-500 text-white"
                : "border-zinc-200 text-zinc-700 dark:border-zinc-800 dark:text-zinc-300",
            )}
          >
            {state.planId === null ? "Selected" : "Skip"}
          </div>
        </button>
      </div>
    </Card>
  );
}

// ---------- Step 3 — Settings ----------

function Step3Settings({
  state,
  setState,
}: {
  state: WizardState;
  setState: React.Dispatch<React.SetStateAction<WizardState>>;
}) {
  const toggleLang = (code: string) => {
    setState((s) => ({
      ...s,
      allowAllLangs: false,
      allowedLangs: s.allowedLangs.includes(code)
        ? s.allowedLangs.filter((c) => c !== code)
        : [...s.allowedLangs, code],
    }));
  };

  // Languages eligible for a localised hospital name = selected non-English.
  const nameableLangs = useMemo(() => {
    const codes = state.allowAllLangs
      ? LANGUAGES.map((l) => l.code)
      : state.allowedLangs;
    return LANGUAGES.filter(
      (l) => codes.includes(l.code) && l.code !== "en-IN",
    );
  }, [state.allowAllLangs, state.allowedLangs]);

  return (
    <Card className="border-0 p-0 shadow-none">
      <SectionHeader
        icon={SettingsIcon}
        title="Clinic general settings"
        subtitle="Optional display and locale settings (timezone, currency, preferred AI language, hospital type)."
        tone="amber"
      />

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Timezone">
          <Select
            value={state.timezone}
            onValueChange={(v) =>
              setState((s) => ({ ...s, timezone: v }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIMEZONES.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Currency">
          <Select
            value={state.currency}
            onValueChange={(v) =>
              setState((s) => ({ ...s, currency: v }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div className="mt-4">
        <Field label="Preferred AI language">
          <Select
            value={state.preferredLang}
            onValueChange={(v) =>
              setState((s) => ({ ...s, preferredLang: v }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((l) => (
                <SelectItem key={l.code} value={l.code}>
                  {l.label} ({l.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div className="mt-5 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label className="text-sm font-medium">Allowed AI languages</Label>
          <span className="rounded-md bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">
            {state.allowAllLangs
              ? `All ${LANGUAGES.length}`
              : `${state.allowedLangs.length} selected`}
          </span>
        </div>
        <p className="text-xs text-zinc-500">
          Languages the AI agent may speak during calls. Defaults to Telugu,
          Hindi &amp; English.
        </p>
        <label className="flex cursor-pointer items-center gap-2 rounded-md border border-zinc-200 p-3 text-sm dark:border-zinc-800">
          <input
            type="checkbox"
            checked={state.allowAllLangs}
            onChange={(e) =>
              setState((s) => ({ ...s, allowAllLangs: e.target.checked }))
            }
          />
          No restriction — allow all {LANGUAGES.length} languages
        </label>

        <div className={cn("flex flex-wrap gap-2", state.allowAllLangs && "opacity-40 pointer-events-none")}>
          {LANGUAGES.map((l) => {
            const active = state.allowedLangs.includes(l.code);
            return (
              <button
                key={l.code}
                type="button"
                onClick={() => toggleLang(l.code)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs transition-colors",
                  active
                    ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                    : "border-zinc-200 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900",
                )}
                aria-pressed={active}
              >
                {active ? <Check className="h-3 w-3" aria-hidden /> : null}
                {l.label}
                <span className="ml-1 text-[10px] opacity-60">{l.code}</span>
              </button>
            );
          })}
        </div>
      </div>

      {nameableLangs.length > 0 ? (
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {nameableLangs.map((l) => (
            <Field key={l.code} label={`Name (${l.label})`}>
              <Input
                value={state.localizedNames[l.code] ?? ""}
                onChange={(e) =>
                  setState((s) => ({
                    ...s,
                    localizedNames: {
                      ...s.localizedNames,
                      [l.code]: e.target.value,
                    },
                  }))
                }
                placeholder={`Hospital name in ${l.label}`}
              />
            </Field>
          ))}
        </div>
      ) : null}
    </Card>
  );
}

// ---------- Step 4 — Admin + review ----------

function Step4Admin({
  state,
  setState,
}: {
  state: WizardState;
  setState: React.Dispatch<React.SetStateAction<WizardState>>;
}) {
  const planMeta = useMemo(() => {
    if (!state.planId) return "Skip — assign later";
    const p = PLANS.find((x) => x.id === state.planId);
    if (!p) return "—";
    const c = COMMITMENTS.find((x) => x.id === state.commitment);
    const price = p.prices[state.commitment];
    return `${p.name} · ${c?.label ?? state.commitment} · ${
      price !== undefined ? `${formatCurrency(price, "INR")}/mo` : "—"
    }`;
  }, [state.planId, state.commitment]);

  const tzLabel =
    TIMEZONES.find((t) => t.id === state.timezone)?.label ?? state.timezone;
  const currencyLabel =
    CURRENCIES.find((c) => c.id === state.currency)?.label ?? state.currency;
  const preferredLangLabel =
    LANGUAGES.find((l) => l.code === state.preferredLang)?.label ??
    state.preferredLang;
  const allowedLabel = state.allowAllLangs
    ? `All ${LANGUAGES.length}`
    : state.allowedLangs
        .map((c) => LANGUAGES.find((l) => l.code === c)?.label ?? c)
        .join(", ");
  const typesLabel = [
    ...state.selectedTypes.map(
      (id) =>
        HOSPITAL_TYPES.find((t) => t.id === id)?.label ??
        id.charAt(0).toUpperCase() + id.slice(1),
    ),
    ...state.otherTypes,
  ].join(", ");

  return (
    <Card className="border-0 p-0 shadow-none">
      <SectionHeader
        icon={UserCog}
        title="Hospital admin"
        subtitle="A Hospital Admin must be created for this hospital. The admin can then create branch admins and other users."
        tone="violet"
        required
      />

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Admin name" required>
          <Input
            value={state.adminName}
            onChange={(e) =>
              setState((s) => ({ ...s, adminName: e.target.value }))
            }
            placeholder="Full name"
          />
        </Field>
        <Field label="Admin email" required>
          <Input
            type="email"
            value={state.adminEmail}
            onChange={(e) =>
              setState((s) => ({ ...s, adminEmail: e.target.value }))
            }
            placeholder="admin@hospital.com"
          />
        </Field>
        <Field label="Admin password" required>
          <Input
            type="password"
            value={state.adminPassword}
            onChange={(e) =>
              setState((s) => ({ ...s, adminPassword: e.target.value }))
            }
            placeholder="Min 8 characters"
            autoComplete="new-password"
          />
        </Field>
        <Field label="Admin phone" required>
          <Input
            inputMode="numeric"
            value={state.adminPhone}
            onChange={(e) =>
              setState((s) => ({ ...s, adminPhone: e.target.value }))
            }
            placeholder="10-digit admin number"
          />
        </Field>
      </div>

      <Card className="mt-5 border-violet-100 bg-zinc-50/60 p-4 dark:border-violet-900/40 dark:bg-zinc-900/40">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-violet-700 dark:text-violet-300">
          Review before creating
        </div>
        <dl className="mt-3 space-y-2 text-sm">
          <ReviewRow label="Hospital name" value={state.name || "—"} />
          <ReviewRow label="Hospital type" value={typesLabel || "—"} />
          <ReviewRow label="Created by" value={state.createdBy || "—"} />
          <ReviewRow label="Plan" value={planMeta} />
          <ReviewRow label="Timezone" value={tzLabel} />
          <ReviewRow label="Currency" value={currencyLabel} />
          <ReviewRow label="Preferred AI language" value={preferredLangLabel} />
          <ReviewRow label="Allowed languages" value={allowedLabel} />
        </dl>
      </Card>
    </Card>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-t border-zinc-100 pt-2 first:border-t-0 first:pt-0 dark:border-zinc-800">
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd className="max-w-[60%] truncate text-right text-sm font-medium">
        {value}
      </dd>
    </div>
  );
}

// ---------- Success ----------

function SuccessPanel({
  hospitalName,
  onCreateAnother,
  onClose,
}: {
  hospitalName: string;
  onCreateAnother: () => void;
  onClose: () => void;
}) {
  return (
    <div className="grid place-items-center py-10 text-center">
      <span
        aria-hidden
        className="grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
      >
        <Check className="h-6 w-6" />
      </span>
      <h3 className="mt-4 text-xl font-semibold">Hospital created</h3>
      <p className="mt-1 max-w-md text-sm text-zinc-500">
        <span className="font-medium text-zinc-700 dark:text-zinc-300">
          {hospitalName}
        </span>{" "}
        is ready. Admin credentials sent via email.
      </p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        <Button variant="outline" onClick={onCreateAnother}>
          Create another
        </Button>
        <Button onClick={onClose}>
          View hospitals
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ---------- Hospital image field ----------

// Backend's /api/upload accepts up to 20 MB and many file types; for the
// hospital image we restrict to common image types and keep the size cap
// generous but sane. The 8 MB local cap rejects oversized files before
// they hit the network — faster feedback than waiting for a 413.
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
];

function HospitalImageField({
  imageUrl,
  onChange,
}: {
  imageUrl: string;
  onChange: (url: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  // Local object-URL for instant preview while the upload is in flight.
  // Cleaned up after the upload resolves so we don't leak the blob.
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handlePick = () => {
    fileInputRef.current?.click();
  };

  const handleFile = async (file: File) => {
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      toast.error("Unsupported image type", {
        description: "Use PNG, JPEG, WebP, or GIF.",
      });
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error("Image too large", {
        description: `Keep it under ${Math.round(MAX_IMAGE_BYTES / (1024 * 1024))} MB.`,
      });
      return;
    }

    // Local preview first so the field shows the image immediately while
    // the bytes travel to the backend.
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setUploading(true);
    try {
      // `org-assets` is the documented folder for hospital images, team
      // logos, and banners — see the backend upload spec.
      const { url } = await uploadFile(file, "org-assets");
      onChange(url);
      toast.success("Image uploaded");
    } catch (err) {
      toast.error("Upload failed", { description: errorMessage(err) });
      setPreviewUrl(null);
    } finally {
      setUploading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
    // Reset so picking the same file twice still fires onChange.
    e.target.value = "";
  };

  // Preview source priority: in-flight object URL > stored remote URL > empty.
  const previewSrc = previewUrl ?? (imageUrl.trim() ? imageUrl : null);

  return (
    <div className="mt-5 space-y-2">
      <Label className="inline-flex items-center gap-2 text-sm font-medium">
        <ImageIcon className="h-3.5 w-3.5 text-zinc-500" aria-hidden />
        Hospital image
      </Label>
      <p className="text-xs text-zinc-500">
        Optional. Upload an image (PNG / JPEG / WebP / GIF, up to{" "}
        {Math.round(MAX_IMAGE_BYTES / (1024 * 1024))} MB) or paste a URL.
        Applied directly to the hospital record on create.
      </p>
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-md border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
            {previewSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewSrc}
                alt="Hospital preview"
                className="h-full w-full object-cover"
                onError={() => {
                  // Bad pasted URL → fall back to placeholder so the user
                  // notices. Don't clear the local in-flight preview.
                  if (!previewUrl) onChange("");
                }}
              />
            ) : (
              <span className="text-[10px] text-zinc-500">No preview</span>
            )}
          </div>
          <Input
            value={imageUrl}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Image URL (https://…)"
            className="min-w-0 flex-1"
            disabled={uploading}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_IMAGE_TYPES.join(",")}
            onChange={handleInputChange}
            className="hidden"
            aria-hidden
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handlePick}
            disabled={uploading}
          >
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            {uploading ? "Uploading…" : "Upload"}
          </Button>
          {imageUrl ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                onChange("");
                setPreviewUrl(null);
              }}
              disabled={uploading}
            >
              <X className="h-3.5 w-3.5" />
              Clear
            </Button>
          ) : null}
        </div>
      </Card>
    </div>
  );
}

// ---------- Shared ----------

function SectionHeader({
  icon: Icon,
  title,
  subtitle,
  tone,
  suffix,
  required = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  tone: "violet" | "amber";
  suffix?: React.ReactNode;
  required?: boolean;
}) {
  const toneCls =
    tone === "violet"
      ? "bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400"
      : "bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400";
  return (
    <div className="flex items-start gap-3">
      <span
        aria-hidden
        className={cn(
          "grid h-9 w-9 shrink-0 place-items-center rounded-md",
          toneCls,
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          {title}
          {required ? <span className="text-rose-500">*</span> : null}
          {suffix}
        </h3>
        <p className="mt-0.5 text-sm text-zinc-500">{subtitle}</p>
      </div>
    </div>
  );
}

function Field({
  label,
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">
        {label}
        {required ? <span className="ml-0.5 text-rose-500">*</span> : null}
      </Label>
      {children}
    </div>
  );
}
