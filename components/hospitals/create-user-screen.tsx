"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Briefcase,
  Building2,
  Check,
  Eye,
  EyeOff,
  IndianRupee,
  Loader2,
  Plus,
  Search,
  Stethoscope,
  Upload as UploadIcon,
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
import { Textarea } from "@/components/ui/textarea";
import { useHospital } from "@/lib/hooks/use-hospitals";
import { useAsync, errorMessage } from "@/lib/hooks/use-async";
import { listBranchesForHospital } from "@/lib/api/branches";
import {
  createBranchAdmin,
  createHospitalAdmin,
  createStaffUser,
  type StaffRole,
} from "@/lib/api/users";
import { uploadFile } from "@/lib/api/hospitals";
import { cn } from "@/lib/utils";

// Default treatments shown as multi-select chips. When the hospital has a
// configured treatments list (per the hospital create wizard), we'd merge
// them in — for now this static set matches the screenshot.
const DEFAULT_TREATMENTS = [
  { id: "conservative-dentistry", label: "Conservative Dentistry" },
  { id: "cosmetic", label: "Cosmetic" },
  { id: "aesthetic-dentistry", label: "Aesthetic Dentistry" },
  { id: "teeth-reshaping", label: "Teeth Reshaping" },
  { id: "teeth-whitening", label: "Teeth Whitening" },
  { id: "teeth-straightening", label: "Teeth Straightening" },
];

type Role = "HOSPITAL_ADMIN" | "BRANCH_ADMIN" | "DOCTOR" | "RECEPTIONIST";

const ROLE_OPTIONS: { id: Role; label: string }[] = [
  { id: "DOCTOR", label: "Doctor" },
  { id: "RECEPTIONIST", label: "Receptionist" },
  { id: "BRANCH_ADMIN", label: "Branch admin" },
  { id: "HOSPITAL_ADMIN", label: "Hospital admin" },
];

