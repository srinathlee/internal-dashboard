"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowLeft,
  Briefcase,
  Building2,
  Clock,
  GraduationCap,
  Loader2,
  Lock,
  Mail,
  Pencil,
  Phone,
  Stethoscope,
  Trash2,
  User as UserIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAsync, errorMessage } from "@/lib/hooks/use-async";
import { deleteUser, getUser, setUserStatus } from "@/lib/api/users";
import { cn } from "@/lib/utils";

export function UserDetailScreen({
  hospitalId,
  userId,
}: {
  hospitalId: string;
  userId: string;
}) {
  const router = useRouter();
  const userQuery = useAsync((signal) => getUser(userId, signal), [userId]);
  const [statusBusy, setStatusBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const backHref = `/hospitals/${hospitalId}`;

  if (userQuery.isLoading && !userQuery.data) {
    return <Skeleton />;
  }
  if (userQuery.error || !userQuery.data) {
    return (
      <div className="space-y-6">
        <BackLink href={backHref} />
        <Card className="border-rose-200 bg-rose-50 p-6 dark:border-rose-900/40 dark:bg-rose-950/40">
          <p className="text-sm text-rose-700 dark:text-rose-300">
            Couldn't load user: {errorMessage(userQuery.error)}
          </p>
        </Card>
      </div>
    );
  }

  const user = userQuery.data;
  const status = (user.status ?? "ACTIVE").toUpperCase();
  const isActive = status === "ACTIVE";
  const roleLabel = user.role ?? "USER";
  const roleHeading = roleLabel
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
  const isDoctor = roleLabel.toUpperCase() === "DOCTOR";

  const handleToggleStatus = async () => {
    const next = isActive ? "inactive" : "active";
    setStatusBusy(true);
    try {
      await setUserStatus(user.id, next);
      toast.success(next === "active" ? "User enabled" : "User disabled");
      void userQuery.refetch();
    } catch (err) {
      toast.error("Couldn't update status", { description: errorMessage(err) });
    } finally {
      setStatusBusy(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteUser(user.id);
      toast.success("User deleted");
      setDeleteOpen(false);
      router.push(backHref);
    } catch (err) {
      toast.error("Couldn't delete user", { description: errorMessage(err) });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <BackLink href={backHref} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">
            {roleHeading} Details
          </h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            View and manage {roleHeading.toLowerCase()} information
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusPill status={status} />
          <Button
            asChild
            size="sm"
            className="bg-sky-600 hover:bg-sky-700"
          >
            <Link href={`/hospitals/${hospitalId}/users/${user.id}/edit`}>
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4">
          <Card className="p-5">
            <h2 className="text-base font-semibold">Quick Actions</h2>
            <div className="mt-4 space-y-2">
              <Button
                asChild
                className="w-full justify-center bg-sky-600 hover:bg-sky-700"
              >
                <Link href={`/hospitals/${hospitalId}/users/${user.id}/edit`}>
                  <Pencil className="h-3.5 w-3.5" />
                  Edit User
                </Link>
              </Button>
              <Button
                onClick={handleToggleStatus}
                disabled={statusBusy}
                className={cn(
                  "w-full justify-center",
                  isActive
                    ? "bg-amber-500 hover:bg-amber-600 text-white"
                    : "bg-emerald-600 hover:bg-emerald-700",
                )}
              >
                {statusBusy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Lock className="h-3.5 w-3.5" />
                )}
                {isActive ? "Disable User" : "Enable User"}
              </Button>
              <Button
                onClick={() => setDeleteOpen(true)}
                className="w-full justify-center bg-rose-600 hover:bg-rose-700"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete User
              </Button>
            </div>
          </Card>
        </div>

        <div className="space-y-4 lg:col-span-2">
          <Card className="p-5">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <UserIcon className="h-4 w-4 text-zinc-500" aria-hidden />
              Basic Information
            </h2>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Name" value={user.name ?? "—"} />
              <Field label="Username" value={user.username ?? "—"} />
              <Field label="Role" value={<span className="font-medium">{roleLabel}</span>} />
              <Field label="Status" value={<span className="font-medium">{status}</span>} />
              <Field
                label="Phone"
                value={
                  user.phone ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 text-zinc-400" aria-hidden />
                      {user.phone}
                    </span>
                  ) : (
                    "—"
                  )
                }
              />
              <Field
                label="Email"
                value={
                  user.email ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5 text-zinc-400" aria-hidden />
                      {user.email}
                    </span>
                  ) : (
                    "—"
                  )
                }
              />
              <Field
                label="Joined Date"
                value={user.joined_at ? fmtDate(user.joined_at) : user.created_at ? fmtDate(user.created_at) : "—"}
              />
            </div>
          </Card>

          {isDoctor ? (
            <Card className="p-5">
              <h2 className="flex items-center gap-2 text-base font-semibold">
                <Stethoscope className="h-4 w-4 text-zinc-500" aria-hidden />
                Professional Details
              </h2>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field
                  label={
                    <span className="inline-flex items-center gap-1.5">
                      <Activity className="h-3.5 w-3.5 text-zinc-400" aria-hidden />
                      Specialization
                    </span>
                  }
                  value={user.specialty ?? "—"}
                />
                <Field
                  label={
                    <span className="inline-flex items-center gap-1.5">
                      <GraduationCap className="h-3.5 w-3.5 text-zinc-400" aria-hidden />
                      Qualification
                    </span>
                  }
                  value={user.qualification ?? "—"}
                />
                <Field
                  label={
                    <span className="inline-flex items-center gap-1.5">
                      <Briefcase className="h-3.5 w-3.5 text-zinc-400" aria-hidden />
                      Experience
                    </span>
                  }
                  value={
                    typeof user.experience_years === "number"
                      ? `${user.experience_years} years`
                      : user.experience ?? "—"
                  }
                />
                <Field
                  label={
                    <span className="inline-flex items-center gap-1.5">
                      <Activity className="h-3.5 w-3.5 text-zinc-400" aria-hidden />
                      OP Charge
                    </span>
                  }
                  value={
                    typeof user.op_fee === "number"
                      ? `₹${user.op_fee}`
                      : "—"
                  }
                />
                <Field
                  label={
                    <span className="inline-flex items-center gap-1.5">
                      <Activity className="h-3.5 w-3.5 text-zinc-400" aria-hidden />
                      Follow-up Charge
                    </span>
                  }
                  value={
                    typeof user.followup_fee === "number"
                      ? `₹${user.followup_fee}`
                      : "—"
                  }
                />
                <Field
                  label={
                    <span className="inline-flex items-center gap-1.5">
                      <Activity className="h-3.5 w-3.5 text-zinc-400" aria-hidden />
                      Emergency Charge
                    </span>
                  }
                  value={
                    typeof user.emergency_fee === "number"
                      ? `₹${user.emergency_fee}`
                      : "—"
                  }
                />
                <Field
                  label={
                    <span className="inline-flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5 text-zinc-400" aria-hidden />
                      Department
                    </span>
                  }
                  value={user.department ?? "—"}
                />
              </div>
            </Card>
          ) : null}

          <Card className="p-5">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <Clock className="h-4 w-4 text-zinc-500" aria-hidden />
              Additional Information
            </h2>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                label="Created At"
                value={user.created_at ? fmtDateTime(user.created_at) : "—"}
              />
              <Field
                label="Last Updated"
                value={user.updated_at ? fmtDateTime(user.updated_at) : "—"}
              />
              <Field
                label="Last Login"
                value={user.last_login_at ? fmtDateTime(user.last_login_at) : "Never"}
              />
            </div>
          </Card>
        </div>
      </div>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-700 dark:text-rose-300">
              <Trash2 className="h-4 w-4" aria-hidden />
              Delete user
            </DialogTitle>
            <DialogDescription>
              This permanently deletes <strong>{user.name ?? "this user"}</strong>.
              They will no longer be able to log in.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="bg-rose-600 hover:bg-rose-700"
            >
              {deleting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : null}
              Delete user
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BackLink({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:hover:text-zinc-50"
    >
      <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
      Go Back
    </Link>
  );
}

function StatusPill({ status }: { status: string }) {
  const active = status.toUpperCase() === "ACTIVE";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 self-start rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wider",
        active
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
          : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          active ? "bg-emerald-500" : "bg-zinc-400",
        )}
      />
      {status.toUpperCase()}
    </span>
  );
}

function Field({
  label,
  value,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="mt-1 truncate text-sm">{value}</div>
    </div>
  );
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Skeleton() {
  return (
    <div className="space-y-6">
      <div className="h-4 w-24 animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-800" />
      <div className="h-8 w-72 animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-800" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="h-48 animate-pulse lg:col-span-1" />
        <Card className="h-60 animate-pulse lg:col-span-2" />
      </div>
    </div>
  );
}

