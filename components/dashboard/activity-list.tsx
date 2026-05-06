import type { ActivityEntry } from "@/lib/types";
import { timeAgo } from "@/lib/format-metric";

interface ActivityListProps {
  entries: ActivityEntry[];
  /** Used as "now" for relative timestamps so SSR matches client render. */
  nowIso: string;
}

export function ActivityList({ entries, nowIso }: ActivityListProps) {
  if (entries.length === 0) return <ActivityListEmpty />;
  return (
    <ul role="list" className="-my-3 divide-y divide-zinc-100 dark:divide-zinc-800">
      {entries.map((e) => (
        <li key={e.id} className="flex items-start gap-3 py-3">
          <span
            aria-hidden
            className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-zinc-900 dark:text-zinc-100">{e.text}</p>
            <p className="mt-0.5 text-xs text-zinc-500">
              {timeAgo(e.timestamp, nowIso)}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function ActivityListEmpty() {
  return (
    <div className="py-8 text-center text-sm text-zinc-500">
      No recent activity.
    </div>
  );
}