export function CreateUserScreen({ hospitalId }: { hospitalId: string }) {
  const router = useRouter();
  const hospital = useHospital(hospitalId);
  const branches = useAsync(
    (signal) => listBranchesForHospital(hospitalId, signal).catch(() => []),
    [hospitalId],
  );

  // Identity
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<Role>("DOCTOR");
  const [branchId, setBranchId] = useState<string>("");

  // Common
  const [defaultOpCharge, setDefaultOpCharge] = useState<string>("");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Doctor-only
  const [specialty, setSpecialty] = useState("");
  const [qualification, setQualification] = useState("");
  const [experience, setExperience] = useState("");
  const [department, setDepartment] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [treatmentSearch, setTreatmentSearch] = useState("");
  const [selectedTreatments, setSelectedTreatments] = useState<string[]>([]);
  const [bio, setBio] = useState("");
  const [profileImageUrl, setProfileImageUrl] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  const backHref = `/hospitals/${hospitalId}`;
  const hospitalName = hospital.data?.name ?? "this hospital";
  const isDoctor = role === "DOCTOR";
  const needsBranch =
    role === "DOCTOR" || role === "RECEPTIONIST" || role === "BRANCH_ADMIN";

  // Clear treatment selections when the role flips away from Doctor — keeps
  // the payload clean.
  useEffect(() => {
    if (role !== "DOCTOR") {
      setSelectedTreatments([]);
    }
  }, [role]);

  const handleImageUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Only image files are allowed.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image too large", { description: "Max 2 MB." });
      return;
    }
    setUploadingImage(true);
    try {
      const { url } = await uploadFile(file, "org-assets");
      setProfileImageUrl(url);
      toast.success("Profile image uploaded");
    } catch (err) {
      toast.error("Upload failed", { description: errorMessage(err) });
    } finally {
      setUploadingImage(false);
    }
  };

  const validate = (): string | null => {
    if (!name.trim()) return "Name is required.";
    if (!email.trim()) return "Email is required.";
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return "Email looks invalid.";
    if (!phone.trim()) return "Phone is required.";
    if (!password) return "Password is required.";
    if (password.length < 8) return "Password must be at least 8 characters.";
    if (needsBranch && !branchId) return "Pick a branch.";
    if (isDoctor && !specialty.trim()) return "Specialisation is required for doctors.";
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
      const phoneOut = phone.trim().startsWith("+")
        ? phone.trim()
        : `+91${phone.replace(/\D/g, "").slice(-10)}`;

      if (role === "HOSPITAL_ADMIN") {
        await createHospitalAdmin({
          name: name.trim(),
          email: email.trim(),
          phone: phoneOut,
          password,
          hospital_id: hospitalId,
          status,
        });
      } else if (role === "BRANCH_ADMIN") {
        await createBranchAdmin({
          name: name.trim(),
          email: email.trim(),
          phone: phoneOut,
          password,
          hospital_id: hospitalId,
          branch_id: branchId,
          status,
        });
      } else {
        await createStaffUser({
          name: name.trim(),
          email: email.trim(),
          phone: phoneOut,
          password,
          hospital_id: hospitalId,
          branch_id: branchId,
          role: role as StaffRole,
          status,
          ...(isDoctor
            ? {
                specialty: specialty.trim() || undefined,
                qualification: qualification.trim() || undefined,
                experience_years:
                  Number(experience) > 0 ? Number(experience) : undefined,
                department: department.trim() || undefined,
                currency,
                license_number: licenseNumber.trim() || undefined,
                op_fee:
                  Number(defaultOpCharge) > 0
                    ? Number(defaultOpCharge)
                    : undefined,
                bio: bio.trim() || undefined,
                profile_image_url: profileImageUrl.trim() || undefined,
                treatments:
                  selectedTreatments.length > 0
                    ? selectedTreatments
                    : undefined,
              }
            : {}),
        });
      }
      toast.success("User created");
      router.push(backHref);
    } catch (err2) {
      toast.error("Couldn't create user", {
        description: errorMessage(err2),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const filteredTreatments = DEFAULT_TREATMENTS.filter((t) =>
    t.label.toLowerCase().includes(treatmentSearch.trim().toLowerCase()),
  );

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
          Create User
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Add a new user for {hospitalName}
        </p>
      </div>

      <Card className="p-6 sm:p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="grid h-7 w-7 place-items-center rounded-md bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400"
            >
              <Users className="h-3.5 w-3.5" />
            </span>
            <h2 className="text-base font-semibold">User Information</h2>
          </div>

          <div className="border-t border-zinc-100 dark:border-zinc-800" />

          {/* Identity block */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Name" required>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
              />
            </Field>
            <Field label="Email" required>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </Field>
            <Field
              label="Phone"
              required
              hint="Enter phone number with country code (e.g., +1234567890)"
            >
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1234567890"
                inputMode="tel"
              />
            </Field>
            <Field label="Role" required>
              <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label="Default OP Charge (₹)" required={isDoctor}>
            <div className="relative">
              <IndianRupee
                aria-hidden
                className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400"
              />
              <Input
                type="number"
                min="0"
                value={defaultOpCharge}
                onChange={(e) => setDefaultOpCharge(e.target.value)}
                placeholder="e.g. 500"
                className="pl-9 tabular-nums"
              />
            </div>
          </Field>

          {needsBranch ? (
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">
                Branch
                <span className="ml-0.5 text-rose-500">*</span>
              </Label>
              <div className="flex items-center gap-2">
                <Select value={branchId} onValueChange={setBranchId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select Branch (Optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {(branches.data ?? []).length === 0 ? (
                      <div className="px-2 py-3 text-center text-xs text-zinc-500">
                        No branches yet. Add one from the hospital page.
                      </div>
                    ) : (
                      (branches.data ?? []).map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => toast("Add branch — coming soon")}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add
                </Button>
              </div>
            </div>
          ) : null}

          {/* Doctor details */}
          {isDoctor ? (
            <>
              <div className="border-t border-zinc-100 pt-6 dark:border-zinc-800">
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="grid h-7 w-7 place-items-center rounded-md bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400"
                  >
                    <Stethoscope className="h-3.5 w-3.5" />
                  </span>
                  <h2 className="text-base font-semibold">Doctor Details</h2>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Specialisation" required>
                  <IconInput
                    icon={Stethoscope}
                    value={specialty}
                    onChange={setSpecialty}
                    placeholder="e.g. Cardiologist"
                  />
                </Field>
                <Field label="Qualification">
                  <IconInput
                    icon={Briefcase}
                    value={qualification}
                    onChange={setQualification}
                    placeholder="e.g. MBBS, MD"
                  />
                </Field>
                <Field label="Experience">
                  <IconInput
                    icon={Briefcase}
                    value={experience}
                    onChange={setExperience}
                    placeholder="e.g. 5 years"
                  />
                </Field>
                <Field label="Department">
                  <IconInput
                    icon={Building2}
                    value={department}
                    onChange={setDepartment}
                    placeholder="e.g. Cardiology"
                  />
                </Field>
                <Field label="Currency">
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INR">INR (₹)</SelectItem>
                      <SelectItem value="USD">USD ($)</SelectItem>
                      <SelectItem value="EUR">EUR (€)</SelectItem>
                      <SelectItem value="GBP">GBP (£)</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="License Number">
                  <Input
                    value={licenseNumber}
                    onChange={(e) => setLicenseNumber(e.target.value)}
                    placeholder="e.g. MCI-12345"
                  />
                </Field>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Assign treatments</Label>
                <p className="text-xs text-zinc-500">
                  Search and select the treatments this doctor will perform
                  (from hospital Treatments page).
                </p>
                <div className="relative">
                  <Search
                    aria-hidden
                    className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400"
                  />
                  <Input
                    value={treatmentSearch}
                    onChange={(e) => setTreatmentSearch(e.target.value)}
                    placeholder="Search treatments…"
                    className="pl-9"
                  />
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  {filteredTreatments.length === 0 ? (
                    <span className="text-xs text-zinc-500">
                      No matches.
                    </span>
                  ) : (
                    filteredTreatments.map((t) => {
                      const active = selectedTreatments.includes(t.id);
                      return (
                        <label
                          key={t.id}
                          className={cn(
                            "inline-flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1 text-xs transition-colors",
                            active
                              ? "border-sky-500 bg-sky-50 text-sky-700 dark:border-sky-400 dark:bg-sky-950/40 dark:text-sky-300"
                              : "border-zinc-200 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900",
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={active}
                            onChange={() =>
                              setSelectedTreatments((arr) =>
                                arr.includes(t.id)
                                  ? arr.filter((x) => x !== t.id)
                                  : [...arr, t.id],
                              )
                            }
                            className="h-3 w-3"
                          />
                          {t.label}
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              <Field label="Bio">
                <Textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={3}
                  placeholder="Short professional bio"
                />
              </Field>

              <ProfileImageBlock
                imageUrl={profileImageUrl}
                onChange={setProfileImageUrl}
                onUpload={handleImageUpload}
                uploading={uploadingImage}
              />
            </>
          ) : null}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
              Create User
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
      </Label>
      {children}
      {hint ? <p className="text-xs text-zinc-500">{hint}</p> : null}
    </div>
  );
}

function IconInput({
  icon: Icon,
  value,
  onChange,
  placeholder,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <Icon
        aria-hidden
        className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400"
      />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-9"
      />
    </div>
  );
}

function ProfileImageBlock({
  imageUrl,
  onChange,
  onUpload,
  uploading,
}: {
  imageUrl: string;
  onChange: (url: string) => void;
  onUpload: (file: File) => void;
  uploading: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">Profile Image</Label>
      <div className="flex items-center gap-4">
        <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-full border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt="Profile preview"
              className="h-full w-full object-cover"
              onError={() => onChange("")}
            />
          ) : (
            <UploadIcon
              className="h-5 w-5 text-zinc-400"
              aria-hidden
            />
          )}
        </div>
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex">
              <input
                type="file"
                accept="image/png,image/jpeg,image/gif"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onUpload(f);
                  e.target.value = "";
                }}
                className="hidden"
              />
              <span
                className={cn(
                  "inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-sky-700",
                  uploading && "pointer-events-none opacity-60",
                )}
              >
                {uploading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <UploadIcon className="h-3.5 w-3.5" />
                )}
                Upload PNG / JPG
              </span>
            </label>
            {imageUrl ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onChange("")}
              >
                Clear
              </Button>
            ) : null}
          </div>
          <p className="text-xs text-zinc-500">
            PNG, JPG or GIF. Max 2 MB. Uploaded with public read access.
          </p>
          {imageUrl ? (
            <p className="flex items-center gap-1 truncate text-xs text-emerald-600 dark:text-emerald-400">
              <Check className="h-3 w-3" aria-hidden />
              {imageUrl}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
