"use client";

import { useEffect, useRef, useState } from "react";
import {
  Building2,
  Check,
  Image as ImageIcon,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { useHospital, useHospitalMutations } from "@/lib/hooks/use-hospitals";
import { uploadFile } from "@/lib/api/hospitals";
import { cn } from "@/lib/utils";
import type { UpdateHospitalInput } from "@/lib/api/hospitals";

const HOSPITAL_TYPES = [
  { id: "dental", label: "Dental" },
  { id: "eye", label: "Eye" },
  { id: "skin", label: "Skin" },
  { id: "hair", label: "Hair" },
  { id: "multispecialty", label: "Multispecialty" },
];

const TIMEZONES = [
  { id: "Asia/Kolkata", label: "Asia/Kolkata (IST)" },
  { id: "Asia/Dubai", label: "Asia/Dubai (GST)" },
  { id: "Asia/Singapore", label: "Asia/Singapore (SGT)" },
  { id: "Europe/London", label: "Europe/London (GMT)" },
  { id: "America/New_York", label: "America/New_York (EST)" },
  { id: "UTC", label: "UTC" },
];

const CURRENCIES = [
  { id: "INR", label: "INR (₹)" },
  { id: "USD", label: "USD ($)" },
  { id: "EUR", label: "EUR (€)" },
  { id: "GBP", label: "GBP (£)" },
  { id: "AED", label: "AED (د.إ)" },
];

const STATUSES: { id: "ACTIVE" | "INACTIVE"; label: string }[] = [
  { id: "ACTIVE", label: "Active" },
  { id: "INACTIVE", label: "Inactive" },
];

interface FormState {
  name: string;
  email: string;
  phone: string;
  emergencyPhone: string;
  location: string;
  address: string;
  timezone: string;
  currency: string;
  primaryColor: string;
  selectedTypes: string[];
  opFee: string;
  status: "ACTIVE" | "INACTIVE";
  imageUrl: string;
}

const EMPTY: FormState = {
  name: "",
  email: "",
  phone: "",
  emergencyPhone: "",
  location: "",
  address: "",
  timezone: "Asia/Kolkata",
  currency: "INR",
  primaryColor: "#1A73E8",
  selectedTypes: [],
  opFee: "",
  status: "ACTIVE",
  imageUrl: "",
};

/**
 * Pull a comparable string out of fields that may come back from the API in
 * a variety of shapes (string, string[], or nested objects with a `name`
 * property). The endpoint contract says `hospital_type` is a single string,
 * but real responses have included arrays and objects, so we normalize here
 * rather than at every read site.
 */
function readString(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return "";
}

function readArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((v) => (typeof v === "string" ? v : readString((v as { name?: unknown })?.name)))
      .filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) return [value];
  return [];
}

function hydrate(detail: Record<string, unknown> | null): FormState {
  if (!detail) return EMPTY;
  const types = readArray(detail.hospital_type);
  const location = Array.isArray(detail.location)
    ? (detail.location as unknown[]).map(readString).filter(Boolean).join(", ")
    : readString(detail.location);
  const status = detail.status === "INACTIVE" ? "INACTIVE" : "ACTIVE";
  const opFee =
    typeof detail.op_fee === "number"
      ? String(detail.op_fee)
      : readString(detail.op_fee);
  return {
    name: readString(detail.name),
    email: readString(detail.email),
    phone: readString(detail.phone),
    emergencyPhone: readString(detail.emergency_phone),
    location,
    address: readString(detail.address),
    timezone: readString(detail.timezone) || "Asia/Kolkata",
    currency: readString(detail.currency) || "INR",
    primaryColor: readString(detail.primary_color) || "#1A73E8",
    selectedTypes: types,
    opFee,
    status,
    imageUrl: readString(detail.hospital_image_url),
  };
}

