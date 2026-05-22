"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Power,
  Target as TargetIcon,
  Trash2,
  User as UserIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PasswordRevealCard } from "@/components/teams/password-reveal-card";
import { useAuth } from "@/lib/auth";
import { errorMessage } from "@/lib/hooks/use-async";
import { useSubadminMutations } from "@/lib/hooks/use-subadmins";
import type { ApiSubadmin } from "@/lib/api/types";

interface RepProfileSectionProps {
  member: ApiSubadmin;
  /** Refetch upstream after any mutation lands. */
  onMutated?: () => void;
  /** Called after a hard delete so the page can navigate away. */
  onDeleted?: () => void;
}

/**
 * Editable profile / targets / password + account actions for a rep — the
 * page-resident replacement for the old member-detail sheet. Lives in the
 * Overview tab. Dirty-tracked: Save disables until something actually changes.
 */
export function RepProfileSection({
  member,
  onMutated,
  onDeleted,
}: RepProfileSectionProps) {
  const auth = useAuth();
  const isSuperAdmin = auth.user?.role === "super_admin";
  const mutations = useSubadminMutations();

  const [name, setName] = useState(member.name);
  const [email, setEmail] = useState(member.email);
  const [phone, setPhone] = useState(member.phone);
  const [target, setTarget] = useState(member.target_hospitals);
  const [period, setPeriod] = useState<ApiSubadmin["target_period"]>(
    member.target_period,
  );
  const [savingProfile, setSavingProfile] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setName(member.name);
    setEmail(member.email);
    setPhone(member.phone);
    setTarget(member.target_hospitals);
    setPeriod(member.target_period);
  }, [
    member.id,
    member.name,
    member.email,
    member.phone,
    member.target_hospitals,
    member.target_period,
  ]);

  const dirty = useMemo(
    () =>
      name.trim() !== member.name ||
      email.trim() !== member.email ||
      phone.trim() !== member.phone ||
      target !== member.target_hospitals ||
      period !== member.target_period,
    [name, email, phone, target, period, member],
  );

  const handleSaveProfile = async () => {
    if (!dirty) return;
    if (name.trim().length === 0) {
      toast.error("Name can't be empty.");
      return;
    }
    if (
      email.trim().length > 0 &&
      !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())
    ) {
      toast.error("Invalid email.");
      return;
    }
    setSavingProfile(true);
    try {
      await mutations.update(member.id, {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        target_hospitals: target,
        target_period: period,
      });
      toast.success("Member updated");
      onMutated?.();
    } catch (err) {
      toast.error("Couldn't save changes", { description: errorMessage(err) });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleToggleStatus = async () => {
    const next: "ACTIVE" | "INACTIVE" =
      member.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    setStatusBusy(true);
    try {
      await mutations.update(member.id, { status: next });
      toast.success(
        next === "ACTIVE" ? "Member reactivated" : "Member deactivated",
      );
      onMutated?.();
    } catch (err) {
      toast.error("Couldn't update status", { description: errorMessage(err) });
    } finally {
      setStatusBusy(false);
    }
  };

  const handleDelete = async () => {
    const confirmed = window.confirm(
      `Permanently delete ${member.name}? This can't be undone.`,
    );
    if (!confirmed) return;
    setDeleting(true);
    try {
      await mutations.remove(member.id);
      toast.success("Member deleted");
      onDeleted?.();
    } catch (err) {
      toast.error("Couldn't delete member", { description: errorMessage(err) });
    } finally {
      setDeleting(false);
    }
  };

  const resetForm = () => {
    setName(member.name);
    setEmail(member.email);
    setPhone(member.phone);
    setTarget(member.target_hospitals);
    setPeriod(member.target_period);
  };

  return (
    <div className="space-y-4">
      {/* Profile + targets */}
      <Card className="overflow-hidden">
        <Header
          icon={UserIcon}
          title="Profile"
          description="Editable contact details. Changes apply immediately."
        />
        <div className="grid grid-cols-1 gap-3 px-4 py-4 sm:grid-cols-2">
          <Field id="rp-name" label="Full name">
            <Input
              id="rp-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
          </Field>
          <Field id="rp-email" label="Email">
            <Input
              id="rp-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </Field>
          <Field id="rp-phone" label="Phone">
            <Input
              id="rp-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
              className="font-mono"
            />
          </Field>
        </div>

        <Header
          icon={TargetIcon}
          title="Targets"
          description="How many hospitals this rep is expected to onboard each period."
        />
        <div className="grid grid-cols-1 gap-3 px-4 py-4 sm:grid-cols-2">
          <Field id="rp-target" label="Target hospitals">
            <Input
              id="rp-target"
              type="number"
              min={0}
              value={target}
              onChange={(e) =>
                setTarget(Math.max(0, Number(e.target.value) || 0))
              }
              className="tabular-nums"
            />
          </Field>
          <Field id="rp-period" label="Period">
            <Select
              value={period}
              onValueChange={(v) =>
                setPeriod(v as ApiSubadmin["target_period"])
              }
            >
              <SelectTrigger id="rp-period">
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

        <div className="flex items-center justify-end gap-2 border-t border-zinc-200 bg-zinc-50/60 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/40">
          <Button
            variant="outline"
            size="sm"
            disabled={!dirty || savingProfile}
            onClick={resetForm}
          >
            Reset
          </Button>
          <Button
            size="sm"
            disabled={!dirty || savingProfile}
            onClick={handleSaveProfile}
          >
            {savingProfile && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Save changes
          </Button>
        </div>
      </Card>

      {/* Password */}
      <Card className="overflow-hidden">
        <Header
          icon={KeyRound}
          title="Password"
          description="Set a new password for this member. Share it once — it can't be retrieved later."
        />
        <div className="px-4 py-4">
          <PasswordSection
            memberId={member.id}
            memberName={member.name}
            memberEmail={member.email}
            onSaved={onMutated}
          />
        </div>
      </Card>

      {/* Account actions */}
      <Card className="overflow-hidden">
        <Header icon={Power} title="Account" description="Manage access." />
        <div className="px-4 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleToggleStatus}
              disabled={statusBusy}
            >
              {statusBusy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Power className="h-3.5 w-3.5" aria-hidden />
              )}
              {member.status === "ACTIVE" ? "Deactivate" : "Reactivate"}
            </Button>
            {isSuperAdmin ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDelete}
                disabled={deleting}
                className="text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:text-rose-400 dark:hover:bg-rose-950/40 dark:hover:text-rose-300"
              >
                {deleting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                )}
                Delete member
              </Button>
            ) : null}
          </div>
          <p className="mt-2 text-[11px] text-zinc-500">
            {isSuperAdmin
              ? "Deletion is permanent. Deactivation is reversible."
              : "Deactivation is reversible. Only super admin can permanently delete."}
          </p>
        </div>
      </Card>
    </div>
  );
}

