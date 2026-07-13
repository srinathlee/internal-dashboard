"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronsLeft, ChevronsRight } from "lucide-react";

import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import {
  getInitials,
  roleLabel,
  teamDisplayName,
  teamDotClass,
} from "@/lib/format";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

import { NAV_GROUPS, NAV_ITEMS, type NavItem } from "./nav-config";
import { Logo } from "./logo";

const COLLAPSE_STORAGE_KEY = "myteamflow:sidebar-collapsed";
const GROUPS_COLLAPSED_STORAGE_KEY = "myteamflow:sidebar-groups-collapsed";

/**
 * Per-group collapse state persisted to localStorage. true = collapsed.
 * Hook reads on mount (no SSR access), writes through on every change.
 */
function useCollapsedGroups() {
  const [state, setState] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(GROUPS_COLLAPSED_STORAGE_KEY);
      if (raw) setState(JSON.parse(raw));
    } catch {
      // ignore — fall through to defaults
    }
  }, []);

  const toggle = useCallback((id: string) => {
    setState((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try {
        window.localStorage.setItem(
          GROUPS_COLLAPSED_STORAGE_KEY,
          JSON.stringify(next),
        );
      } catch {
        // ignore — non-persisted toggle is acceptable
      }
      return next;
    });
  }, []);

  return [state, toggle] as const;
}

function NavLink({
  item,
  pathname,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  const active =
    pathname === item.href || pathname.startsWith(item.href + "/");
  const link = (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex h-9 items-center gap-3 rounded-lg text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        collapsed ? "justify-center px-0" : "px-3",
        active
          ? "bg-zinc-100 font-medium text-zinc-900 dark:bg-zinc-900 dark:text-zinc-50"
          : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-50",
      )}
    >
      <Icon
        aria-hidden
        className={cn(
          "h-4 w-4 shrink-0",
          active ? "text-indigo-600 dark:text-indigo-400" : "text-zinc-500",
        )}
      />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );
  if (!collapsed) return link;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{item.label}</TooltipContent>
    </Tooltip>
  );
}

/**
 * Shared sidebar contents — used by both the desktop fixed rail and the
 * mobile sheet. Caller provides `collapsed`; the mobile sheet always passes false.
 */
