"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronRight,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Mail,
  Pencil,
  Phone,
  Trash2,
  UserCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { isSalesAdminOrSuperAdmin } from "@/lib/access";
import { getInitials } from "@/lib/format";
import { errorMessage } from "@/lib/hooks/use-async";
import { useAcpMember, useAcpMutations } from "@/lib/hooks/use-accelerator";
import type {
  AcpMember,
  UpdateAcpMemberInput,
} from "@/lib/api/sales-accelerator";
import { ApiError } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { PasswordRevealCard } from "@/components/teams/password-reveal-card";

import { acpFmt, getRepWeek, TAG_META } from "./acp-shared";

/**
 * Account view for a single Accelerator rep — reachable from the "Profile"
 * button on the rep profile. Shows the rep's read-only account details and
 * lets an admin set a new login password directly (no current password,
 * since the admin is resetting it on the rep's behalf).
 */
export function RepAccountScreen({
  batchId,
  repId,
}: {
  batchId: string;
  repId: string;
}) {
  const auth = useAuth();
  const member = useAcpMember(repId);
  const m = member.data;

  if (!auth.isLoaded) {
    return (
      <div className="space-y-6">
        <Card className="h-24 animate-pulse" />
        <Card className="h-64 animate-pulse" />
      </div>
    );
  }

  if (!isSalesAdminOrSuperAdmin(auth)) {
    return (
      <Card className="p-12 text-center text-sm text-zinc-500">
        The Accelerator program is managed by sales admins and super admins.
      </Card>
    );
  }

  const fired = m?.status === "inactive" || m?.tag === "fired";

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-zinc-500">
        <Link
          href="/sales/accelerator"
          className="transition-colors hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          All batches
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        <Link
          href={`/sales/accelerator/${batchId}`}
          className="transition-colors hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          {m?.batch_name ?? "Batch"}
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        <Link
          href={`/sales/accelerator/${batchId}/${repId}`}
          className="transition-colors hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          {m?.name ?? "Rep"}
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        <span className="font-medium text-zinc-900 dark:text-zinc-100">
          Profile
        </span>
      </div>

      {member.error ? (
        <Card className="p-8 text-center text-sm text-rose-600 dark:text-rose-400">
          Couldn&apos;t load rep: {errorMessage(member.error)}
        </Card>
      ) : !m ? (
        <div className="space-y-6">
          <Card className="h-24 animate-pulse" />
          <Card className="h-64 animate-pulse" />
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="flex flex-wrap items-center gap-4">
            <Avatar className="h-14 w-14">
              <AvatarFallback className="bg-violet-100 text-base text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">
                {getInitials(m.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-bold tracking-tight">{m.name}</h1>
                <span
                  className={cn(
                    "rounded-md px-2 py-0.5 text-xs font-semibold",
                    TAG_META[fired ? "fired" : "active"].badge,
                  )}
                >
                  {fired ? "Fired" : "Active"}
                </span>
              </div>
              <div className="mt-1 text-sm text-zinc-500">
                {m.email || "No email on file"}
              </div>
            </div>
          </div>

          {/* Account details — admin-editable name / phone / targets. */}
          <AccountDetailsCard
            member={m}
            onUpdated={() => void member.refetch()}
          />

          {/* Set password */}
          <SetPasswordCard
            repId={repId}
            repName={m.name}
            repEmail={m.email}
          />

          {/* Danger zone — remove from program */}
          <RemoveFromProgramCard
            repId={repId}
            repName={m.name}
            batchId={batchId}
          />
        </>
      )}
    </div>
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
    <div className="min-w-0">
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        {label}
      </dt>
      <dd className="mt-1 truncate">{children}</dd>
    </div>
  );
}

/**
 * Account details card. Click **Edit** to turn `name` / `phone` /
 * `sprint_target` / `revenue_target` into inputs; **Save** PATCHes the member
 * and re-fetches. Email and program/batch info stay read-only on purpose —
 * email is the login identifier, and joined-at / program week / member id are
 * either historical or system-derived.
 */
function AccountDetailsCard({
  member,
  onUpdated,
}: {
  member: AcpMember;
  onUpdated: () => void;
}) {
  const { updateMember } = useAcpMutations();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(member.name);
  const [email, setEmail] = useState(member.email ?? "");
  const [phone, setPhone] = useState(member.phone ?? "");
  const [sprintTarget, setSprintTarget] = useState(
    String(member.sprint_target),
  );
  const [revenueTarget, setRevenueTarget] = useState(
    String(member.revenue_target),
  );

  // Business-day program position from joined_at (Sunday skipped) — see
  // docs/backend-acp-business-day-program-position.md.
  const repWeek = getRepWeek(member.joined_at);

  const enterEdit = () => {
    setName(member.name);
    setEmail(member.email ?? "");
    setPhone(member.phone ?? "");
    setSprintTarget(String(member.sprint_target));
    setRevenueTarget(String(member.revenue_target));
    setEditing(true);
  };

  const cancel = () => setEditing(false);

  const save = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("Full name is required");
      return;
    }
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      toast.error("Email is required");
      return;
    }
    // Cheap shape check — the backend still enforces real format + uniqueness.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      toast.error("Enter a valid email address");
      return;
    }
    const sprintN = Number(sprintTarget);
    const revenueN = Number(revenueTarget);
    if (
      !Number.isFinite(sprintN) ||
      sprintN <= 0 ||
      !Number.isInteger(sprintN)
    ) {
      toast.error("Sprint target must be a positive whole number");
      return;
    }
    if (
      !Number.isFinite(revenueN) ||
      revenueN <= 0 ||
      !Number.isInteger(revenueN)
    ) {
      toast.error("Revenue target must be a positive whole number");
      return;
    }

    // Send only the fields that actually changed — keeps the audit trail clean
    // and lets the backend skip work it doesn't need to do.
    const patch: UpdateAcpMemberInput = {};
    if (trimmedName !== member.name) patch.name = trimmedName;
    // Compare emails case-insensitively so toggling case alone isn't a write.
    if (
      trimmedEmail.toLowerCase() !== (member.email ?? "").toLowerCase()
    ) {
      patch.email = trimmedEmail;
    }
    const trimmedPhone = phone.trim();
    if (trimmedPhone !== (member.phone ?? "")) patch.phone = trimmedPhone;
    if (sprintN !== member.sprint_target) patch.sprint_target = sprintN;
    if (revenueN !== member.revenue_target) patch.revenue_target = revenueN;

    if (Object.keys(patch).length === 0) {
      setEditing(false);
      return;
    }

    setSaving(true);
    try {
      await updateMember(member.id, patch);
      toast.success("Profile updated", {
        description: `${trimmedName}'s account details have been saved.`,
      });
      onUpdated();
      setEditing(false);
    } catch (err) {
      // The server returns `code: "EMAIL_TAKEN"` (409) when the requested email
      // is already in use by another login — surface that precisely so the
      // admin knows it's the email that needs to change, not retry-the-same.
      if (err instanceof ApiError && err.code === "EMAIL_TAKEN") {
        toast.error("Email already in use", {
          description:
            "That email belongs to another login — try a different one.",
        });
      } else {
        toast.error("Couldn't update profile", {
          description: errorMessage(err),
        });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="flex items-center gap-2 text-lg font-medium tracking-tight">
            <UserCircle className="h-4 w-4 text-zinc-500" aria-hidden />
            Account details
          </h2>
          <p className="text-sm text-zinc-500">
            {editing
              ? "Edit the rep's name, email, phone, or targets. Joined date, program week, batch and member ID stay fixed."
              : "Update the rep's name, email, phone, or targets. Joined date, program week, batch and member ID stay fixed."}
          </p>
        </div>
        {!editing ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={enterEdit}
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden />
            Edit
          </Button>
        ) : null}
      </div>

      <dl className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <Detail label="Full name">
          {editing ? (
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-9 text-sm"
              placeholder="Enter name"
              autoFocus
            />
          ) : (
            <span className="text-sm">{member.name}</span>
          )}
        </Detail>
        <Detail label="Email">
          {editing ? (
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-9 text-sm"
              placeholder="name@email.com"
              autoComplete="off"
              spellCheck={false}
            />
          ) : (
            <span className="inline-flex items-center gap-1.5 text-sm">
              <Mail className="h-3.5 w-3.5 text-zinc-400" aria-hidden />
              {member.email || "—"}
            </span>
          )}
        </Detail>
        <Detail label="Phone">
          {editing ? (
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="h-9 text-sm"
              placeholder="+91 98765 43210"
            />
          ) : (
            <span className="inline-flex items-center gap-1.5 text-sm">
              <Phone className="h-3.5 w-3.5 text-zinc-400" aria-hidden />
              {member.phone || "—"}
            </span>
          )}
        </Detail>
        <Detail label="Batch">
          <span className="text-sm">{member.batch_name ?? "—"}</span>
        </Detail>
        <Detail label="Joined">
          <span className="text-sm tabular-nums">
            {member.joined_at.slice(0, 10)}
          </span>
        </Detail>
        <Detail label="Program week">
          <span className="text-sm tabular-nums">
            {`M${repWeek.month} · W${repWeek.week} Day ${repWeek.dayInWeek}`}
          </span>
        </Detail>
        <Detail label="Sprint target">
          {editing ? (
            <div className="relative">
              <span
                aria-hidden
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-zinc-400"
              >
                ₹
              </span>
              <Input
                type="number"
                min="1"
                step="1"
                value={sprintTarget}
                onChange={(e) => setSprintTarget(e.target.value)}
                className="h-9 pl-6 text-sm tabular-nums"
              />
            </div>
          ) : (
            <span className="text-sm tabular-nums">
              {acpFmt(member.sprint_target)}
            </span>
          )}
        </Detail>
        <Detail label="Revenue target">
          {editing ? (
            <div className="relative">
              <span
                aria-hidden
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-zinc-400"
              >
                ₹
              </span>
              <Input
                type="number"
                min="1"
                step="1"
                value={revenueTarget}
                onChange={(e) => setRevenueTarget(e.target.value)}
                className="h-9 pl-6 text-sm tabular-nums"
              />
            </div>
          ) : (
            <span className="text-sm tabular-nums">
              {acpFmt(member.revenue_target)}
            </span>
          )}
        </Detail>
        <Detail label="Member ID">
          <span
            className="font-mono text-xs text-zinc-700 dark:text-zinc-300"
            title={member.id}
          >
            {member.id}
          </span>
        </Detail>
      </dl>

      {editing ? (
        <div className="mt-6 flex items-center justify-end gap-2 border-t border-zinc-100 pt-4 dark:border-zinc-800">
          <Button
            type="button"
            variant="outline"
            onClick={cancel}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button type="button" onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save changes
          </Button>
        </div>
      ) : null}
    </Card>
  );
}

