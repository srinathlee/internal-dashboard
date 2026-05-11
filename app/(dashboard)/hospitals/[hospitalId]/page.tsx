"use client";

import { useParams } from "next/navigation";

import { HospitalDetailScreen } from "@/components/hospitals/hospital-detail-screen";

export default function HospitalDetailPage() {
  const params = useParams<{ hospitalId: string }>();
  return <HospitalDetailScreen hospitalId={params.hospitalId} />;
}
