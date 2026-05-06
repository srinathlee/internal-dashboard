import { cn } from "@/lib/utils";

interface LogoProps {
  collapsed?: boolean;
  className?: string;
}

/**
 * Simple wordmark — a small indigo square + "NYRA". Kept understated;
 * no gradient, no decorative icon.
 */
export function Logo({ collapsed = false, className }: LogoProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        aria-hidden
        className="grid h-7 w-7 place-items-center rounded-md bg-zinc-900 text-xs font-semibold tracking-tight text-white dark:bg-zinc-50 dark:text-zinc-900"
      >
        N
      </div>
      {!collapsed && (
        <span className="text-sm font-semibold tracking-tight">NYRA</span>
      )}
    </div>
  );
}
