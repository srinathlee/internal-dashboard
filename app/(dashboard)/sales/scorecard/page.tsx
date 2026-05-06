"use client";

import { ScorecardAdminScreen } from "@/components/sales/scorecard/scorecard-admin-screen";
import { ScorecardScreen } from "@/components/sales/scorecard/scorecard-screen";
import { isSalesAdminOrSuperAdmin } from "@/lib/access";
import { useAuth } from "@/lib/auth";

export default function SalesScorecardPage() {
  const auth = useAuth();
  if (isSalesAdminOrSuperAdmin(auth)) return <ScorecardAdminScreen />;
  return <ScorecardScreen />;
}
