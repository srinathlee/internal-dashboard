"use client";

import { useParams } from "next/navigation";

import { CreateUserScreen } from "@/components/hospitals/create-user-screen";

export default function CreateUserPage() {
  const params = useParams<{ hospitalId: string }>();
  return <CreateUserScreen hospitalId={params.hospitalId} />;
}
