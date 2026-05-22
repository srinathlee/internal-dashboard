"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, Send, Zap } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { errorMessage } from "@/lib/hooks/use-async";
import { useAcpMutations } from "@/lib/hooks/use-accelerator";
import { cn } from "@/lib/utils";

interface AddMemberModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batchId: string;
  batchName: string;
  onAdded: () => void;
}

function autoPassword(name: string): string {
  const slug = name.toLowerCase().replace(/\s+/g, "");
  return slug ? `${slug}123` : "";
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Add-member modal. Captures name/email/phone + an editable auto-generated
 * password; the 2-month schedule and default targets are fixed and shown
 * read-only. On success it flips to a confirmation panel with "Add another".
 */
export function AddMemberModal({
  open,
  onOpenChange,
  batchId,
  batchName,
  onAdded,
}: AddMemberModalProps) {
  const { addMember } = useAcpMutations();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [passwordEdited, setPasswordEdited] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<{ name: string; email: string } | null>(
    null,
  );

  // Auto-derive the password from the name until the admin edits it manually.
  const effectivePassword = passwordEdited ? password : autoPassword(name);

  // Schedule is "now → +2 months". Cheap to derive each render; recomputed
  // naturally so the dates stay correct across day boundaries.
  const start = new Date();
  const end = new Date(start);
  end.setMonth(end.getMonth() + 2);
  const joining = fmtDate(start);
  const ending = fmtDate(end);

  const canSubmit =
    name.trim().length > 0 &&
    email.trim().length > 0 &&
    phone.trim().length > 0 &&
    !submitting;

  const reset = () => {
    setName("");
    setEmail("");
    setPhone("");
    setPassword("");
    setPasswordEdited(false);
    setCreated(null);
    setSubmitting(false);
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const member = await addMember(batchId, {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        password: effectivePassword || undefined,
      });
      setCreated({ name: member.name, email: member.email });
      onAdded();
    } catch (err) {
      toast.error("Couldn't add member", { description: errorMessage(err) });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" aria-hidden />
            Add member to {batchName}
          </DialogTitle>
        </DialogHeader>

        {created ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/40">
              <CheckCircle2
                className="h-8 w-8 text-emerald-600 dark:text-emerald-400"
                aria-hidden
              />
            </div>
            <div>
              <div className="text-base font-semibold">{created.name}</div>
              <div className="text-sm text-zinc-500">added to {batchName}</div>
            </div>
            <div className="w-full rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-left text-sm dark:border-zinc-800 dark:bg-zinc-900/60">
              <Row label="Joining date" value={joining} />
              <Row label="Ending date" value={ending} />
              <Row label="Duration" value="2 months" />
            </div>
            <p className="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" aria-hidden />
              Login credentials sent to {created.email}
            </p>
            <div className="mt-1 flex w-full gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={reset}
              >
                Add another
              </Button>
              <Button
                type="button"
                className="flex-1"
                onClick={() => {
                  reset();
                  onOpenChange(false);
                }}
              >
                Done
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Full name" required>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter name"
                    autoFocus
                  />
                </Field>
                <Field label="Email" required>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@email.com"
                  />
                </Field>
                <Field label="Phone" required>
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                  />
                </Field>
                <Field label="Password" required>
                  <Input
                    value={effectivePassword}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setPasswordEdited(true);
                    }}
                    placeholder="Auto-generated"
                    className="font-medium text-emerald-600 dark:text-emerald-400"
                  />
                </Field>
              </div>

              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm dark:border-zinc-800 dark:bg-zinc-900/60">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                  Program schedule
                </div>
                <dl className="mt-2 space-y-1.5 text-zinc-600 dark:text-zinc-300">
                  <Row label="Joining date" value={joining} />
                  <Row label="Ending date" value={ending} />
                  <Row label="Duration" value="2 months" />
                </dl>
              </div>

              <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-sm dark:border-amber-900/50 dark:bg-amber-950/20">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                  Targets (default)
                </div>
                <dl className="mt-2 space-y-1.5 text-zinc-600 dark:text-zinc-300">
                  <Row label="Month 1 — Sprint amount" value="₹10.0K" />
                  <Row label="Month 2 — Revenue generation" value="₹1.1L" />
                </dl>
              </div>

              <p className="flex items-center gap-1.5 text-xs text-violet-600 dark:text-violet-400">
                <Send className="h-3.5 w-3.5" aria-hidden />
                Login credentials will be emailed to the member on creation.
              </p>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="button" onClick={handleSubmit} disabled={!canSubmit}>
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : null}
                Create member
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
        {label} {required ? <span className="text-rose-500">*</span> : null}
      </Label>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className={cn("flex items-center justify-between gap-3")}>
      <dt>{label}</dt>
      <dd className="font-semibold text-zinc-800 dark:text-zinc-100">{value}</dd>
    </div>
  );
}
