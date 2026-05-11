"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Loader2,
  ShieldCheck,
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
import { useHospital } from "@/lib/hooks/use-hospitals";
import { createHospitalAdmin } from "@/lib/api/users";
import { errorMessage } from "@/lib/hooks/use-async";
import { cn } from "@/lib/utils";

export function CreateHospitalAdminScreen({
  hospitalId,
}: {
  hospitalId: string;
}) {
  const router = useRouter();
  const hospital = useHospital(hospitalId);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const backHref = `/hospitals/${hospitalId}`;

  const validate = (): string | null => {
    if (!name.trim()) return "Name is required.";
    if (!email.trim()) return "Email is required.";
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return "Email looks invalid.";
    if (!phone.trim()) return "Phone is required.";
    if (!/^\d{10}$/.test(phone.replace(/\D/g, "").slice(-10))) {
      return "Phone must be a 10-digit number.";
    }
    if (!password) return "Password is required.";
    if (password.length < 8) return "Password must be at least 8 characters.";
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
      const phoneDigits = phone.replace(/\D/g, "").slice(-10);
      await createHospitalAdmin({
        name: name.trim(),
        email: email.trim(),
        phone: `+91${phoneDigits}`,
        password,
        hospital_id: hospitalId,
        status,
      });
      toast.success("Hospital admin created");
      router.push(backHref);
    } catch (err2) {
      toast.error("Couldn't create admin", {
        description: errorMessage(err2),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const hospitalName = hospital.data?.name ?? "this hospital";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:hover:text-zinc-50"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Back to hospital
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Create Hospital Admin
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Add a new admin for {hospitalName}
        </p>
      </div>

      <Card className="p-6 sm:p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="grid h-7 w-7 place-items-center rounded-md bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
            </span>
            <h2 className="text-base font-semibold">Admin Information</h2>
          </div>

          <div className="border-t border-zinc-100 dark:border-zinc-800" />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Name" required>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                placeholder="Full name"
              />
            </Field>
            <Field label="Email" required>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="admin@hospital.com"
              />
            </Field>
            <Field label="Phone" required hint="Enter 10-digit mobile number">
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                inputMode="numeric"
                placeholder="10-digit number"
              />
            </Field>
            <Field label="Status">
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as "active" | "inactive")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label="Password" required>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                className="pr-10"
                placeholder="Min 8 characters"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              >
                {showPassword ? (
                  <EyeOff className="h-3.5 w-3.5" aria-hidden />
                ) : (
                  <Eye className="h-3.5 w-3.5" aria-hidden />
                )}
              </button>
            </div>
          </Field>

          <div className="border-t border-zinc-100 dark:border-zinc-800" />

          <div className="flex items-center justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push(backHref)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-sky-600 hover:bg-sky-700"
            >
              {submitting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : null}
              Create Admin
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function Field({
  label,
  required = false,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className={cn("text-sm font-medium")}>
        {label}
        {required ? <span className="ml-0.5 text-rose-500">*</span> : null}
      </Label>
      {children}
      {hint ? <p className="text-xs text-zinc-500">{hint}</p> : null}
    </div>
  );
}
