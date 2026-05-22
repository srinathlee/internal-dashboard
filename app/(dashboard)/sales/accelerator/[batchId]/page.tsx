"use client";

import { useParams } from "next/navigation";

import { Card } from "@/components/ui/card";
import { BatchDashboardScreen } from "@/components/sales/accelerator/batch-dashboard-screen";

export default function SalesAcceleratorBatchPage() {
  const params = useParams<{ batchId?: string | string[] }>();
  const raw = params?.batchId;
  const batchId = Array.isArray(raw) ? raw[0] : raw;

  if (!batchId) {
    return (
      <Card className="p-12 text-center text-sm text-zinc-500">
        Missing batch id in the URL.
      </Card>
    );
  }

  return <BatchDashboardScreen batchId={batchId} />;
}
