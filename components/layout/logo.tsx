import Image from "next/image";

import { cn } from "@/lib/utils";

interface LogoProps {
  collapsed?: boolean;
  className?: string;
}

/**
 * Sidebar wordmark: faceted "M" brand mark + "MyTeamFlow". Same SVG as the
 * splash loader and favicon so the brand stays consistent across surfaces.
 */
export function Logo({ collapsed = false, className }: LogoProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Image
        src="/myteamflow-logo.svg"
        alt="MyTeamFlow"
        width={28}
        height={28}
        priority
        className="h-7 w-7 shrink-0 object-contain"
      />
      {!collapsed && (
        <span className="text-sm font-semibold tracking-tight">MyTeamFlow</span>
      )}
    </div>
  );
}
