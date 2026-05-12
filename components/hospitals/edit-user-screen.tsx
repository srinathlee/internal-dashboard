"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Briefcase,
  Building2,
  GraduationCap,
  IndianRupee,
  Loader2,
  Lock,
  Mail,
  Phone,
  Stethoscope,
  Upload,
  User as UserIcon,
  Users,
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
import { useAsync, errorMessage } from "@/lib/hooks/use-async";
import { getUser, updateUser } from "@/lib/api/users";
import { uploadFile } from "@/lib/api/hospitals";
import { listBranchesForHospital } from "@/lib/api/branches";

// Backend-accepted roles (see backend validation error).
const ROLES = [
  { value: "SUPER_ADMIN", label: "Super Admin" },
  { value: "SALES_ADMIN", label: "Sales Admin" },
  { value: "SALES_SUBADMIN", label: "Sales Subadmin" },
  { value: "DEV_ADMIN", label: "Dev Admin" },
  { value: "DEV_MEMBER", label: "Dev Member" },
  { value: "HOSPITAL_ADMIN", label: "Hospital Admin" },
  { value: "BRANCH_ADMIN", label: "Branch Admin" },
  { value: "DOCTOR", label: "Doctor" },
  { value: "NURSE", label: "Nurse" },
  { value: "RECEPTIONIST", label: "Receptionist" },
  { value: "LAB_TECH", label: "Lab Tech" },
  { value: "PHARMACIST", label: "Pharmacist" },
  { value: "PHARMACY", label: "Pharmacy" },
  { value: "BILLING", label: "Billing" },
  { value: "PATIENT", label: "Patient" },
  { value: "CONTENT_ADMIN", label: "Content Admin" },
  { value: "CONTENT_EDITOR", label: "Content Editor" },
  { value: "CONTENT_VIEWER", label: "Content Viewer" },
];

