"use client";

import { useParams } from "next/navigation";

import { Card } from "@/components/ui/card";
import { CreateUserScreen } from "@/components/hospitals/create-user-screen";

export default function CreateUserPage() {
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

  return <CreateUserScreen hospitalId={hospitalId} />;
}
