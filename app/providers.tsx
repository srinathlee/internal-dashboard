"use client";

import { ThemeProvider, useTheme } from "next-themes";
import { Toaster } from "sonner";
import { AuthProvider } from "@/lib/auth";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      storageKey="myteamflow:theme"
    >
      <AuthProvider>{children}</AuthProvider>
      <ThemedToaster />
    </ThemeProvider>
  );
}

/** Bind Sonner's theme to next-themes so toasts match the surrounding UI. */
function ThemedToaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Toaster
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast:
            "rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 shadow-sm",
          description: "text-zinc-500",
        },
      }}
    />
  );
}
