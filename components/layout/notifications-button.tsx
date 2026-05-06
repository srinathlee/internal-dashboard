"use client";

import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Visual placeholder. v1 has no notification feed; the bell exists so the
 * header chrome matches every other product reviewers will compare us to.
 */
export function NotificationsButton() {
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Notifications"
      className="relative text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50"
    >
      <Bell className="h-4 w-4" />
    </Button>
  );
}
