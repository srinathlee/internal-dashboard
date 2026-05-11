"use client";

import { useParams } from "next/navigation";

import { Card } from "@/components/ui/card";
import { CreateHospitalAdminScreen } from "@/components/hospitals/create-hospital-admin-screen";

export default function CreateHospitalAdminPage() {
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

  return <CreateHospitalAdminScreen hospitalId={hospitalId} />;
}
