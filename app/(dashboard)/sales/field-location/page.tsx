"use client";

import { FieldLocationAdminScreen } from "@/components/sales/field-location/field-location-admin-screen";
import { FieldLocationScreen } from "@/components/sales/field-location/field-location-screen";
import { isSalesAdminOrSuperAdmin } from "@/lib/access";
import { useAuth } from "@/lib/auth";

export default function SalesFieldLocationPage() {
  const auth = useAuth();
  if (isSalesAdminOrSuperAdmin(auth)) return <FieldLocationAdminScreen />;
  return <FieldLocationScreen />;
}