export function EditHospitalModal({
  open,
  hospitalId,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  hospitalId: string | null;
  onOpenChange: (next: boolean) => void;
  /** Called after a successful save with the hospital's display name. */
  onSaved?: (hospitalName: string) => void;
}) {
  const detailQuery = useHospital(open ? hospitalId : null);
  const { update } = useHospitalMutations();

  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);

  // Re-hydrate whenever a fresh detail payload lands. The detail endpoint
  // is the authoritative source of the full record; the list shape is too
  // thin to drive an edit form.
  useEffect(() => {
    if (open && detailQuery.data) {
      setForm(hydrate(detailQuery.data as unknown as Record<string, unknown>));
    }
  }, [open, detailQuery.data]);

  useEffect(() => {
    if (!open) setForm(EMPTY);
  }, [open]);

  const toggleType = (id: string) => {
    setForm((f) => ({
      ...f,
      selectedTypes: f.selectedTypes.includes(id)
        ? f.selectedTypes.filter((t) => t !== id)
        : [...f.selectedTypes, id],
    }));
  };

  const handleSave = async () => {
    if (!hospitalId) return;
    if (!form.name.trim()) {
      toast.error("Hospital name is required.");
      return;
    }
    const opFeeNum = form.opFee.trim() === "" ? null : Number(form.opFee);
    if (opFeeNum !== null && (Number.isNaN(opFeeNum) || opFeeNum < 0)) {
      toast.error("OP fee must be a non-negative number.");
      return;
    }

    setSaving(true);
    try {
      const body: UpdateHospitalInput = {
        name: form.name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        emergency_phone: form.emergencyPhone.trim() || null,
        location: form.location.trim()
          ? form.location
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : null,
        address: form.address.trim() || null,
        timezone: form.timezone || null,
        currency: form.currency || null,
        primary_color: form.primaryColor || null,
        hospital_type: form.selectedTypes.length ? form.selectedTypes : null,
        op_fee: opFeeNum,
        status: form.status,
        hospital_image_url: form.imageUrl.trim() || null,
      };
      await update(hospitalId, body);
      toast.success("Hospital updated");
      onSaved?.(form.name.trim());
      onOpenChange(false);
    } catch (err) {
      toast.error("Couldn't update hospital", {
        description: errorMessage(err),
      });
    } finally {
      setSaving(false);
    }
  };

  const loading = open && detailQuery.isLoading && !detailQuery.data;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-hidden p-0 sm:max-w-2xl">
        <div className="flex max-h-[92vh] flex-col">
          <DialogHeader className="space-y-1 border-b border-zinc-100 px-6 py-5 pr-12 dark:border-zinc-800">
            <DialogTitle className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <span
                aria-hidden
                className="grid h-8 w-8 place-items-center rounded-md bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400"
              >
                <Building2 className="h-4 w-4" />
              </span>
              Edit hospital
            </DialogTitle>
            <DialogDescription>
              Update hospital details. Leaves admin users and subscriptions
              alone — change those from their dedicated screens.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            {loading ? (
              <div className="grid place-items-center py-16 text-sm text-zinc-500">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : detailQuery.error ? (
              <Card className="border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-300">
                Couldn't load hospital: {errorMessage(detailQuery.error)}
              </Card>
            ) : (
              <div className="space-y-5">
                <SectionLabel>Profile</SectionLabel>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Hospital name" required>
                    <Input
                      value={form.name}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, name: e.target.value }))
                      }
                      placeholder="e.g. Apollo Dental"
                    />
                  </Field>
                  <Field label="Status">
                    <Select
                      value={form.status}
                      onValueChange={(v) =>
                        setForm((f) => ({
                          ...f,
                          status: v as "ACTIVE" | "INACTIVE",
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUSES.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Email">
                    <Input
                      type="email"
                      value={form.email}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, email: e.target.value }))
                      }
                      placeholder="contact@hospital.com"
                    />
                  </Field>
                  <Field label="Phone">
                    <Input
                      value={form.phone}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, phone: e.target.value }))
                      }
                      placeholder="+91…"
                    />
                  </Field>
                  <Field label="Emergency phone">
                    <Input
                      value={form.emergencyPhone}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          emergencyPhone: e.target.value,
                        }))
                      }
                      placeholder="+91…"
                    />
                  </Field>
                  <Field label="OP fee">
                    <Input
                      inputMode="decimal"
                      value={form.opFee}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, opFee: e.target.value }))
                      }
                      placeholder="e.g. 300"
                    />
                  </Field>
                </div>

                <SectionLabel>Location</SectionLabel>
                <div className="grid grid-cols-1 gap-4">
                  <Field
                    label="Location"
                    hint="Comma-separated, e.g. “Chennai, Tamil Nadu”."
                  >
                    <Input
                      value={form.location}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, location: e.target.value }))
                      }
                      placeholder="City, State"
                    />
                  </Field>
                  <Field label="Address">
                    <Input
                      value={form.address}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, address: e.target.value }))
                      }
                      placeholder="Street, area, city, postcode"
                    />
                  </Field>
                </div>

                <SectionLabel>Locale &amp; branding</SectionLabel>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Timezone">
                    <Select
                      value={form.timezone}
                      onValueChange={(v) =>
                        setForm((f) => ({ ...f, timezone: v }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIMEZONES.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Currency">
                    <Select
                      value={form.currency}
                      onValueChange={(v) =>
                        setForm((f) => ({ ...f, currency: v }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CURRENCIES.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Primary color">
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={form.primaryColor}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            primaryColor: e.target.value,
                          }))
                        }
                        aria-label="Primary color"
                        className="h-9 w-12 cursor-pointer rounded-md border border-zinc-200 bg-white p-0.5 dark:border-zinc-800 dark:bg-zinc-950"
                      />
                      <Input
                        value={form.primaryColor}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            primaryColor: e.target.value,
                          }))
                        }
                        placeholder="#1A73E8"
                        className="flex-1 font-mono"
                      />
                    </div>
                  </Field>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Hospital type</Label>
                  <div className="flex flex-wrap gap-2">
                    {HOSPITAL_TYPES.map((t) => {
                      const active = form.selectedTypes.includes(t.id);
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => toggleType(t.id)}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm transition-colors",
                            active
                              ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                              : "border-zinc-200 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900",
                          )}
                          aria-pressed={active}
                        >
                          {active ? (
                            <Check className="h-3 w-3" aria-hidden />
                          ) : null}
                          {t.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <HospitalImageField
                  imageUrl={form.imageUrl}
                  onChange={(url) =>
                    setForm((f) => ({ ...f, imageUrl: url }))
                  }
                />
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-zinc-100 px-6 py-4 dark:border-zinc-800">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || loading || !!detailQuery.error}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              Save changes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
      {children}
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

// ---------- Hospital image field (local copy) ----------

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
];