export function EditUserScreen({
  hospitalId,
  userId,
}: {
  hospitalId: string;
  userId: string;
}) {
  const router = useRouter();
  const userQuery = useAsync((signal) => getUser(userId, signal), [userId]);
  const branchesQuery = useAsync(
    (signal) => listBranchesForHospital(hospitalId, signal).catch(() => []),
    [hospitalId],
  );

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [branchId, setBranchId] = useState<string>("");
  const [imageUrl, setImageUrl] = useState("");
  const [password, setPassword] = useState("");

  // Doctor-specific
  const [specialty, setSpecialty] = useState("");
  const [qualification, setQualification] = useState("");
  const [experience, setExperience] = useState("");
  const [department, setDepartment] = useState("");
  const [opCharge, setOpCharge] = useState("");
  const [followupCharge, setFollowupCharge] = useState("");
  const [emergencyCharge, setEmergencyCharge] = useState("");

  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const backHref = `/hospitals/${hospitalId}/users/${userId}`;
  const isDoctor = role === "DOCTOR";

  useEffect(() => {
    if (!userQuery.data) return;
    const u = userQuery.data;
    setName(u.name ?? "");
    setUsername(u.username ?? "");
    setEmail(u.email ?? "");
    setPhone(u.phone ?? "");
    setRole(((u.role ?? "") as string).toUpperCase());
    setStatus(
      (u.status ?? "active").toLowerCase() === "inactive"
        ? "inactive"
        : "active",
    );
    setBranchId(u.branch_id ?? "");
    setImageUrl(u.profile_image_url ?? "");
    setSpecialty(u.specialty ?? "");
    setQualification(u.qualification ?? "");
    setExperience(
      typeof u.experience_years === "number"
        ? String(u.experience_years)
        : u.experience ?? "",
    );
    setDepartment(u.department ?? "");
    setOpCharge(
      typeof u.op_fee === "number" ? String(u.op_fee) : "",
    );
    setFollowupCharge(
      typeof u.followup_fee === "number" ? String(u.followup_fee) : "",
    );
    setEmergencyCharge(
      typeof u.emergency_fee === "number" ? String(u.emergency_fee) : "",
    );
  }, [userQuery.data]);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const result = await uploadFile(file, "user-profiles");
      setImageUrl(result.url);
      toast.success("Image uploaded");
    } catch (err) {
      toast.error("Couldn't upload image", { description: errorMessage(err) });
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (!email.trim()) {
      toast.error("Email is required");
      return;
    }
    if (!phone.trim()) {
      toast.error("Phone is required");
      return;
    }
    if (!role) {
      toast.error("Role is required");
      return;
    }
    setSubmitting(true);
    try {
      const expNum = Number(experience);
      await updateUser(userId, {
        name: name.trim(),
        username: username.trim() || null,
        email: email.trim(),
        phone: phone.trim(),
        role,
        status,
        branch_id: branchId || null,
        profile_image_url: imageUrl || null,
        password: password || undefined,
        ...(isDoctor
          ? {
              specialty: specialty.trim() || null,
              qualification: qualification.trim() || null,
              experience_years:
                Number.isFinite(expNum) && expNum > 0 ? expNum : null,
              department: department.trim() || null,
              op_fee:
                opCharge.trim() === "" ? null : Number(opCharge),
              followup_fee:
                followupCharge.trim() === "" ? null : Number(followupCharge),
              emergency_fee:
                emergencyCharge.trim() === ""
                  ? null
                  : Number(emergencyCharge),
            }
          : {}),
      });
      toast.success("User updated");
      router.push(backHref);
    } catch (err) {
      toast.error("Couldn't update user", { description: errorMessage(err) });
    } finally {
      setSubmitting(false);
    }
  };

  if (userQuery.isLoading && !userQuery.data) {
    return (
      <div className="space-y-6">
        <div className="h-4 w-24 animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-800" />
        <Card className="h-96 animate-pulse" />
      </div>
    );
  }
  if (userQuery.error) {
    return (
      <div className="space-y-6">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:hover:text-zinc-50"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Go Back
        </Link>
        <Card className="border-rose-200 bg-rose-50 p-6 dark:border-rose-900/40 dark:bg-rose-950/40">
          <p className="text-sm text-rose-700 dark:text-rose-300">
            Couldn't load user: {errorMessage(userQuery.error)}
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:hover:text-zinc-50"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
        Go Back
      </Link>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Edit {role || "User"}
        </h1>
        <p className="mt-0.5 text-sm text-zinc-500">
          Update {role ? role.toLowerCase().replace(/_/g, " ") : "user"} details
          below
        </p>
      </div>

      <Card className="p-6 sm:p-8">
        <form onSubmit={handleSubmit} className="space-y-5">
          <Field label="Full Name" required>
            <IconInput
              icon={UserIcon}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
            />
          </Field>

          <Field label="Username" required>
            <IconInput
              icon={UserIcon}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
            />
          </Field>

          <Field label="Email Address" required>
            <IconInput
              icon={Mail}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
            />
          </Field>

          <Field label="Phone Number" required>
            <IconInput
              icon={Phone}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone number"
            />
          </Field>

          <Field label="Role" required>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="h-10">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-zinc-400" aria-hidden />
                  <SelectValue />
                </div>
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Status">
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as "active" | "inactive")}
            >
              <SelectTrigger className="h-10">
                <div className="flex items-center gap-2">
                  <UserIcon className="h-4 w-4 text-zinc-400" aria-hidden />
                  <SelectValue />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field label="Branch">
            <Select
              value={branchId || "__none__"}
              onValueChange={(v) => setBranchId(v === "__none__" ? "" : v)}
            >
              <SelectTrigger className="h-10">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-zinc-400" aria-hidden />
                  <SelectValue placeholder="Select Branch" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No branch</SelectItem>
                {(branchesQuery.data ?? []).map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {isDoctor ? (
            <>
              <div className="border-t border-zinc-100 pt-5 dark:border-zinc-800">
                <h2 className="text-base font-semibold">Doctor Details</h2>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Specialty">
                  <IconInput
                    icon={Stethoscope}
                    value={specialty}
                    onChange={(e) => setSpecialty(e.target.value)}
                    placeholder="e.g. Cardiologist"
                  />
                </Field>
                <Field label="Qualification">
                  <IconInput
                    icon={GraduationCap}
                    value={qualification}
                    onChange={(e) => setQualification(e.target.value)}
                    placeholder="e.g. MBBS, MD"
                  />
                </Field>
                <Field label="Experience">
                  <IconInput
                    icon={Briefcase}
                    value={experience}
                    onChange={(e) => setExperience(e.target.value)}
                    placeholder="e.g. 5 years"
                  />
                </Field>
                <Field label="Department">
                  <IconInput
                    icon={Building2}
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="e.g. dentist"
                  />
                </Field>
                <Field label="Default OP Charge (₹)">
                  <CurrencyInput
                    value={opCharge}
                    onChange={setOpCharge}
                    placeholder="e.g. 500"
                  />
                </Field>
                <Field label="Default Follow-up Charge (₹)">
                  <CurrencyInput
                    value={followupCharge}
                    onChange={setFollowupCharge}
                    placeholder="e.g. 300"
                  />
                </Field>
                <Field label="Default Emergency Charge (₹)">
                  <CurrencyInput
                    value={emergencyCharge}
                    onChange={setEmergencyCharge}
                    placeholder="e.g. 800"
                  />
                </Field>
              </div>
            </>
          ) : null}

          <Field label="Profile Image">
            <div className="flex items-start gap-3">
              <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-full bg-zinc-100 text-zinc-400 dark:bg-zinc-800">
                {imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imageUrl}
                    alt="Profile"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Upload className="h-6 w-6" aria-hidden />
                )}
              </div>
              <div className="flex-1 space-y-2">
                <Input
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="Profile image URL"
                />
                <label className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-medium text-sky-600 transition-colors hover:text-sky-700 dark:text-sky-400">
                  {uploading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Upload className="h-3.5 w-3.5" aria-hidden />
                  )}
                  <span>Upload image</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={uploading}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void handleUpload(file);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
            </div>
          </Field>

          <Field
            label="Password"
            hint="leave blank to keep current"
          >
            <IconInput
              icon={Lock}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="New password (optional)"
              autoComplete="new-password"
            />
          </Field>

          <div className="flex items-center gap-3 pt-2 sm:grid sm:grid-cols-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (typeof window !== "undefined" && window.history.length > 1) {
                  router.back();
                } else {
                  router.push(backHref);
                }
              }}
              disabled={submitting}
              className="w-full justify-center"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="w-full justify-center bg-sky-600 hover:bg-sky-700"
            >
              {submitting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : null}
              Update User
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
      <Label className="text-sm font-medium">
        {label}
        {required ? <span className="ml-0.5 text-rose-500">*</span> : null}
        {hint ? (
          <span className="ml-1 text-xs font-normal text-zinc-500">
            ({hint})
          </span>
        ) : null}
      </Label>
      {children}
    </div>
  );
}

function IconInput({
  icon: Icon,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="relative">
      <Icon
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
        aria-hidden
      />
      <Input {...props} className="pl-9" />
    </div>
  );
}

function CurrencyInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <IndianRupee
        className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400"
        aria-hidden
      />
      <Input
        type="number"
        min="0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-9 tabular-nums"
      />
    </div>
  );
}
