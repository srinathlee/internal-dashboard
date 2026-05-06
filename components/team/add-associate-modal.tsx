"use client";

import { useState } from "react";
import {
  Activity,
  Calendar,
  Eye,
  EyeOff,
  Loader2,
  Target as TargetIcon,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { Role, Team } from "@/lib/types";

interface AddAssociateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  team: Team;
  onInvite: (input: { name: string; email: string; role: Role }) => void;
}

interface FormState {
  name: string;
  phone: string;
  email: string;
  passphrase: string;
  target: string;
  cycle: "full-month" | "two-weeks" | "one-week";
}

interface FormErrors {
  name?: string;
  phone?: string;
  email?: string;
  passphrase?: string;
  target?: string;
}

const CYCLE_LABELS: Record<FormState["cycle"], string> = {
  "full-month": "Full Month",
  "two-weeks": "Two Weeks",
  "one-week": "One Week",
};

const INITIAL_FORM: FormState = {
  name: "",
  phone: "",
  email: "",
  passphrase: "",
  target: "20",
  cycle: "full-month",
};

export function AddAssociateModal({
  open,
  onOpenChange,
  team,
  onInvite,
}: AddAssociateModalProps) {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [showPassphrase, setShowPassphrase] = useState(false);

  const reset = () => {
    setForm(INITIAL_FORM);
    setErrors({});
    setSubmitting(false);
    setShowPassphrase(false);
  };

  const handleClose = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors: FormErrors = {};
    const name = form.name.trim();
    const email = form.email.trim();
    const phone = form.phone.trim();
    const passphrase = form.passphrase;
    const targetNum = Number(form.target);

    if (!name) nextErrors.name = "Required.";
    if (!phone) nextErrors.phone = "Required.";
    else if (!/^\+?[\d\s-]{7,}$/.test(phone))
      nextErrors.phone = "Enter a valid phone.";
    if (!email) nextErrors.email = "Required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      nextErrors.email = "Invalid email.";
    if (!passphrase) nextErrors.passphrase = "Required.";
    else if (passphrase.length < 6) nextErrors.passphrase = "Min 6 characters.";
    if (!form.target || Number.isNaN(targetNum) || targetNum <= 0)
      nextErrors.target = "Enter a positive number.";

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 250));
    onInvite({ name, email, role: "member" });
    toast.success(`Authorized ${name}`, {
      description: `Associate added to ${team.name} · target ${targetNum} / ${CYCLE_LABELS[form.cycle].toLowerCase()}`,
    });
    handleClose(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg gap-0 overflow-hidden p-0">
        <div className="flex items-center gap-4 border-b border-zinc-200 px-6 py-5 dark:border-zinc-800">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-teal-700 text-white shadow-sm">
            <UserPlus className="h-6 w-6" aria-hidden />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold tracking-wide text-zinc-900 dark:text-zinc-50">
              ADD ASSOCIATE
            </h2>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
              Sales Field Operations
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="px-6 py-6">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <PillField
              id="assoc-name"
              label="Associate Full Name"
              error={errors.name}
            >
              <PillInput
                id="assoc-name"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                autoComplete="name"
                autoFocus
                placeholder="e.g. Asha Pillai"
                aria-invalid={Boolean(errors.name)}
              />
            </PillField>

            <PillField
              id="assoc-phone"
              label="Secure Comms (Phone)"
              error={errors.phone}
            >
              <PillInput
                id="assoc-phone"
                type="tel"
                value={form.phone}
                onChange={(e) =>
                  setForm((f) => ({ ...f, phone: e.target.value }))
                }
                autoComplete="tel"
                placeholder="+91 XXXXXXXXXX"
                aria-invalid={Boolean(errors.phone)}
              />
            </PillField>
          </div>

          <div className="mt-5">
            <PillField
              id="assoc-email"
              label="Authorization Email"
              error={errors.email}
            >
              <PillInput
                id="assoc-email"
                type="email"
                value={form.email}
                onChange={(e) =>
                  setForm((f) => ({ ...f, email: e.target.value }))
                }
                autoComplete="email"
                placeholder="associate.id@nyra.ai"
                aria-invalid={Boolean(errors.email)}
              />
            </PillField>
          </div>

          <div className="mt-5">
            <PillField
              id="assoc-passphrase"
              label="Security Passphrase"
              error={errors.passphrase}
            >
              <div className="relative">
                <PillInput
                  id="assoc-passphrase"
                  type={showPassphrase ? "text" : "password"}
                  value={form.passphrase}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, passphrase: e.target.value }))
                  }
                  autoComplete="new-password"
                  placeholder="••••••••"
                  className="pr-11"
                  aria-invalid={Boolean(errors.passphrase)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassphrase((s) => !s)}
                  aria-label={
                    showPassphrase ? "Hide passphrase" : "Show passphrase"
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 transition-colors hover:text-zinc-700 dark:hover:text-zinc-200"
                >
                  {showPassphrase ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </PillField>
          </div>

          <div className="my-6 border-t border-zinc-200 dark:border-zinc-800" />

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <PillField
              id="assoc-target"
              label="Acquisition Target"
              error={errors.target}
            >
              <div className="relative">
                <TargetIcon
                  aria-hidden
                  className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
                />
                <PillInput
                  id="assoc-target"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={form.target}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, target: e.target.value }))
                  }
                  className="pl-10 font-semibold"
                  aria-invalid={Boolean(errors.target)}
                />
              </div>
            </PillField>

            <PillField id="assoc-cycle" label="Duty Cycle">
              <div className="relative">
                <Calendar
                  aria-hidden
                  className="pointer-events-none absolute left-4 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-zinc-500"
                />
                <Select
                  value={form.cycle}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, cycle: v as FormState["cycle"] }))
                  }
                >
                  <SelectTrigger
                    id="assoc-cycle"
                    className="h-11 rounded-full border-zinc-200 bg-zinc-50 pl-10 pr-4 font-semibold dark:border-zinc-800 dark:bg-zinc-900"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(CYCLE_LABELS) as FormState["cycle"][]).map(
                      (k) => (
                        <SelectItem key={k} value={k}>
                          {CYCLE_LABELS[k]}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>
            </PillField>
          </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-zinc-200 bg-zinc-50/60 px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900/40">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleClose(false)}
              disabled={submitting}
              className="h-11 rounded-full px-6 text-xs font-bold uppercase tracking-[0.15em]"
            >
              Discard
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="h-11 rounded-full bg-teal-600 px-6 text-xs font-bold uppercase tracking-[0.15em] text-white hover:bg-teal-700 dark:bg-teal-600 dark:hover:bg-teal-500"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Activity className="h-4 w-4" />
              )}
              Add Associate
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PillField({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label
        htmlFor={id}
        className="text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-700 dark:text-zinc-300"
      >
        {label}
      </Label>
      {children}
      {error && (
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}

function PillInput({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Input
      {...props}
      className={cn(
        "h-11 rounded-full border-zinc-200 bg-zinc-50 px-4 placeholder:font-medium placeholder:text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900",
        className,
      )}
    />
  );
}
