"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";
import {
  LEAD_SOURCE_LABEL,
  LEAD_STAGE_LABEL,
  LEAD_STAGE_ORDER,
} from "@/lib/sales-leads-data";
import type { LeadSource, LeadStage } from "@/lib/types";

const LEAD_SOURCES: LeadSource[] = [
  "cold",
  "referral",
  "inbound",
  "event",
  "website",
];

export interface NewLeadInput {
  clinicName: string;
  doctorName: string;
  specialization: string;
  phone: string;
  city: string;
  area: string;
  address: string;
  source: LeadSource;
  stage: LeadStage;
  monthlyAppointments: number;
  branches: number;
  value: number;
  notes: string;
}

interface NewLeadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Resolve when the create succeeds and reject (or throw) on failure so the
   * modal can keep the form populated for retry. The screen owns the API call
   * so it can refetch / prepend on success.
   */
  onCreate: (input: NewLeadInput) => Promise<void>;
}

interface FormErrors {
  clinicName?: string;
  doctorName?: string;
  phone?: string;
  city?: string;
}

const REQUIRED_FIELDS: ReadonlyArray<keyof FormErrors> = [
  "clinicName",
  "doctorName",
  "phone",
  "city",
];

const INITIAL: NewLeadInput = {
  clinicName: "",
  doctorName: "",
  specialization: "",
  phone: "",
  city: "",
  area: "",
  address: "",
  source: "cold",
  stage: "cold-lead",
  monthlyAppointments: 0,
  branches: 1,
  value: 0,
  notes: "",
};

/**
 * Capture-only form for creating a sales lead.
 *
 * Required fields per the API: clinic_name, doctor_name, phone, city
 * (specialization, area, address, source, value, stage, etc. are optional).
 * The screen wires `onCreate` to POST /api/v1/sales/leads via
 * `useLeadMutations().create` and refetches the list on success.
 */
export function NewLeadModal({
  open,
  onOpenChange,
  onCreate,
}: NewLeadModalProps) {
  const [form, setForm] = useState<NewLeadInput>(INITIAL);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(INITIAL);
      setErrors({});
      setSubmitting(false);
    }
  }, [open]);

  const update = <K extends keyof NewLeadInput>(
    key: K,
    value: NewLeadInput[K],
  ) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const validate = (): FormErrors => {
    const next: FormErrors = {};
    for (const f of REQUIRED_FIELDS) {
      const value = form[f];
      if (typeof value === "string" && value.trim().length === 0) {
        next[f] = "Required.";
      }
    }
    if (form.phone && !/^\+?[0-9 \-()]{6,}$/.test(form.phone.trim())) {
      next.phone = "Enter a valid phone number.";
    }
    return next;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      await onCreate({
        ...form,
        clinicName: form.clinicName.trim(),
        doctorName: form.doctorName.trim(),
        specialization: form.specialization.trim(),
        phone: form.phone.trim(),
        city: form.city.trim(),
        area: form.area.trim(),
        address: form.address.trim(),
        notes: form.notes.trim(),
      });
      toast.success("Lead created", { description: form.clinicName.trim() });
      onOpenChange(false);
    } catch {
      // Caller surfaced the error toast; keep the form open for retry.
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>New lead</DialogTitle>
          <DialogDescription>
            Capture a new clinic. Required: clinic name, doctor name, phone,
            and city. Everything else can be filled in later from the lead
            detail panel.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              id="new-clinic"
              label="Clinic name"
              required
              error={errors.clinicName}
            >
              <Input
                id="new-clinic"
                value={form.clinicName}
                onChange={(e) => update("clinicName", e.target.value)}
                aria-invalid={Boolean(errors.clinicName)}
                autoFocus
                placeholder="e.g. SmilePoint Dental Care"
              />
            </Field>

            <Field
              id="new-doctor"
              label="Doctor name"
              required
              error={errors.doctorName}
            >
              <Input
                id="new-doctor"
                value={form.doctorName}
                onChange={(e) => update("doctorName", e.target.value)}
                aria-invalid={Boolean(errors.doctorName)}
                placeholder="Dr. Anika Rao"
              />
            </Field>

            <Field id="new-specialization" label="Specialization">
              <Input
                id="new-specialization"
                value={form.specialization}
                onChange={(e) => update("specialization", e.target.value)}
                placeholder="Dentistry, Pediatrics, ENT…"
              />
            </Field>

            <Field id="new-phone" label="Phone" required error={errors.phone}>
              <Input
                id="new-phone"
                type="tel"
                value={form.phone}
                onChange={(e) => update("phone", e.target.value)}
                aria-invalid={Boolean(errors.phone)}
                inputMode="tel"
                placeholder="9876543210"
              />
            </Field>

            <Field id="new-city" label="City" required error={errors.city}>
              <Input
                id="new-city"
                value={form.city}
                onChange={(e) => update("city", e.target.value)}
                aria-invalid={Boolean(errors.city)}
                placeholder="Hyderabad"
              />
            </Field>

            <Field id="new-source" label="Lead source">
              <Select
                value={form.source}
                onValueChange={(v) => update("source", v as LeadSource)}
              >
                <SelectTrigger id="new-source">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEAD_SOURCES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {LEAD_SOURCE_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field id="new-area" label="Area">
              <Input
                id="new-area"
                value={form.area}
                onChange={(e) => update("area", e.target.value)}
                placeholder="Locality / neighborhood"
              />
            </Field>

            <Field id="new-address" label="Address">
              <Input
                id="new-address"
                value={form.address}
                onChange={(e) => update("address", e.target.value)}
                placeholder="Street address"
              />
            </Field>

            <Field id="new-monthly" label="Monthly appointments">
              <Input
                id="new-monthly"
                type="number"
                min={0}
                value={form.monthlyAppointments}
                onChange={(e) =>
                  update(
                    "monthlyAppointments",
                    Math.max(0, Number(e.target.value) || 0),
                  )
                }
                className="tabular-nums"
              />
            </Field>

            <Field id="new-branches" label="Branches">
              <Input
                id="new-branches"
                type="number"
                min={1}
                value={form.branches}
                onChange={(e) =>
                  update("branches", Math.max(1, Number(e.target.value) || 1))
                }
                className="tabular-nums"
              />
            </Field>

            <Field id="new-value" label="Estimated value (₹)">
              <Input
                id="new-value"
                type="number"
                min={0}
                value={form.value}
                onChange={(e) =>
                  update("value", Math.max(0, Number(e.target.value) || 0))
                }
                className="tabular-nums"
              />
            </Field>

            <Field id="new-stage" label="Stage">
              <Select
                value={form.stage}
                onValueChange={(v) => update("stage", v as LeadStage)}
              >
                <SelectTrigger id="new-stage">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEAD_STAGE_ORDER.map((s) => (
                    <SelectItem key={s} value={s}>
                      {LEAD_STAGE_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field id="new-notes" label="Notes">
            <Textarea
              id="new-notes"
              rows={3}
              value={form.notes}
              onChange={(e) => update("notes", e.target.value)}
              placeholder="Anything reps should know on the next interaction…"
            />
          </Field>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Create lead
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  id,
  label,
  required,
  error,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="flex items-center gap-1">
        <span>{label}</span>
        {required && <span className="text-rose-500">*</span>}
      </Label>
      {children}
      {error && (
        <p
          id={`${id}-error`}
          className={cn("text-xs text-rose-600 dark:text-rose-400")}
        >
          {error}
        </p>
      )}
    </div>
  );
}
