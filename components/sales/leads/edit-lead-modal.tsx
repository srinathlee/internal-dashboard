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
import type { Lead, LeadPriority, LeadSource, LeadStage } from "@/lib/types";

const LEAD_SOURCES: LeadSource[] = ["cold", "referral", "inbound", "event", "website"];
const LEAD_PRIORITIES: LeadPriority[] = ["Low", "Medium", "High", "Hot"];

interface EditLeadModalProps {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (leadId: string, patch: LeadPatch) => void;
}

/** The subset of Lead fields the edit modal owns. */
export interface LeadPatch {
  clinicName: string;
  doctorName: string;
  specialization: string;
  phone: string;
  email: string;
  city: string;
  source: LeadSource;
  priority: LeadPriority;
  area: string;
  address: string;
  monthlyAppointments: number;
  branches: number;
  value: number;
  stage: LeadStage;
  notes: string;
}

interface FormErrors {
  clinicName?: string;
  doctorName?: string;
  specialization?: string;
  phone?: string;
  city?: string;
  source?: string;
}

const REQUIRED_FIELDS: ReadonlyArray<keyof FormErrors> = [
  "clinicName",
  "doctorName",
  "specialization",
  "phone",
  "city",
  "source",
];

function buildInitialState(lead: Lead | null): LeadPatch {
  if (!lead) {
    return {
      clinicName: "",
      doctorName: "",
      specialization: "",
      phone: "",
      email: "",
      city: "",
      source: "cold",
      priority: "Medium",
      area: "",
      address: "",
      monthlyAppointments: 0,
      branches: 1,
      value: 0,
      stage: "cold-lead",
      notes: "",
    };
  }
  return {
    clinicName: lead.clinicName,
    doctorName: lead.doctorName,
    specialization: lead.specialization,
    phone: lead.phone,
    email: lead.email ?? "",
    city: lead.city,
    source: lead.source,
    priority: lead.priority ?? "Medium",
    area: lead.area,
    address: lead.address,
    monthlyAppointments: lead.monthlyAppointments,
    branches: lead.branches,
    value: lead.value,
    stage: lead.stage,
    notes: lead.notes,
  };
}

export function EditLeadModal({
  lead,
  open,
  onOpenChange,
  onSave,
}: EditLeadModalProps) {
  const [form, setForm] = useState<LeadPatch>(() => buildInitialState(lead));
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  // Re-seed the form whenever a different lead is opened.
  useEffect(() => {
    if (open) {
      setForm(buildInitialState(lead));
      setErrors({});
      setSubmitting(false);
    }
  }, [open, lead]);

  if (!lead) return null;

  const update = <K extends keyof LeadPatch>(key: K, value: LeadPatch[K]) => {
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
    await new Promise((r) => setTimeout(r, 200));
    onSave(lead.id, {
      ...form,
      clinicName: form.clinicName.trim(),
      doctorName: form.doctorName.trim(),
      specialization: form.specialization.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      city: form.city.trim(),
      area: form.area.trim(),
      address: form.address.trim(),
      notes: form.notes.trim(),
    });
    toast.success("Lead updated", {
      description: form.clinicName.trim(),
    });
    setSubmitting(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit lead</DialogTitle>
          <DialogDescription className="sr-only">
            Update the clinic's information and pipeline stage.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field id="lead-clinic" label="Clinic name" required error={errors.clinicName}>
              <Input
                id="lead-clinic"
                value={form.clinicName}
                onChange={(e) => update("clinicName", e.target.value)}
                aria-invalid={Boolean(errors.clinicName)}
                autoFocus
              />
            </Field>

            <Field id="lead-doctor" label="Doctor name" required error={errors.doctorName}>
              <Input
                id="lead-doctor"
                value={form.doctorName}
                onChange={(e) => update("doctorName", e.target.value)}
                aria-invalid={Boolean(errors.doctorName)}
              />
            </Field>

            <Field
              id="lead-specialization"
              label="Specialization"
              required
              error={errors.specialization}
            >
              <Input
                id="lead-specialization"
                value={form.specialization}
                onChange={(e) => update("specialization", e.target.value)}
                aria-invalid={Boolean(errors.specialization)}
                placeholder="Dentistry, Pediatrics, ENT…"
              />
            </Field>

            <Field id="lead-phone" label="Phone" required error={errors.phone}>
              <Input
                id="lead-phone"
                type="tel"
                value={form.phone}
                onChange={(e) => update("phone", e.target.value)}
                aria-invalid={Boolean(errors.phone)}
                inputMode="tel"
              />
            </Field>

            <Field id="lead-email" label="Email">
              <Input
                id="lead-email"
                type="email"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                inputMode="email"
                autoComplete="email"
                placeholder="dr.sharma@clinic.in"
              />
            </Field>

            <Field id="lead-city" label="City" required error={errors.city}>
              <Input
                id="lead-city"
                value={form.city}
                onChange={(e) => update("city", e.target.value)}
                aria-invalid={Boolean(errors.city)}
              />
            </Field>

            <Field id="lead-priority" label="Priority">
              <Select
                value={form.priority}
                onValueChange={(v) => update("priority", v as LeadPriority)}
              >
                <SelectTrigger id="lead-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEAD_PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field id="lead-source" label="Lead source" required error={errors.source}>
              <Select
                value={form.source}
                onValueChange={(v) => update("source", v as LeadSource)}
              >
                <SelectTrigger id="lead-source">
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

            <Field id="lead-area" label="Area">
              <Input
                id="lead-area"
                value={form.area}
                onChange={(e) => update("area", e.target.value)}
                placeholder="Locality / neighborhood"
              />
            </Field>

            <Field id="lead-address" label="Address">
              <Input
                id="lead-address"
                value={form.address}
                onChange={(e) => update("address", e.target.value)}
                placeholder="Street address"
              />
            </Field>

            <Field id="lead-monthly" label="Monthly appointments">
              <Input
                id="lead-monthly"
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

            <Field id="lead-branches" label="Branches">
              <Input
                id="lead-branches"
                type="number"
                min={1}
                value={form.branches}
                onChange={(e) =>
                  update("branches", Math.max(1, Number(e.target.value) || 1))
                }
                className="tabular-nums"
              />
            </Field>

            <Field id="lead-value" label="Estimated value">
              <Input
                id="lead-value"
                type="number"
                min={0}
                value={form.value}
                onChange={(e) =>
                  update("value", Math.max(0, Number(e.target.value) || 0))
                }
                className="tabular-nums"
              />
            </Field>
          </div>

          <Field id="lead-stage" label="Stage">
            <Select
              value={form.stage}
              onValueChange={(v) => update("stage", v as LeadStage)}
            >
              <SelectTrigger id="lead-stage">
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

          <Field id="lead-notes" label="Notes">
            <Textarea
              id="lead-notes"
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
              Save
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
