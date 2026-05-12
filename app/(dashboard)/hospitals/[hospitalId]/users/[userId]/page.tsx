"use client";

import { useParams } from "next/navigation";

import { Card } from "@/components/ui/card";
import { UserDetailScreen } from "@/components/hospitals/user-detail-screen";

export default function UserDetailPage() {
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

  return <UserDetailScreen hospitalId={hospitalId} userId={userId} />;
}
