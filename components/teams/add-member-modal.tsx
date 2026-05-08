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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { errorMessage } from "@/lib/hooks/use-async";
import { useSubadminMutations } from "@/lib/hooks/use-subadmins";

import { PasswordRevealCard } from "./password-reveal-card";

interface AddMemberModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: string;
  onCreated?: () => void;
}

/**
 * Create a SALES_SUBADMIN ("member") in the given team.
 *
 * Wired to POST /api/v1/sales/subadmins. Per the backend spec, the
 * SALES_SUBADMIN role is implicit; team scoping comes from the JWT (for
 * SALES_ADMIN callers) or `team_id` in the body (for SUPER_ADMIN
 * callers, which is what we send).
 */
export function AddMemberModal({
  open,
  onOpenChange,
  teamId,
  onCreated,
}: AddMemberModalProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [target, setTarget] = useState(10);
  const [period, setPeriod] = useState<
    "MONTHLY" | "QUARTERLY" | "HALF_YEARLY" | "YEARLY"
  >("MONTHLY");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{
    email: string;
    password: string;
  } | null>(null);

  const mutations = useSubadminMutations();

  const reset = () => {
    setName("");
    setEmail("");
    setPhone("");
    setPassword("");
    setTarget(10);
    setPeriod("MONTHLY");
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
      await mutations.create({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        password,
        status: "ACTIVE",
        target_hospitals: target,
        target_period: period,
      });
      toast.success("Member added");
      setDone({ email: email.trim(), password });
      onCreated?.();
    } catch (err) {
      toast.error("Couldn't add member", {
        description: errorMessage(err),
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
            <DialogTitle>Member added</DialogTitle>
            <DialogDescription>
              Share these credentials with the new member. The password
              won't be shown again.
            </DialogDescription>
          </DialogHeader>
          <PasswordRevealCard
            heading={`${teamId} — New member`}
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
          <DialogTitle>Add member to {teamId}</DialogTitle>
          <DialogDescription>
            Members can view their own performance and manage their own
            leads, but can't create or edit other users.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3" noValidate>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field id="m-name" label="Full name">
              <Input
                id="m-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </Field>
            <Field id="m-email" label="Email">
              <Input
                id="m-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            <Field id="m-phone" label="Phone">
              <Input
                id="m-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </Field>
            <Field id="m-pw" label="Initial password">
              <Input
                id="m-pw"
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="font-mono"
              />
            </Field>
            <Field id="m-target" label="Target hospitals">
              <Input
                id="m-target"
                type="number"
                min={0}
                value={target}
                onChange={(e) =>
                  setTarget(Math.max(0, Number(e.target.value) || 0))
                }
                className="tabular-nums"
              />
            </Field>
            <Field id="m-period" label="Target period">
              <Select
                value={period}
                onValueChange={(v) =>
                  setPeriod(v as typeof period)
                }
              >
                <SelectTrigger id="m-period">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MONTHLY">Monthly</SelectItem>
                  <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                  <SelectItem value="HALF_YEARLY">Half-yearly</SelectItem>
                  <SelectItem value="YEARLY">Yearly</SelectItem>
                </SelectContent>
              </Select>
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
              Add member
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
