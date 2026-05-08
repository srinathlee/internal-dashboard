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
import { errorMessage } from "@/lib/hooks/use-async";
import { useTeamMutations } from "@/lib/hooks/use-teams";

import { PasswordRevealCard } from "./password-reveal-card";

interface ReplaceAdminModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: string;
  teamName: string;
  onReplaced?: () => void;
}

/**
 * Replace (or first-time assign) the team admin. The previous admin, if
 * any, is automatically demoted to SALES_SUBADMIN by the backend.
 *
 * The "promote existing member" path is intentionally not surfaced here
 * yet — it requires picking a user from a list, which clutters the
 * single-purpose flow. Build that as a separate "Promote member" action
 * on the member row when the use case actually shows up.
 */
export function ReplaceAdminModal({
  open,
  onOpenChange,
  teamId,
  teamName,
  onReplaced,
}: ReplaceAdminModalProps) {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !phone.trim() || password.length < 8) {
      toast.error("Fill out every field. Password must be ≥ 8 chars.");
      return;
    }
    setSubmitting(true);
    try {
      await mutations.assignAdmin(teamId, {
        admin: {
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          password,
        },
      });
      toast.success("Team admin assigned");
      setDone({ email: email.trim(), password });
      onReplaced?.();
    } catch (err) {
      toast.error("Couldn't assign admin", { description: errorMessage(err) });
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New admin assigned</DialogTitle>
            <DialogDescription>
              Share these credentials with the new admin. The password
              won't be shown again.
            </DialogDescription>
          </DialogHeader>
          <PasswordRevealCard
            heading={`${teamName} — Team admin`}
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
          <DialogTitle>Assign team admin</DialogTitle>
          <DialogDescription>
            The previous admin, if any, will be demoted to a regular member.
            The new admin will be created as a SALES_ADMIN scoped to{" "}
            <strong>{teamName}</strong>.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3" noValidate>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field id="ra-name" label="Full name">
              <Input
                id="ra-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </Field>
            <Field id="ra-email" label="Email">
              <Input
                id="ra-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            <Field id="ra-phone" label="Phone">
              <Input
                id="ra-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </Field>
            <Field id="ra-pw" label="Initial password">
              <Input
                id="ra-pw"
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
              Assign admin
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
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}
