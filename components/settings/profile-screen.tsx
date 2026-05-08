"use client";

import { useEffect, useState } from "react";
import {
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Mail,
  ShieldCheck,
  UserCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/layout/page-header";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import {
  getInitials,
  roleLabel,
  teamDisplayName,
  teamDotClass,
} from "@/lib/format";
import { errorCode, errorMessage } from "@/lib/hooks/use-async";
import { useSalesUserMutations } from "@/lib/hooks/use-sales-users";

/**
 * /profile — the signed-in user's account page.
 *
 * Two stacked cards:
 *   1. Identity — name (editable), email (read-only), role, team, member ID
 *   2. Password — current + new + confirm, posts to PATCH /me/password
 *
 * Settings (theme + notifications) lives at /settings; this screen is
 * intentionally identity-only so it stays usable on smaller screens
 * without the user scrolling past unrelated controls.
 */
export function ProfileScreen() {
  const auth = useAuth();
  if (!auth.isLoaded) return <Skeleton />;
  if (!auth.user) {
    return (
      <div className="space-y-6">
        <PageHeader title="Profile" />
        <Card className="p-12 text-center text-sm text-zinc-500">
          You're signed out.
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Profile"
        description="Your account details and password."
      />
      <IdentityCard />
      <PasswordCard />
    </div>
  );
}

// ---------- Identity ----------

function IdentityCard() {
  const auth = useAuth();
  const user = auth.user!;
  const teamLabel = user.teamId ? teamDisplayName(user.teamId) : null;

  const [name, setName] = useState(user.name);
  const [submitting, setSubmitting] = useState(false);
  const { updateMyName } = useSalesUserMutations();

  useEffect(() => {
    setName(user.name);
  }, [user.name]);

  const dirty = name.trim() !== user.name.trim() && name.trim().length > 0;

  const handleSave = async () => {
    setSubmitting(true);
    try {
      await updateMyName(name.trim());
      await auth.refreshUser();
      toast.success("Profile saved");
    } catch (err) {
      toast.error("Couldn't save profile", {
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
          <UserCircle className="h-4 w-4 text-zinc-500" aria-hidden />
          Account
        </h2>
        <p className="text-sm text-zinc-500">
          Personal information visible across the dashboard.
        </p>
      </div>

      <div className="mt-6 flex items-start gap-4">
        <Avatar className="h-14 w-14">
          <AvatarFallback className="text-base">
            {getInitials(user.name)}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1 space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="profile-name">Full name</Label>
              <Input
                id="profile-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="profile-email">Email</Label>
              <div className="relative">
                <Mail
                  aria-hidden
                  className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400"
                />
                <Input
                  id="profile-email"
                  value={user.email || "—"}
                  readOnly
                  aria-readonly
                  className="cursor-not-allowed bg-zinc-50 pl-9 dark:bg-zinc-900"
                />
              </div>
              <p className="text-xs text-zinc-500">
                Contact your admin to change your email.
              </p>
            </div>
          </div>

          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Detail label="Role">
              <Badge
                variant="outline"
                className="inline-flex items-center gap-1"
              >
                <ShieldCheck className="h-3 w-3" aria-hidden />
                {roleLabel(user.role)}
              </Badge>
            </Detail>

            <Detail label="Team">
              {teamLabel ? (
                <span className="inline-flex items-center gap-1.5 text-sm">
                  <span
                    aria-hidden
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      teamDotClass(user.teamId),
                    )}
                  />
                  {teamLabel}
                </span>
              ) : (
                <span className="text-sm text-zinc-500">—</span>
              )}
            </Detail>

            <Detail label="Status">
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider",
                  user.status === "active"
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                    : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
                )}
              >
                {user.status === "active" ? "Active" : "Inactive"}
              </span>
            </Detail>

            <Detail label="Member ID">
              <span
                className="font-mono text-xs text-zinc-700 dark:text-zinc-300"
                title={user.id}
              >
                {user.id}
              </span>
            </Detail>

            <Detail label="Joined">
              <span className="text-sm tabular-nums">
                {formatDate(user.joinedAt)}
              </span>
            </Detail>

            <Detail label="Last active">
              <span className="text-sm tabular-nums">
                {formatDate(user.lastActiveAt)}
              </span>
            </Detail>
          </dl>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-end border-t border-zinc-100 pt-4 dark:border-zinc-800">
        <Button
          onClick={handleSave}
          disabled={!dirty || submitting}
          aria-label="Save profile changes"
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          Save changes
        </Button>
      </div>
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

// ---------- Password ----------

function PasswordCard() {
  const { changeMyPassword } = useSalesUserMutations();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState({ current: false, next: false, confirm: false });
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setCurrent("");
    setNext("");
    setConfirm("");
    setSubmitting(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!current || !next) {
      toast.error("Fill in both passwords.");
      return;
    }
    if (next.length < 8) {
      toast.error("New password must be at least 8 characters.");
      return;
    }
    if (next !== confirm) {
      toast.error("New password and confirmation don't match.");
      return;
    }
    if (next === current) {
      toast.error("Pick a new password — it can't match the current one.");
      return;
    }
    setSubmitting(true);
    try {
      await changeMyPassword({
        current_password: current,
        new_password: next,
      });
      toast.success("Password updated");
      reset();
    } catch (err) {
      toast.error("Couldn't change password", {
        description: errorMessage(err),
      });
      // BAD_CURRENT_PASSWORD: empty just the current field and refocus it so
      // the user can retype without clearing the new password they already
      // typed twice. Other codes leave the form alone so the user can amend.
      if (errorCode(err) === "BAD_CURRENT_PASSWORD") {
        setCurrent("");
        window.setTimeout(() => {
          document.getElementById("pw-current")?.focus();
        }, 0);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="p-6 sm:p-8">
      <div className="space-y-1">
        <h2 className="flex items-center gap-2 text-lg font-medium tracking-tight">
          <KeyRound className="h-4 w-4 text-zinc-500" aria-hidden />
          Password
        </h2>
        <p className="text-sm text-zinc-500">
          Update your password. You'll stay signed in on this device after
          the change.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
        <PasswordField
          id="pw-current"
          label="Current password"
          value={current}
          onChange={setCurrent}
          visible={show.current}
          onToggleVisibility={() =>
            setShow((s) => ({ ...s, current: !s.current }))
          }
          autoComplete="current-password"
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <PasswordField
            id="pw-new"
            label="New password"
            value={next}
            onChange={setNext}
            visible={show.next}
            onToggleVisibility={() =>
              setShow((s) => ({ ...s, next: !s.next }))
            }
            autoComplete="new-password"
            hint="Min 8 characters."
          />

          <PasswordField
            id="pw-confirm"
            label="Confirm new password"
            value={confirm}
            onChange={setConfirm}
            visible={show.confirm}
            onToggleVisibility={() =>
              setShow((s) => ({ ...s, confirm: !s.confirm }))
            }
            autoComplete="new-password"
          />
        </div>

        <div className="flex items-center justify-end border-t border-zinc-100 pt-4 dark:border-zinc-800">
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Update password
          </Button>
        </div>
      </form>
    </Card>
  );
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  visible,
  onToggleVisibility,
  autoComplete,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
  visible: boolean;
  onToggleVisibility: () => void;
  autoComplete: "current-password" | "new-password";
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          className="pr-10 font-mono"
        />
        <button
          type="button"
          onClick={onToggleVisibility}
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
      {hint ? <p className="text-xs text-zinc-500">{hint}</p> : null}
    </div>
  );
}

// ---------- Helpers ----------

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return "—";
  }
}

function Skeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-7 w-32 animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-800" />
        <div className="h-4 w-72 animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-800" />
      </div>
      <Card className="h-72 animate-pulse" />
      <Card className="h-56 animate-pulse" />
    </div>
  );
}
