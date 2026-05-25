"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ChevronRight, MessageSquare } from "lucide-react";

import { useAuth } from "@/lib/auth";
import { isSalesMember } from "@/lib/access";
import { ApiError } from "@/lib/api/client";
import { useMyAcpMessages } from "@/lib/hooks/use-accelerator";

/**
 * Header message inbox for Accelerator reps.
 *
 * Shows the coaching messages an admin sent this rep, read from
 * `GET /acp/me/messages` — the backend resolves the rep → `acp_member` from the
 * JWT, so no id is needed. Only sales `member` accounts mount the inbox, and a
 * 404 ("not an Accelerator member") hides the icon entirely, so it surfaces
 * for enrolled reps alone.
 *
 * The messages API has no server-side read state, so "unread" is tracked
 * locally: we remember the last time this rep opened the inbox (per user, in
 * localStorage) and count anything newer as unread. Opening the dropdown
 * marks everything seen.
 */
export function MessagesButton() {
  const auth = useAuth();
  // Gate before mounting the polling hook so non-sales users never poll.
  if (!isSalesMember(auth) || !auth.user) return null;
  return <MessagesInbox userId={auth.user.id} />;
}

const SEEN_PREFIX = "nyra:acp-msgs-seen:";

function readSeen(memberId: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(SEEN_PREFIX + memberId);
  } catch {
    return null;
  }
}

function writeSeen(memberId: string, iso: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SEEN_PREFIX + memberId, iso);
  } catch {
    // localStorage may be blocked — non-fatal, the badge just won't persist.
  }
}

/** Compact relative timestamp ("just now", "5m ago", "3h ago", date). */
function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const mins = Math.floor((Date.now() - then) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function MessagesInbox({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  // When set, the popover shows the full body of this one message instead of
  // the list. Tracked by id (not the message object) so it survives a refetch.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [seenAt, setSeenAt] = useState<string | null>(() => readSeen(userId));
  const containerRef = useRef<HTMLDivElement>(null);
  // Mirror selectedId into a ref so the Escape handler (which only re-binds on
  // `open`) reads the current value instead of a stale closure.
  const selectedRef = useRef<string | null>(null);
  selectedRef.current = selectedId;

  const msgs = useMyAcpMessages();
  const { refetch } = msgs;

  // A 404 from /me/messages means this rep isn't enrolled in the Accelerator
  // program — there's no inbox for them, so we hide the icon entirely (below)
  // and pause the interval poll (a 404 is stable; nothing to refresh). 401/403
  // shouldn't occur on a /me route, but treat them the same defensively.
  const notAcpMember =
    msgs.error instanceof ApiError &&
    (msgs.error.status === 404 ||
      msgs.error.status === 401 ||
      msgs.error.status === 403);

  // Keep the inbox fresh without a reload: poll every 60s and re-fetch on tab
  // focus. Background re-fetches don't flash the loading state (guarded below).
  // Focus-retry stays on even for non-members, so it self-heals the moment a
  // rep gets enrolled.
  useEffect(() => {
    const onFocus = () => void refetch();
    window.addEventListener("focus", onFocus);
    const id = notAcpMember
      ? null
      : window.setInterval(() => void refetch(), 60_000);
    return () => {
      if (id !== null) window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [refetch, notAcpMember]);

  // Close on outside-click / Escape (no Radix Popover primitive in this project).
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Escape mirrors the Back button: step out of a message first, then close.
      if (selectedRef.current) setSelectedId(null);
      else setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const messages = useMemo(() => msgs.data ?? [], [msgs.data]);

  const selected = useMemo(
    () => (selectedId ? messages.find((m) => m.id === selectedId) ?? null : null),
    [selectedId, messages],
  );

  // Always reopen on the list view — clear any prior selection when it closes.
  useEffect(() => {
    if (!open) setSelectedId(null);
  }, [open]);

  const unreadCount = useMemo(() => {
    if (!seenAt) return messages.length;
    const seen = new Date(seenAt).getTime();
    return messages.filter((m) => new Date(m.created_at).getTime() > seen).length;
  }, [messages, seenAt]);

  // Opening the dropdown refetches and marks everything seen up to now.
  useEffect(() => {
    if (!open) return;
    void refetch();
    const iso = new Date().toISOString();
    setSeenAt(iso);
    writeSeen(userId, iso);
  }, [open, refetch, userId]);

  // Accelerator-only: don't render anything until we've confirmed this rep is a
  // member via a successful /me/messages response (`data` is then an array,
  // even if empty). Non-members (404) and any error before the first success
  // keep `data` null, so the icon stays hidden. `useAsync` preserves the last
  // good `data` across a failed refetch, so a transient error won't hide an
  // already-visible inbox.
  if (!Array.isArray(msgs.data)) return null;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`${unreadCount} unread messages`}
        aria-expanded={open}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-50"
      >
        <MessageSquare className="h-4 w-4" aria-hidden />
        {unreadCount > 0 ? (
          <span
            aria-hidden
            className="absolute right-0.5 top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-violet-500 px-1 text-[10px] font-semibold text-white"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Messages"
          className="absolute right-0 top-[calc(100%+8px)] z-50 w-[360px] origin-top-right overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl animate-in fade-in-0 zoom-in-95 slide-in-from-top-1 duration-150 dark:border-zinc-800 dark:bg-zinc-950"
        >
          <div className="flex items-center gap-2 border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
            {selected ? (
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                aria-label="Back to all messages"
                className="-ml-1.5 grid h-7 w-7 shrink-0 place-items-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden />
              </button>
            ) : null}
            <h3 className="truncate text-sm font-semibold">
              {selected ? "Message from your coach" : "Messages from your coach"}
            </h3>
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            {selected ? (
              <div className="px-4 py-4">
                <div className="mb-3 flex items-center gap-3">
                  <span
                    aria-hidden
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-violet-100 dark:bg-violet-950/40"
                  >
                    <MessageSquare className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                  </span>
                  <div className="text-xs text-zinc-400">
                    {timeAgo(selected.created_at)}
                  </div>
                </div>
                <p className="whitespace-pre-line break-words text-sm leading-relaxed text-zinc-700 dark:text-zinc-200">
                  {selected.message}
                </p>
              </div>
            ) : messages.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-zinc-500">
                No messages yet.
              </div>
            ) : (
              messages.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSelectedId(m.id)}
                  className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/60"
                >
                  <span
                    aria-hidden
                    className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-md bg-violet-100 dark:bg-violet-950/40"
                  >
                    <MessageSquare className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 break-words text-sm leading-snug text-zinc-700 dark:text-zinc-200">
                      {m.message}
                    </p>
                    <div className="mt-1 text-xs text-zinc-400">
                      {timeAgo(m.created_at)}
                    </div>
                  </div>
                  <ChevronRight
                    aria-hidden
                    className="mt-0.5 h-4 w-4 shrink-0 text-zinc-300 dark:text-zinc-600"
                  />
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
