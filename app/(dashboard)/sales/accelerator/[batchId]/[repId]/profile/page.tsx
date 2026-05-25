"use client";

import { useParams } from "next/navigation";

import { Card } from "@/components/ui/card";
import { RepAccountScreen } from "@/components/sales/accelerator/rep-account-screen";

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default function AcceleratorRepProfilePage() {
  const params = useParams<{ batchId?: string | string[]; repId?: string | string[] }>();
  const batchId = first(params?.batchId);
  const repId = first(params?.repId);

  if (!batchId || !repId) {
    return (
      <Card className="p-12 text-center text-sm text-zinc-500">
        Missing batch or rep id in the URL.
      </Card>
    );
  }

  return <RepAccountScreen batchId={batchId} repId={repId} />;
}
