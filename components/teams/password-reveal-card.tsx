"use client";

import { useState } from "react";
import { Check, Copy, Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";

interface PasswordRevealCardProps {
  heading: string;
  email: string;
  password: string;
}

/**
 * One-time-display card for a freshly minted user's initial password.
 *
 * The password is always rendered as plain text by default (the whole
 * point of this card is to let the super admin copy it before the modal
 * closes). The eye toggle hides the value when the screen is being shared
 * so admins don't have to bounce focus around. Once the modal closes, the
 * password is gone — there is no "view password" anywhere else in the
 * product.
 */
export function PasswordRevealCard({
  heading,
  email,
  password,
}: PasswordRevealCardProps) {
  const [hidden, setHidden] = useState(false);
  const [copied, setCopied] = useState<"email" | "password" | null>(null);

  const copy = async (value: string, kind: "email" | "password") => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      // Clipboard may be blocked (insecure context); user can still select+copy.
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
      <div className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
        {heading}
      </div>

      <Row
        label="Email"
        value={email}
        copied={copied === "email"}
        onCopy={() => copy(email, "email")}
      />

      <Row
        label="Password"
        value={hidden ? "••••••••••" : password}
        copied={copied === "password"}
        onCopy={() => copy(password, "password")}
        right={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            onClick={() => setHidden((h) => !h)}
            aria-label={hidden ? "Show password" : "Hide password"}
          >
            {hidden ? (
              <Eye className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <EyeOff className="h-3.5 w-3.5" aria-hidden />
            )}
          </Button>
        }
      />

      <p className="text-[11px] text-amber-700/80 dark:text-amber-400/80">
        Copy this now — the password won't be shown again.
      </p>
    </div>
  );
}

function Row({
  label,
  value,
  copied,
  onCopy,
  right,
}: {
  label: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 rounded-md bg-white px-3 py-2 ring-1 ring-amber-200 dark:bg-zinc-950 dark:ring-amber-900/40">
      <span className="w-20 shrink-0 text-xs font-medium text-zinc-500">
        {label}
      </span>
      <span className="flex-1 truncate font-mono text-sm">{value}</span>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 px-2"
        onClick={onCopy}
      >
        {copied ? (
          <>
            <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
            Copied
          </>
        ) : (
          <>
            <Copy className="h-3.5 w-3.5" aria-hidden />
            Copy
          </>
        )}
      </Button>
      {right}
    </div>
  );
}
