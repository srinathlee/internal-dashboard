"use client";

import { useParams } from "next/navigation";

import { Card } from "@/components/ui/card";
import { HospitalDetailScreen } from "@/components/hospitals/hospital-detail-screen";
import { useAuth } from "@/lib/auth";
import { canOpenHospital } from "@/lib/access";

export default function HospitalDetailPage() {
  // useParams returns Params | null. The generic just casts the shape; the
  // runtime value is whatever Next.js produces. Guard against an empty /
  // missing hospitalId so the detail screen doesn't fire a GET against
  // `/api/hospitals/undefined` and surface a confusing "Hospital not found".
  const params = useParams<{ hospitalId?: string | string[] }>();
  const auth = useAuth();
  const raw = params?.hospitalId;
  const hospitalId = Array.isArray(raw) ? raw[0] : raw;

  if (!hospitalId) {
    return (
      <Card className="p-12 text-center text-sm text-zinc-500">
        Missing hospital id in the URL.
      </Card>
    );
  }

  if (!auth.isLoaded) return null;

  if (!canOpenHospital(auth)) {
    return (
      <Card className="p-12 text-center text-sm text-zinc-500">
        You don't have permission to view this hospital. Only super admins can
        open hospital details.
      </Card>
    );
  }

  return <HospitalDetailScreen hospitalId={hospitalId} />;
}
