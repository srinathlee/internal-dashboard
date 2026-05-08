"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Calendar,
  Clock,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Mail,
  Phone,
  Power,
  ShieldCheck,
  Target,
  Trash2,
  User as UserIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { getInitials } from "@/lib/format";
import { errorMessage } from "@/lib/hooks/use-async";
import { useSubadminMutations } from "@/lib/hooks/use-subadmins";
import type { ApiSubadmin } from "@/lib/api/types";

import { PasswordRevealCard } from "./password-reveal-card";

interface MemberDetailSheetProps {
  member: ApiSubadmin | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Refetch upstream after any mutation lands. */
  onMutated?: () => void;
}

/**
 * /teams/[teamId] member drill-in.
 *
 * Slides in from the right when the sales/super admin clicks a member row.
 * Surfaces every field the API exposes on `ApiSubadmin` plus the actions
 * the spec allows for SALES_ADMIN: edit profile (name/email/phone), edit
 * targets, reset password, toggle active/inactive. Hard delete stays in
 * the row dropdown for super admin only — it's intentionally absent here
 * so the sheet stays the same for both viewers.
 *
 * The form is dirty-tracked: Save button disables until at least one
 * field actually changes, and we reset state on every open so closing
 * mid-edit doesn't leak across members.
 */
export function MemberDetailSheet({
  member,
  open,
  onOpenChange,
  onMutated,
}: MemberDetailSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-md"
      >
        {member ? (
          <Body
            member={member}
            onMutated={onMutated}
            onClose={() => onOpenChange(false)}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function Body({
  member,
  onMutated,
  onClose,
}: {
  member: ApiSubadmin;
  onMutated?: () => void;
  onClose: () => void;
}) {
  const auth = useAuth();
  const isSuperAdmin = auth.user?.role === "super_admin";
  const mutations = useSubadminMutations();

  // ---- profile form ----
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

  // Re-seed every time the open member changes so the sheet doesn't show
  // stale data from a previously-selected member.
  useEffect(() => {
    setName(member.name);
    setEmail(member.email);
    setPhone(member.phone);
    setTarget(member.target_hospitals);
    setPeriod(member.target_period);
  }, [member.id, member.name, member.email, member.phone, member.target_hospitals, member.target_period]);

  const dirty = useMemo(() => {
    return (
      name.trim() !== member.name ||
      email.trim() !== member.email ||
      phone.trim() !== member.phone ||
      target !== member.target_hospitals ||
      period !== member.target_period
    );
  }, [
    name,
    email,
    phone,
    target,
    period,
    member.name,
    member.email,
    member.phone,
    member.target_hospitals,
    member.target_period,
  ]);

  const handleSaveProfile = async () => {
    if (!dirty) return;
    if (name.trim().length === 0) {
      toast.error("Name can't be empty.");
      return;
    }
    if (email.trim().length > 0 && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
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
      toast.error("Couldn't save changes", {
        description: errorMessage(err),
      });
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
      toast.success(next === "ACTIVE" ? "Member reactivated" : "Member deactivated");
      onMutated?.();
    } catch (err) {
      toast.error("Couldn't update status", {
        description: errorMessage(err),
      });
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
      onMutated?.();
      onClose();
    } catch (err) {
      toast.error("Couldn't delete member", {
        description: errorMessage(err),
      });
    } finally {
      setDeleting(false);
    }
  };

  const completionPct =
    member.target_hospitals > 0
      ? Math.min(
          100,
          Math.round((member.hospitals_done / member.target_hospitals) * 100),
        )
      : 0;

  return (
    <>
      {/* Header */}
      <div className="flex items-start gap-3 border-b border-zinc-200 px-6 pb-5 pt-6 pr-12 dark:border-zinc-800">
        <Avatar className="h-12 w-12">
          <AvatarFallback className="text-base">
            {getInitials(member.name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <SheetTitle className="truncate text-base font-semibold tracking-tight">
            {member.name}
          </SheetTitle>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500">
            <span className="inline-flex items-center gap-1 truncate">
              <Mail className="h-3 w-3" aria-hidden />
              {member.email || "—"}
            </span>
            {member.phone ? (
              <>
                <span className="text-zinc-300 dark:text-zinc-700">·</span>
                <span className="inline-flex items-center gap-1 font-mono">
                  <Phone className="h-3 w-3" aria-hidden />
                  {member.phone}
                </span>
              </>
            ) : null}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={member.status} />
            <Badge
              variant="outline"
              className="inline-flex items-center gap-1 text-[10px]"
            >
              <ShieldCheck className="h-3 w-3" aria-hidden />
              {member.role}
            </Badge>
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-2 border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
        <Stat label="Hospitals" value={`${member.hospitals_done}/${member.target_hospitals}`} hint={`${completionPct}% to target`} />
        <Stat label="Added" value={String(member.hospitals_added)} hint="This period" />
        <Stat
          label="Period"
          value={member.target_period.toLowerCase()}
          hint="Cycle"
        />
      </div>

      {/* Profile section */}
      <Section
        icon={UserIcon}
        title="Profile"
        description="Editable contact details. Changes apply immediately."
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field id="m-name" label="Full name">
            <Input
              id="m-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
          </Field>
          <Field id="m-email" label="Email">
            <Input
              id="m-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </Field>
          <Field id="m-phone" label="Phone">
            <Input
              id="m-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
              className="font-mono"
            />
          </Field>
        </div>
      </Section>

      {/* Targets section */}
      <Section
        icon={Target}
        title="Targets"
        description="How many hospitals this rep is expected to onboard each period."
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
          <Field id="m-period" label="Period">
            <Select
              value={period}
              onValueChange={(v) =>
                setPeriod(v as ApiSubadmin["target_period"])
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
      </Section>

      {/* Save profile + targets */}
      <div className="flex items-center justify-end gap-2 border-b border-zinc-200 bg-zinc-50/60 px-6 py-3 dark:border-zinc-800 dark:bg-zinc-900/40">
        <Button
          variant="outline"
          size="sm"
          disabled={!dirty || savingProfile}
          onClick={() => {
            setName(member.name);
            setEmail(member.email);
            setPhone(member.phone);
            setTarget(member.target_hospitals);
            setPeriod(member.target_period);
          }}
        >
          Reset
        </Button>
        <Button size="sm" disabled={!dirty || savingProfile} onClick={handleSaveProfile}>
          {savingProfile && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Save changes
        </Button>
      </div>

      {/* Password section */}
      <PasswordSection
        memberId={member.id}
        memberName={member.name}
        memberEmail={member.email}
        onSaved={onMutated}
      />

      {/* Account meta */}
      <Section icon={Clock} title="Account" description="Audit-only metadata.">
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Detail label="Member ID">
            <span className="font-mono text-xs" title={member.id}>
              {member.id}
            </span>
          </Detail>
          <Detail label="Joined">
            <span className="inline-flex items-center gap-1 text-sm">
              <Calendar className="h-3 w-3 text-zinc-400" aria-hidden />
              {formatDate(member.created_at)}
            </span>
          </Detail>
          <Detail label="Updated">
            <span className="text-sm">{formatDate(member.updated_at)}</span>
          </Detail>
          <Detail label="Status">
            <StatusBadge status={member.status} />
          </Detail>
        </dl>
      </Section>

      {/* Account actions */}
      <div className="mt-auto border-t border-zinc-200 bg-zinc-50/60 px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900/40">
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
    </>
  );
}

// ---------- Password section ----------

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
      toast.error("Couldn't reset password", {
        description: errorMessage(err),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Section
      icon={KeyRound}
      title="Password"
      description="Set a new password for this member. Share it with them once — it can't be retrieved later."
    >
      {done ? (
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
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3" noValidate>
          <Field id="m-pw" label="New password" hint="Min 8 characters · shown once after saving.">
            <div className="relative">
              <Input
                id="m-pw"
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
      )}
    </Section>
  );
}

// ---------- Subcomponents ----------

function Section({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof UserIcon;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-zinc-200 px-6 py-5 dark:border-zinc-800">
      <div className="mb-3 flex items-start gap-2">
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
      {children}
    </section>
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

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card className="px-3 py-2 shadow-none">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        {label}
      </div>
      <div className="mt-1 text-base font-semibold tabular-nums capitalize">
        {value}
      </div>
      {hint ? <div className="mt-0.5 text-[11px] text-zinc-500">{hint}</div> : null}
    </Card>
  );
}

function Detail({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        {label}
      </dt>
      <dd className="mt-1 truncate">{children}</dd>
    </div>
  );
}

function StatusBadge({ status }: { status: "ACTIVE" | "INACTIVE" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider",
        status === "ACTIVE"
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
          : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
      )}
    >
      {status === "ACTIVE" ? "Active" : "Inactive"}
    </span>
  );
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return "—";
  }
}
