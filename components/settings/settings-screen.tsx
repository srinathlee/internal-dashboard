"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { ChevronRight, Monitor, Moon, Sun } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/layout/page-header";

import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { getInitials, roleLabel } from "@/lib/format";

const NOTIFICATION_PREFS_KEY = "myteamflow:notifications";

interface NotificationPrefs {
  dailyDigest: boolean;
  weeklyReport: boolean;
  teamActivity: boolean;
  productUpdates: boolean;
}

const DEFAULT_PREFS: NotificationPrefs = {
  dailyDigest: true,
  weeklyReport: true,
  teamActivity: false,
  productUpdates: true,
};

/**
 * /settings — appearance + notifications.
 *
 * Identity (name / email / password) lives at /profile. This screen still
 * shows a small "signed in as" banner at the top so the user can confirm
 * the active session without leaving the page.
 */
export function SettingsScreen() {
  const auth = useAuth();
  if (!auth.isLoaded) return <SettingsSkeleton />;
  if (!auth.user) {
    return (
      <Card className="p-12 text-center text-sm text-zinc-500">
        You're signed out.
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Appearance and notification preferences."
      />

      <SignedInBanner />

      <ThemeSection />

      <NotificationsSection />
    </div>
  );
}

// ---------------------------------------------------------------
// Signed-in banner
// ---------------------------------------------------------------

function SignedInBanner() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <Card className="flex items-center gap-3 p-4">
      <Avatar className="h-10 w-10">
        <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">
          Signed in as {user.name}
        </div>
        <div className="truncate text-xs text-zinc-500">
          {roleLabel(user.role)}
          {user.email ? ` · ${user.email}` : ""}
        </div>
      </div>
      <Link
        href="/profile"
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-zinc-50"
      >
        Manage profile
        <ChevronRight className="h-3.5 w-3.5" aria-hidden />
      </Link>
    </Card>
  );
}

// ---------------------------------------------------------------
// Theme
// ---------------------------------------------------------------

function ThemeSection() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const current = (mounted ? theme : "system") ?? "system";

  const options: { value: string; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Monitor },
  ];

  return (
    <SectionCard
      title="Appearance"
      description="Theme persists across reloads on this device."
    >
      <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-3">
        {options.map((o) => {
          const active = current === o.value;
          const Icon = o.icon;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setTheme(o.value)}
              className={cn(
                "flex flex-col items-center gap-2 rounded-lg border p-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active
                  ? "border-indigo-500 bg-indigo-50/50 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-950/30 dark:text-indigo-300"
                  : "border-zinc-200 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900",
              )}
            >
              <Icon
                className={cn(
                  "h-5 w-5",
                  active
                    ? "text-indigo-600 dark:text-indigo-400"
                    : "text-zinc-500",
                )}
                aria-hidden
              />
              {o.label}
            </button>
          );
        })}
      </div>
      {mounted && (
        <p className="mt-3 text-xs text-zinc-500">
          Currently rendering: <span className="font-medium text-zinc-700 dark:text-zinc-300">{resolvedTheme}</span>
        </p>
      )}
    </SectionCard>
  );
}

// ---------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------

function NotificationsSection() {
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(NOTIFICATION_PREFS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<NotificationPrefs>;
        setPrefs({ ...DEFAULT_PREFS, ...parsed });
      }
    } catch {
      // ignore — fall back to defaults
    }
    setHydrated(true);
  }, []);

  const update = (key: keyof NotificationPrefs, value: boolean) => {
    setPrefs((p) => {
      const next = { ...p, [key]: value };
      try {
        window.localStorage.setItem(NOTIFICATION_PREFS_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const rows: { key: keyof NotificationPrefs; label: string; hint: string }[] = [
    {
      key: "dailyDigest",
      label: "Daily digest",
      hint: "A morning email with yesterday's key metrics.",
    },
    {
      key: "weeklyReport",
      label: "Weekly report",
      hint: "Friday recap of weekly progress against targets.",
    },
    {
      key: "teamActivity",
      label: "Team activity",
      hint: "When teammates close deals or onboard customers.",
    },
    {
      key: "productUpdates",
      label: "Product updates",
      hint: "Occasional emails about new dashboard features.",
    },
  ];

  return (
    <SectionCard
      title="Notifications"
      description="Email preferences. Visual only in v1 — no emails are sent."
    >
      <ul role="list" className="-my-1 divide-y divide-zinc-100 dark:divide-zinc-800">
        {rows.map((r) => (
          <li
            key={r.key}
            className="flex items-start justify-between gap-4 py-3"
          >
            <div className="min-w-0">
              <Label htmlFor={`notif-${r.key}`} className="block text-sm font-medium normal-case tracking-normal text-zinc-900 dark:text-zinc-100">
                {r.label}
              </Label>
              <p className="mt-0.5 text-xs text-zinc-500">{r.hint}</p>
            </div>
            <Switch
              id={`notif-${r.key}`}
              checked={hydrated ? prefs[r.key] : DEFAULT_PREFS[r.key]}
              onCheckedChange={(v) => update(r.key, v)}
            />
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

// ---------------------------------------------------------------
// Shared
// ---------------------------------------------------------------

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-6 sm:p-8">
      <div className="space-y-1">
        <h2 className="text-lg font-medium tracking-tight">{title}</h2>
        {description && <p className="text-sm text-zinc-500">{description}</p>}
      </div>
      <div className="mt-6">{children}</div>
    </Card>
  );
}

function SettingsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-7 w-48 animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-800" />
        <div className="h-4 w-72 animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-800" />
      </div>
      <Card className="h-20 animate-pulse" />
      <Card className="h-32 animate-pulse" />
      <Card className="h-44 animate-pulse" />
    </div>
  );
}
