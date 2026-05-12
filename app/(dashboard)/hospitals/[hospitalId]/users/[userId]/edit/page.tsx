"use client";

import { useParams } from "next/navigation";

import { Card } from "@/components/ui/card";
import { EditUserScreen } from "@/components/hospitals/edit-user-screen";

export default function EditUserPage() {
  const params = useParams<{
    hospitalId?: string | string[];
    userId?: string | string[];
  }>();
  const rawHospital = params?.hospitalId;
  const rawUser = params?.userId;
  const hospitalId = Array.isArray(rawHospital) ? rawHospital[0] : rawHospital;
  const userId = Array.isArray(rawUser) ? rawUser[0] : rawUser;

  if (!hospitalId || !userId) {
    return (
      <Card className="p-12 text-center text-sm text-zinc-500">
        Missing hospital or user id in the URL.
      </Card>
    );
  }

  return <EditUserScreen hospitalId={hospitalId} userId={userId} />;
}