function SidebarBody({
  collapsed,
  onToggleCollapse,
  onNavigate,
}: {
  collapsed: boolean;
  onToggleCollapse?: () => void;
  /** Called after a nav link is clicked — used to close the mobile sheet. */
  onNavigate?: () => void;
}) {
  const auth = useAuth();
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((item) => item.show(auth));
  const user = auth.user;
  const teamLabel = user?.teamId ? teamDisplayName(user.teamId) : null;
  const [collapsedGroups, toggleGroup] = useCollapsedGroups();

  /**
   * Resolve `item.group` once per (item, viewer) — function-form groups depend
   * on the auth context. Memoized so we don't pay the cost twice (once for
   * group bucketing, once for the active-route check).
   */
  const itemGroupMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of items) {
      const id =
        typeof item.group === "function" ? item.group(auth) : item.group;
      map.set(item.href, id);
    }
    return map;
  }, [items, auth]);

  // Force a group to render expanded when its active link is the current
  // pathname — otherwise navigating to /sales/leads while the group is
  // collapsed would hide the user's location from the sidebar entirely.
  const activeGroupIds = useMemo(() => {
    const ids = new Set<string>();
    for (const item of items) {
      const isActive =
        pathname === item.href || pathname.startsWith(item.href + "/");
      if (isActive) {
        const groupId = itemGroupMap.get(item.href);
        if (groupId) ids.add(groupId);
      }
    }
    return ids;
  }, [items, pathname, itemGroupMap]);

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex h-full flex-col bg-white dark:bg-zinc-950">
        {/* Top: logo + collapse toggle */}
        <div
          className={cn(
            "flex h-14 items-center border-b border-zinc-200 px-3 dark:border-zinc-800",
            collapsed ? "justify-center" : "justify-between",
          )}
        >
          <Logo collapsed={collapsed} />
          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className={cn(
                "hidden h-8 w-8 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-zinc-900 dark:hover:text-zinc-50 lg:flex",
                collapsed && "absolute right-2",
              )}
            >
              {collapsed ? (
                <ChevronsRight className="h-4 w-4" />
              ) : (
                <ChevronsLeft className="h-4 w-4" />
              )}
            </button>
          )}
        </div>

        {/* Nav */}
        <nav
          aria-label="Primary"
          className={cn(
            "flex flex-1 flex-col overflow-y-auto py-4",
            collapsed ? "px-2" : "px-3",
          )}
        >
          {NAV_GROUPS.map((group, idx) => {
            const groupItems = items.filter(
              (i) => itemGroupMap.get(i.href) === group.id,
            );
            if (groupItems.length === 0) return null;
            const label =
              typeof group.label === "function"
                ? group.label(auth)
                : group.label;

            // A collapsible group is forced open if it contains the active
            // route, regardless of stored state.
            const hasActive = activeGroupIds.has(group.id);
            const isGroupCollapsed =
              !!group.collapsible && !collapsed && !hasActive && !!collapsedGroups[group.id];
            const showHeaderAsButton =
              !!group.collapsible && !collapsed && !!label;
            // The "bottom" group (Settings) hugs the bottom of the nav so it
            // sits right above the user-identity footer instead of floating
            // mid-rail when other groups are empty.
            const isBottomGroup = group.id === "bottom";

            return (
              <div
                key={group.id}
                className={cn(
                  idx > 0 && !isBottomGroup && "mt-5",
                  isBottomGroup && "mt-auto pt-3",
                )}
              >
                {!collapsed && label && (
                  showHeaderAsButton ? (
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.id)}
                      aria-expanded={!isGroupCollapsed}
                      aria-controls={`nav-group-${group.id}`}
                      className="mb-1.5 flex w-full items-center justify-between rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 transition-colors hover:text-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-zinc-500 dark:hover:text-zinc-300"
                    >
                      <span>{label}</span>
                      <ChevronDown
                        aria-hidden
                        className={cn(
                          "h-3 w-3 transition-transform duration-150",
                          isGroupCollapsed && "-rotate-90",
                        )}
                      />
                    </button>
                  ) : (
                    <div className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                      {label}
                    </div>
                  )
                )}
                {!isGroupCollapsed && (
                  <div id={`nav-group-${group.id}`} className="space-y-1">
                    {groupItems.map((item) => (
                      <NavLink
                        key={item.href}
                        item={item}
                        pathname={pathname}
                        collapsed={collapsed}
                        onNavigate={onNavigate}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Footer: user identity */}
        {user && (
          <div
            className={cn(
              "border-t border-zinc-200 dark:border-zinc-800",
              collapsed ? "p-2" : "p-3",
            )}
          >
            <div
              className={cn(
                "flex items-center gap-3 rounded-lg",
                collapsed ? "justify-center" : "px-2 py-1.5",
              )}
            >
              <Avatar className="h-8 w-8">
                <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
              </Avatar>
              {!collapsed && (
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{user.name}</div>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    {user.teamId && (
                      <span
                        aria-hidden
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          teamDotClass(user.teamId),
                        )}
                      />
                    )}
                    <span className="truncate text-xs text-zinc-500">
                      {teamLabel ?? roleLabel(user.role)}
                    </span>
                  </div>
                </div>
              )}
              {!collapsed && (
                <Badge variant="outline" className="shrink-0 text-[10px]">
                  {user.role === "super_admin"
                    ? "SUPER"
                    : user.role === "admin"
                      ? "ADMIN"
                      : "MEMBER"}
                </Badge>
              )}
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

/**
 * Desktop sidebar — fixed-width rail, hidden on mobile.
 * Manages its own collapse state, persisted to localStorage.
 */
export function DesktopSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(COLLAPSE_STORAGE_KEY);
      if (stored === "1") setCollapsed(true);
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  const toggle = () => {
    setCollapsed((c) => {
      const next = !c;
      try {
        window.localStorage.setItem(COLLAPSE_STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  return (
    <aside
      // Avoid flashing the collapsed state on first paint before hydration
      style={hydrated ? undefined : { visibility: "hidden" }}
      className={cn(
        "sticky top-0 hidden h-screen shrink-0 border-r border-zinc-200 transition-[width] duration-150 dark:border-zinc-800 lg:block",
        collapsed ? "w-16" : "w-64",
      )}
    >
      <SidebarBody collapsed={collapsed} onToggleCollapse={toggle} />
    </aside>
  );
}

/** Used inside a <SheetContent>. Always renders expanded. */
export function MobileSidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  return <SidebarBody collapsed={false} onNavigate={onNavigate} />;
}
