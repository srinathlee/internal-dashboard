"use client";

import { useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
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
import { errorMessage } from "@/lib/hooks/use-async";
import { useTeamMutations } from "@/lib/hooks/use-teams";

import { PasswordRevealCard } from "./password-reveal-card";

interface AddSalesAdminModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

/**
 * First-time bootstrap for the Sales team: collects only admin details
 * and posts to /api/v1/teams with the sales team metadata locked in.
 *
 * This is a thin variant of CreateTeamModal — same atomic create-team-+-admin
 * call, but the team fields (id="sales", name="Sales", description) are
 * implicit, so the super admin is never asked to type the team name to
 * onboard the sales lead.
 *
 * After this runs once, the team exists in the backend and any subsequent
 * admin replacement uses POST /teams/:id/admin via ReplaceAdminModal.
 */
export function AddSalesAdminModal({
  open,
  onOpenChange,
  onCreated,
}: AddSalesAdminModalProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{
    email: string;
    password: string;
  } | null>(null);
  const mutations = useTeamMutations();

  const reset = () => {
    setName("");
    setEmail("");
    setPhone("");
    setPassword("");
    setDone(null);
    setSubmitting(false);
  };

  const handleClose = (next: boolean) => {
    onOpenChange(next);
    if (!next) window.setTimeout(reset, 200);
  };

  const validate = (): string | null => {
    if (!name.trim()) return "Admin name is required.";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim()))
      return "Admin email is invalid.";
    if (!phone.trim()) return "Admin phone is required.";
    if (password.length < 8)
      return "Initial password must be at least 8 characters.";
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
        id: "sales",
        name: "Sales",
        color: "blue",
        description: "Outbound deal motion across hospitals & clinics.",
        admin: {
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          password,
        },
      });
      toast.success("Sales admin created");
      setDone({ email: email.trim(), password });
      onCreated?.();
    } catch (error) {
      toast.error("Couldn't create sales admin", {
        description: errorMessage(error),
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Sales admin created</DialogTitle>
            <DialogDescription>
              Share these credentials with the new sales admin. The password
              won't be shown again.
            </DialogDescription>
          </DialogHeader>
          <PasswordRevealCard
            heading="Sales — Team admin"
            email={done.email}
            password={done.password}
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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck
              className="h-5 w-5 text-indigo-600 dark:text-indigo-400"
              aria-hidden
            />
            Add sales admin
          </DialogTitle>
          <DialogDescription>
            The sales admin manages all sales associates. They get their own
            login and a team-scoped dashboard. Existing sales members are
            visible to them automatically.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3" noValidate>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field id="sa-name" label="Full name" required>
              <Input
                id="sa-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Arjun Mehta"
                autoFocus
              />
            </Field>
            <Field id="sa-email" label="Email" required>
              <Input
                id="sa-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="arjun@nyra.ai"
              />
            </Field>
            <Field id="sa-phone" label="Phone" required>
              <Input
                id="sa-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="9876543210"
              />
            </Field>
            <Field
              id="sa-pw"
              label="Initial password"
              required
              hint="Min 8 chars · shown once"
            >
              <Input
                id="sa-pw"
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="font-mono"
              />
            </Field>
          </div>
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
              Create sales admin
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
