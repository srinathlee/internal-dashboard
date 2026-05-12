"use client";

import { useEffect, useState } from "react";
import { Building2, Loader2 } from "lucide-react";
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
import { createBranch } from "@/lib/api/branches";
import { errorMessage } from "@/lib/hooks/use-async";

const TIMEZONES = [
  { id: "Asia/Kolkata", label: "Asia/Kolkata (IST)" },
  { id: "Asia/Dubai", label: "Asia/Dubai (GST)" },
  { id: "Asia/Singapore", label: "Asia/Singapore (SGT)" },
  { id: "Europe/London", label: "Europe/London (GMT)" },
  { id: "America/New_York", label: "America/New_York (EST)" },
];

export function CreateBranchModal({
  open,
  hospitalId,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  hospitalId: string;
  onOpenChange: (next: boolean) => void;
  onCreated?: () => void;
}) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setName("");
      setAddress("");
      setPhone("");
      setEmail("");
      setTimezone("Asia/Kolkata");
    }
  }, [open]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Branch name is required.");
      return;
    }
    setSaving(true);
    try {
      await createBranch({
        hospital_id: hospitalId,
        name: name.trim(),
        address: address.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        timezone: timezone || undefined,
      });
      toast.success("Branch created");
      onCreated?.();
      onOpenChange(false);
    } catch (err) {
      toast.error("Couldn't create branch", { description: errorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-sky-600" aria-hidden />
            Add branch
          </DialogTitle>
          <DialogDescription>
            Create a new branch under this hospital.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">
              Name <span className="text-rose-500">*</span>
            </Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Apollo Anna Nagar Branch"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Address</Label>
            <Input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Street, city, postcode"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Phone</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91…"
                inputMode="tel"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="branch@hospital.com"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Timezone</Label>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz.id} value={tz.id}>
                    {tz.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="bg-sky-600 hover:bg-sky-700"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Create branch
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
