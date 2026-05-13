"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

import { MobileSidebarBody } from "./sidebar";
import { PAGE_TITLE_BY_PATH } from "./nav-config";
import { NotificationsButton } from "./notifications-button";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

export function Header() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Match by exact path first, then by prefix (covers deep routes added later).
  const title =
    PAGE_TITLE_BY_PATH[pathname] ??
    Object.entries(PAGE_TITLE_BY_PATH).find(([p]) => pathname.startsWith(p + "/"))?.[1] ??
    "";

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-zinc-200 bg-white/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:border-zinc-800 dark:bg-zinc-950/95 dark:supports-[backdrop-filter]:bg-zinc-950/80 sm:px-6">
      {/* Mobile nav trigger */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Open navigation"
          className="-ml-2 lg:hidden"
          onClick={() => setMobileOpen(true)}
        >
          <Menu className="h-4 w-4" />
        </Button>
        <SheetContent side="left" className="w-64 p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation</SheetTitle>
          </SheetHeader>
          <MobileSidebarBody onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Page title */}
      <div className="flex min-w-0 items-center gap-2">
        {title && (
          <h1 className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
            {title}
          </h1>
        )}
      </div>

      {/* Right cluster */}
      <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
        <ThemeToggle />
        <NotificationsButton />
        <UserMenu />
      </div>
    </header>
  );
}
