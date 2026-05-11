"use client";

import { useParams } from "next/navigation";

import { Card } from "@/components/ui/card";
import { HospitalDetailScreen } from "@/components/hospitals/hospital-detail-screen";

export default function HospitalDetailPage() {
  // useParams returns Params | null. The generic just casts the shape; the
  // runtime value is whatever Next.js produces. Guard against an empty /
  // missing hospitalId so the detail screen doesn't fire a GET against
  // `/api/hospitals/undefined` and surface a confusing "Hospital not found".
  const params = useParams<{ hospitalId?: string | string[] }>();
  const raw = params?.hospitalId;
  const hospitalId = Array.isArray(raw) ? raw[0] : raw;

  if (!hospitalId) {
    return (
      <Card className="p-12 text-center text-sm text-zinc-500">
        Missing hospital id in the URL.
      </Card>
    );
  }

  return <HospitalDetailScreen hospitalId={hospitalId} />;
}