function SetPasswordCard({
  repId,
  repName,
  repEmail,
}: {
  repId: string;
  repName: string;
  repEmail: string;
}) {
  const { setPassword } = useAcpMutations();
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // The password we just set, shown once for handoff. The rep's *existing*
  // password can't be displayed — it's stored hashed (one-way) — so this is
  // the only point at which a value is visible.
  const [done, setDone] = useState<{ password: string } | null>(null);

  const resetForm = () => {
    setNext("");
    setConfirm("");
    setShow(false);
    setDone(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next.length < 8) {
      toast.error("New password must be at least 8 characters.");
      return;
    }
    if (next !== confirm) {
      toast.error("New password and confirmation don't match.");
      return;
    }
    setSubmitting(true);
    try {
      await setPassword(repId, next);
      toast.success("Password updated", {
        description: `${repName} can now sign in with the new password.`,
      });
      setDone({ password: next });
    } catch (err) {
      toast.error("Couldn't update password", {
        description: errorMessage(err),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="p-6 sm:p-8">
      <div className="space-y-1">
        <h2 className="flex items-center gap-2 text-lg font-medium tracking-tight">
          <KeyRound className="h-4 w-4 text-zinc-500" aria-hidden />
          Set password
        </h2>
        <p className="text-sm text-zinc-500">
          Set a new login password for this rep. As an admin you don&apos;t need
          their current password — share the new one with them after saving.
        </p>
      </div>

      {done ? (
        <div className="mt-6 space-y-4">
          <PasswordRevealCard
            heading="New password"
            email={repEmail || repName}
            password={done.password}
          />
          <div className="flex items-center justify-end">
            <Button type="button" variant="outline" onClick={resetForm}>
              Set another password
            </Button>
          </div>
        </div>
      ) : (
      <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="acp-pw-new">New password</Label>
            <div className="relative">
              <Input
                id="acp-pw-new"
                type={show ? "text" : "password"}
                value={next}
                onChange={(e) => setNext(e.target.value)}
                autoComplete="new-password"
                className="pr-10 font-mono"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                aria-label={show ? "Hide password" : "Show password"}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              >
                {show ? (
                  <EyeOff className="h-3.5 w-3.5" aria-hidden />
                ) : (
                  <Eye className="h-3.5 w-3.5" aria-hidden />
                )}
              </button>
            </div>
            <p className="text-xs text-zinc-500">Min 8 characters.</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="acp-pw-confirm">Confirm new password</Label>
            <Input
              id="acp-pw-confirm"
              type={show ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              className="font-mono"
            />
          </div>
        </div>

        <div className="flex items-center justify-end border-t border-zinc-100 pt-4 dark:border-zinc-800">
          <Button
            type="submit"
            disabled={submitting || next.length === 0 || confirm.length === 0}
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Update password
          </Button>
        </div>
      </form>
      )}
    </Card>
  );
}

/**
 * Danger zone — un-enrolls the rep from the Accelerator program. Their sales
 * login and pipeline leads are preserved; only their ACP membership, daily
 * logs, sprints and coaching messages are removed (see
 * docs/backend-acp-delete-rep-and-lead.md). This is distinct from "Fire" (the
 * status dropdown on the rep profile), which only disables login. On success
 * we navigate back to the batch, whose member list re-fetches without the rep.
 */
function RemoveFromProgramCard({
  repId,
  repName,
  batchId,
}: {
  repId: string;
  repName: string;
  batchId: string;
}) {
  const router = useRouter();
  const { deleteMember } = useAcpMutations();
  const [removing, setRemoving] = useState(false);

  const handleRemove = async () => {
    const confirmed = window.confirm(
      `Remove ${repName} from the program?\n\nTheir sales account and pipeline leads are preserved — only their Accelerator membership, daily logs and sprints are removed. This can't be undone.`,
    );
    if (!confirmed) return;

    setRemoving(true);
    try {
      await deleteMember(repId);
      toast.success(`${repName} removed from program`, {
        description: "Their sales account and leads were preserved.",
      });
      router.push(`/sales/accelerator/${batchId}`);
      // Don't clear `removing` — the component unmounts on navigation.
    } catch (err) {
      toast.error("Couldn't remove rep", { description: errorMessage(err) });
      setRemoving(false);
    }
  };

  return (
    <Card className="border-rose-200 p-6 dark:border-rose-900/40 sm:p-8">
      <div className="space-y-1">
        <h2 className="flex items-center gap-2 text-lg font-medium tracking-tight text-rose-700 dark:text-rose-400">
          <Trash2 className="h-4 w-4" aria-hidden />
          Remove from program
        </h2>
        <p className="text-sm text-zinc-500">
          Un-enrolls {repName} from the Accelerator and removes their daily
          logs, sprints and coaching messages. Their sales login and pipeline
          leads stay intact. To only disable login, set their status to
          &ldquo;Fired&rdquo; on the profile instead.
        </p>
      </div>

      <div className="mt-6 flex items-center justify-end border-t border-zinc-100 pt-4 dark:border-zinc-800">
        <Button
          type="button"
          variant="destructive"
          onClick={handleRemove}
          disabled={removing}
        >
          {removing ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Trash2 className="h-4 w-4" aria-hidden />
          )}
          Remove from program
        </Button>
      </div>
    </Card>
  );
}
