"use client";

import { useParams } from "next/navigation";

import { CreateHospitalAdminScreen } from "@/components/hospitals/create-hospital-admin-screen";

export default function CreateHospitalAdminPage() {
  const params = useParams<{ hospitalId: string }>();
  return <CreateHospitalAdminScreen hospitalId={params.hospitalId} />;
}
