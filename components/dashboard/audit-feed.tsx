import type { AuditAction, AuditLogEntry, User } from "@/lib/types";
import { timeAgo } from "@/lib/format-metric";

const ACTION_LABEL: Record<AuditAction, string> = {
  "user.login": "logged in",
  "user.logout": "signed out",
  "user.invite": "invited",
  "user.role_change": "changed role for",
  "user.deactivate": "deactivated",
  "team.member_add": "added member to",
  "team.member_remove": "removed member from",
  "targets.update": "updated targets for",
  "performance.export": "exported performance",
};

interface AuditFeedProps {
  entries: AuditLogEntry[];
  users: User[];
  nowIso: string;
}

export function AuditFeed({ entries, users, nowIso }: AuditFeedProps) {
  if (entries.length === 0) return <AuditFeedEmpty />;
  const userById = new Map(users.map((u) => [u.id, u]));

  return (
    <ul role="list" className="-my-3 divide-y divide-zinc-100 dark:divide-zinc-800">
      {entries.map((e) => {
        const actor = userById.get(e.actorId);
        return (
          <li key={e.id} className="flex items-start gap-3 py-3">
            <span
              aria-hidden
              className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-400"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm">
                <span className="font-medium">{actor?.name ?? "Unknown"}</span>{" "}
                <span className="text-zinc-600 dark:text-zinc-400">
                  {ACTION_LABEL[e.action]}
                </span>{" "}
                <span className="font-medium">{e.resource}</span>
              </p>
              <p className="mt-0.5 text-xs text-zinc-500">
                {timeAgo(e.timestamp, nowIso)}
                {e.details && (
                  <>
                    <span className="mx-1.5 text-zinc-300 dark:text-zinc-700">·</span>
                    <span>{e.details}</span>
                  </>
                )}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function AuditFeedEmpty() {
  return (
    <div className="py-8 text-center text-sm text-zinc-500">
      No recent audit events.
    </div>
  );
}
