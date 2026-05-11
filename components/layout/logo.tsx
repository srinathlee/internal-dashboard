import Image from "next/image";

import { cn } from "@/lib/utils";

interface LogoProps {
  collapsed?: boolean;
  className?: string;
}

/**
 * Sidebar wordmark: NYRA brand mark + "NYRA". Same PNG as the splash loader
 * so the brand stays consistent across surfaces.
 */
export function Logo({ collapsed = false, className }: LogoProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Image
        src="/nyra-logo.png"
        alt="NYRA"
        width={28}
        height={28}
        priority
        className="h-7 w-7 shrink-0 object-contain"
      />
      {!collapsed && (
        <span className="text-sm font-semibold tracking-tight">NYRA</span>
      )}
    </div>
  );
}
