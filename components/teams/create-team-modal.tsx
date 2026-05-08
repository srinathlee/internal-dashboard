"use client";

import { useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { errorMessage } from "@/lib/hooks/use-async";
import { useTeamMutations } from "@/lib/hooks/use-teams";

import { PasswordRevealCard } from "./password-reveal-card";

export interface CreateTeamModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

interface FormState {
  id: string;
  name: string;
  description: string;
  color: string;
  adminName: string;
  adminEmail: string;
  adminPhone: string;
  adminPassword: string;
}

const INITIAL: FormState = {
  id: "",
  name: "",
  description: "",
  color: "blue",
  adminName: "",
  adminEmail: "",
  adminPhone: "",
  adminPassword: "",
};

/**
 * Two-section form: team metadata at the top, the team admin's account
 * details below. Both are submitted together so the backend can create
 * the team + admin atomically (per the spec).
 *
 * After success we surface the admin's initial password once via a copy
 * card — same modal stays open so the super admin can hand off the creds
 * before closing.
 */
export function CreateTeamModal({
  open,
  onOpenChange,
  onCreated,
}: CreateTeamModalProps) {
  const [form, setForm] = useState<FormState>(INITIAL);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<{
    teamName: string;
    adminEmail: string;
    password: string;
  } | null>(null);
  const mutations = useTeamMutations();

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const reset = () => {
    setForm(INITIAL);
    setCreated(null);
    setSubmitting(false);
  };

  const handleClose = (next: boolean) => {
    onOpenChange(next);
    if (!next) {
      window.setTimeout(reset, 200);
    }
  };

  const validate = (): string | null => {
    if (!form.id.trim()) return "Team ID is required.";
    if (!/^[a-z][a-z0-9_-]*$/.test(form.id.trim())) {
      return "Team ID must be lowercase letters, numbers, dash or underscore.";
    }
    if (!form.name.trim()) return "Team name is required.";
    if (!form.adminName.trim()) return "Admin name is required.";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.adminEmail.trim())) {
      return "Admin email is invalid.";
    }
    if (!form.adminPhone.trim()) return "Admin phone is required.";
    if (form.adminPassword.length < 8) {
      return "Admin password must be at least 8 characters.";
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    setSubmitting(true);
    try {
      await mutations.create({
        id: form.id.trim(),
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        color: form.color || undefined,
        admin: {
          name: form.adminName.trim(),
          email: form.adminEmail.trim(),
          phone: form.adminPhone.trim(),
          password: form.adminPassword,
        },
      });
      toast.success("Team created");
      setCreated({
        teamName: form.name.trim(),
        adminEmail: form.adminEmail.trim(),
        password: form.adminPassword,
      });
      onCreated?.();
    } catch (error) {
      toast.error("Couldn't create team", {
        description: errorMessage(error),
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (created) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Team created</DialogTitle>
            <DialogDescription>
              Share these credentials with the team admin. The password
              won't be shown again.
            </DialogDescription>
          </DialogHeader>
          <PasswordRevealCard
            heading={`${created.teamName} — Team admin`}
            email={created.adminEmail}
            password={created.password}
          />
          <DialogFooter>
            <Button onClick={() => handleClose(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create team</DialogTitle>
          <DialogDescription>
            Set up the team and assign its admin in one step. The admin
            will be created as a SALES_ADMIN scoped to this team.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Team
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field id="team-id" label="Team ID" required hint="lowercase, no spaces (e.g. sales)">
                <Input
                  id="team-id"
                  value={form.id}
                  onChange={(e) => update("id", e.target.value)}
                  placeholder="sales"
                  autoFocus
                />
              </Field>
              <Field id="team-name" label="Display name" required>
                <Input
                  id="team-name"
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                  placeholder="Sales"
                />
              </Field>
            </div>
            <Field id="team-color" label="Color">
              <Input
                id="team-color"
                value={form.color}
                onChange={(e) => update("color", e.target.value)}
                placeholder="blue"
              />
            </Field>
            <Field id="team-desc" label="Description">
              <Textarea
                id="team-desc"
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
                rows={2}
                placeholder="What this team does"
              />
            </Field>
          </section>

          <section className="space-y-3 border-t border-zinc-100 pt-4 dark:border-zinc-800">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Team admin
              </h3>
              <p className="mt-0.5 text-xs text-zinc-500">
                Becomes the SALES_ADMIN for this team. They can manage members
                but cannot create other admins.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field id="admin-name" label="Full name" required>
                <Input
                  id="admin-name"
                  value={form.adminName}
                  onChange={(e) => update("adminName", e.target.value)}
                />
              </Field>
              <Field id="admin-email" label="Email" required>
                <Input
                  id="admin-email"
                  type="email"
                  value={form.adminEmail}
                  onChange={(e) => update("adminEmail", e.target.value)}
                />
              </Field>
              <Field id="admin-phone" label="Phone" required>
                <Input
                  id="admin-phone"
                  type="tel"
                  value={form.adminPhone}
                  onChange={(e) => update("adminPhone", e.target.value)}
                />
              </Field>
              <Field
                id="admin-password"
                label="Initial password"
                required
                hint="Min 8 chars · shown once after creation"
              >
                <Input
                  id="admin-password"
                  type="text"
                  value={form.adminPassword}
                  onChange={(e) => update("adminPassword", e.target.value)}
                  className="font-mono"
                />
              </Field>
            </div>
          </section>

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
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Create team
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
  hint,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="flex items-center gap-1">
        <span>{label}</span>
        {required && <span className="text-rose-500">*</span>}
      </Label>
      {children}
      {hint ? <p className="text-xs text-zinc-500">{hint}</p> : null}
    </div>
  );
}
