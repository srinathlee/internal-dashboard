import { Construction } from "lucide-react";

interface PagePlaceholderProps {
  title: string;
  description?: string;
  /** Phase number that will deliver real content. */
  phase: number;
}

/**
 * Phase 2 placeholder. Each page is wired up so the sidebar/header can be
 * verified end-to-end; the actual content lands in subsequent phases.
 */
export function PagePlaceholder({ title, description, phase }: PagePlaceholderProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && (
          <p className="text-sm text-zinc-500">{description}</p>
        )}
      </div>
      <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <Construction className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Lands in Phase {phase}.
        </p>
      </div>
    </div>
  );
}
