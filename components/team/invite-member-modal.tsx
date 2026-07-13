"use client";

import { useState } from "react";
import { Loader2, UserPlus } from "lucide-react";
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
import type { Role, Team } from "@/lib/types";

interface InviteMemberModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  team: Team;
  /** Roles the inviter is allowed to assign. */
  assignableRoles: Role[];
  onInvite: (input: { name: string; email: string; role: Role }) => void;
}

interface FormState {
  name: string;
  email: string;
  role: Role;
}

interface FormErrors {
  name?: string;
  email?: string;
  role?: string;
}

const ROLE_LABELS: Record<Role, string> = {
  member: "Member",
  admin: "Admin",
  super_admin: "Super Admin",
};

export function InviteMemberModal({
  open,
  onOpenChange,
  team,
  assignableRoles,
  onInvite,
}: InviteMemberModalProps) {
  const defaultRole = assignableRoles.includes("member")
    ? "member"
    : (assignableRoles[0] ?? "member");
  const [form, setForm] = useState<FormState>({
    name: "",
    email: "",
    role: defaultRole,
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setForm({ name: "", email: "", role: defaultRole });
    setErrors({});
    setSubmitting(false);
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
    if (!name) nextErrors.name = "Name is required.";
    if (!email) nextErrors.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      nextErrors.email = "Enter a valid email address.";
    if (!assignableRoles.includes(form.role))
      nextErrors.role = "Choose a role you can assign.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    // Simulate a brief network round-trip so the spinner is visible.
    await new Promise((r) => setTimeout(r, 250));
    onInvite({ name, email, role: form.role });
    toast.success(`Invited ${name}`, {
      description: `${ROLE_LABELS[form.role]} on ${team.name} · invite sent to ${email}`,
    });
    handleClose(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite member</DialogTitle>
          <DialogDescription>
            They'll receive a sign-in link and join the {team.name} team.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <Field id="invite-name" label="Name" error={errors.name}>
            <Input
              id="invite-name"
              value={form.name}
              onChange={(e) =>
                setForm((f) => ({ ...f, name: e.target.value }))
              }
              autoComplete="name"
              autoFocus
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? "invite-name-error" : undefined}
              placeholder="Asha Pillai"
            />
          </Field>

          <Field id="invite-email" label="Email" error={errors.email}>
            <Input
              id="invite-email"
              type="email"
              value={form.email}
              onChange={(e) =>
                setForm((f) => ({ ...f, email: e.target.value }))
              }
              autoComplete="email"
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? "invite-email-error" : undefined}
              placeholder="asha.pillai@myteamflow.com"
            />
          </Field>

          <Field id="invite-role" label="Role" error={errors.role}>
            <Select
              value={form.role}
              onValueChange={(v) =>
                setForm((f) => ({ ...f, role: v as Role }))
              }
            >
              <SelectTrigger id="invite-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {assignableRoles.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleClose(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )}
              Send invite
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
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && (
        <p id={`${id}-error`} className="text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