function HospitalImageField({
  imageUrl,
  onChange,
}: {
  imageUrl: string;
  onChange: (url: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleFile = async (file: File) => {
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      toast.error("Unsupported image type", {
        description: "Use PNG, JPEG, WebP, or GIF.",
      });
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error("Image too large", {
        description: `Keep it under ${Math.round(
          MAX_IMAGE_BYTES / (1024 * 1024),
        )} MB.`,
      });
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setUploading(true);
    try {
      const { url } = await uploadFile(file, "org-assets");
      onChange(url);
      toast.success("Image uploaded");
    } catch (err) {
      toast.error("Upload failed", { description: errorMessage(err) });
      setPreviewUrl(null);
    } finally {
      setUploading(false);
    }
  };

  const previewSrc = previewUrl ?? (imageUrl.trim() ? imageUrl : null);

  return (
    <div className="space-y-2">
      <Label className="inline-flex items-center gap-2 text-sm font-medium">
        <ImageIcon className="h-3.5 w-3.5 text-zinc-500" aria-hidden />
        Hospital image
      </Label>
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-md border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
            {previewSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewSrc}
                alt="Hospital preview"
                className="h-full w-full object-cover"
                onError={() => {
                  if (!previewUrl) onChange("");
                }}
              />
            ) : (
              <span className="text-[10px] text-zinc-500">No preview</span>
            )}
          </div>
          <Input
            value={imageUrl}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Image URL (https://…)"
            className="min-w-0 flex-1"
            disabled={uploading}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_IMAGE_TYPES.join(",")}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
              e.target.value = "";
            }}
            className="hidden"
            aria-hidden
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            {uploading ? "Uploading…" : "Upload"}
          </Button>
          {imageUrl ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                onChange("");
                setPreviewUrl(null);
              }}
              disabled={uploading}
            >
              <X className="h-3.5 w-3.5" />
              Clear
            </Button>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
