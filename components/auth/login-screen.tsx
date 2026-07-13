"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, ShieldCheck, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { Logo } from "@/components/layout/logo";

/** One-click demo accounts so reviewers can explore without credentials. */
const DEMO_ACCOUNTS = [
  {
    key: "admin",
    label: "Sign in as Admin",
    sublabel: "Full access — teams, targets, hospitals",
    email: "ram@gmail.com",
    icon: ShieldCheck,
  },
  {
    key: "rep",
    label: "Sign in as Sales Rep",
    sublabel: "Field view — leads, follow-ups, targets",
    email: "ravi@myteamflow.com",
    icon: UserRound,
  },
] as const;

const DEMO_PASSWORD = "demo1234";

export function LoginScreen() {
  const auth = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [demoSubmitting, setDemoSubmitting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Already signed in? Bounce to performance.
  useEffect(() => {
    if (auth.isLoaded && auth.user) {
      router.replace("/performance");
    }
  }, [auth.isLoaded, auth.user, router]);

  const handleDemoSignIn = async (account: (typeof DEMO_ACCOUNTS)[number]) => {
    if (submitting || demoSubmitting) return;
    setError(null);
    setDemoSubmitting(account.key);
    try {
      await auth.signIn(account.email, DEMO_PASSWORD);
      router.replace("/performance");
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Demo sign in failed. Check your network and try again.";
      setError(message);
      setDemoSubmitting(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("Enter both email and password.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await auth.signIn(email, password);
      router.replace("/performance");
    } catch (err) {
      // Surface the backend's message verbatim — login errors are usually
      // "Invalid credentials" or rate-limit messages users need to see.
      const message =
        err instanceof Error
          ? err.message
          : "Sign in failed. Check your network and try again.";
      setError(message);
      setSubmitting(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center bg-background px-6">
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center">
          <Logo />
        </div>

        <Card className="p-8 sm:p-10">
          <div className="space-y-1 text-center">
            <h1 className="text-2xl font-semibold tracking-tight">
              Sign in
            </h1>
            <p className="text-sm text-zinc-500">
              Welcome back. Sign in to your dashboard.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="login-email">Email</Label>
              <Input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="you@company.com"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="login-password">Password</Label>
              <div className="relative">
                <Input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-xs text-red-600 dark:text-red-400" role="alert">
                {error}
              </p>
            )}

            <Button
              type="submit"
              className="h-10 w-full"
              disabled={submitting || demoSubmitting !== null}
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Sign in
            </Button>
          </form>

          {/* Demo access for reviewers — no credentials needed */}
          <div className="mt-7">
            <div className="flex items-center gap-3">
              <span className="h-px flex-1 bg-border" />
              <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500">
                or explore a demo
              </span>
              <span className="h-px flex-1 bg-border" />
            </div>
            <div className="mt-4 grid gap-2.5">
              {DEMO_ACCOUNTS.map((account) => {
                const Icon = account.icon;
                const loading = demoSubmitting === account.key;
                return (
                  <Button
                    key={account.key}
                    type="button"
                    variant="outline"
                    className="h-auto w-full justify-start gap-3 px-4 py-3"
                    disabled={submitting || demoSubmitting !== null}
                    onClick={() => handleDemoSignIn(account)}
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                    ) : (
                      <Icon className="h-4 w-4 shrink-0 text-zinc-500" />
                    )}
                    <span className="flex flex-col items-start">
                      <span className="text-sm font-medium">{account.label}</span>
                      <span className="text-xs font-normal text-zinc-500">
                        {account.sublabel}
                      </span>
                    </span>
                  </Button>
                );
              })}
            </div>
            <p className="mt-3 text-center text-xs text-zinc-500">
              Demo environment with sample data — resets periodically.
            </p>
          </div>
        </Card>
      </div>
    </main>
  );
}
