"use client";

import { useParams } from "next/navigation";

import { Card } from "@/components/ui/card";
import { RepOverviewScreen } from "@/components/sales/reps/rep-overview-screen";

export default function SalesRepPage() {
  const params = useParams<{ repId?: string | string[] }>();
  const raw = params?.repId;
  const repId = Array.isArray(raw) ? raw[0] : raw;

  if (!repId) {
    return (
      <Card className="p-12 text-center text-sm text-zinc-500">
        Missing rep id in the URL.
      </Card>
    );
  }

  return <RepOverviewScreen repId={repId} />;
}