function PasswordSection({
  memberId,
  memberName,
  memberEmail,
  onSaved,
}: {
  memberId: string;
  memberName: string;
  memberEmail: string;
  onSaved?: () => void;
}) {
  const mutations = useSubadminMutations();
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ password: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    setSubmitting(true);
    try {
      await mutations.update(memberId, { password });
      toast.success("Password reset");
      setDone({ password });
      setPassword("");
      onSaved?.();
    } catch (err) {
      toast.error("Couldn't reset password", { description: errorMessage(err) });
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="space-y-3">
        <PasswordRevealCard
          heading={`${memberName} — New password`}
          email={memberEmail}
          password={done.password}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => setDone(null)}
          className="w-full"
        >
          Set another password
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3" noValidate>
      <Field
        id="rp-pw"
        label="New password"
        hint="Min 8 characters · shown once after saving."
      >
        <div className="relative">
          <Input
            id="rp-pw"
            type={visible ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            className="pr-10 font-mono"
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? "Hide password" : "Show password"}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            {visible ? (
              <EyeOff className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <Eye className="h-3.5 w-3.5" aria-hidden />
            )}
          </button>
        </div>
      </Field>
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={submitting}>
          {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Reset password
        </Button>
      </div>
    </form>
  );
}

function Header({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof UserIcon;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex items-start gap-2 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
      <span
        aria-hidden
        className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0">
        <h3 className="text-sm font-medium">{title}</h3>
        {description ? (
          <p className="mt-0.5 text-xs text-zinc-500">{description}</p>
        ) : null}
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-medium">
        {label}
      </Label>
      {children}
      {hint ? <p className="text-[11px] text-zinc-500">{hint}</p> : null}
    </div>
  );
}
