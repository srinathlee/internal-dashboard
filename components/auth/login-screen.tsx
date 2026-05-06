"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { Logo } from "@/components/layout/logo";

export function LoginScreen() {
  const auth = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Already signed in? Bounce to dashboard.
  useEffect(() => {
    if (auth.isLoaded && auth.user) {
      router.replace("/dashboard");
    }
  }, [auth.isLoaded, auth.user, router]);

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
      router.replace("/dashboard");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Sign in failed. Try again.",
      );
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
                placeholder="you@nyra.ai"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="login-password">Password</Label>
              <Input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="text-xs text-red-600 dark:text-red-400" role="alert">
                {error}
              </p>
            )}

            <Button
              type="submit"
              className="h-10 w-full"
              disabled={submitting}
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Sign in
            </Button>
          </form>

          <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-wide text-zinc-400">
            <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
            <span>or</span>
            <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
          </div>

          <Button
            type="button"
            variant="outline"
            className="h-10 w-full"
            onClick={() => {
              setError("Google sign-in is visual only in v1.");
            }}
          >
            <GoogleIcon className="h-4 w-4" />
            Continue with Google
          </Button>
        </Card>

        <p className="text-center text-xs text-zinc-500">
          Tip: any credentials work. Match a known email
          {" "}
          <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[11px] dark:bg-zinc-800">
            priya.sharma@nyra.ai
          </code>
          {" "}to sign in as that user.
        </p>
      </div>
    </main>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  // Inline SVG keeps us free of an external icon dep for one-off marks
  return (
    <svg
      viewBox="0 0 48 48"
      aria-hidden="true"
      className={className}
    >
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3a12 12 0 0 1-11.3 8 12 12 0 1 1 7.6-21.3l5.7-5.7A20 20 0 1 0 24 44a20 20 0 0 0 20-20c0-1.4-.1-2.4-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="m6.3 14.7 6.6 4.8A12 12 0 0 1 24 12a12 12 0 0 1 7.6 2.7l5.7-5.7A20 20 0 0 0 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.3 0 10-2 13.5-5.4l-6.2-5.2A12 12 0 0 1 24 36a12 12 0 0 1-11.3-8l-6.6 5A20 20 0 0 0 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3a12 12 0 0 1-4.1 5.4l6.2 5.2A20 20 0 0 0 44 24c0-1.4-.1-2.4-.4-3.5z"
      />
    </svg>
  );
}
