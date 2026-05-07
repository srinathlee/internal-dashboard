import Image from "next/image";

/**
 * Full-screen NyraAI loading splash. Theme-aware:
 *   - Light: white background, deep-blue glow + ring palette, deep-blue text.
 *   - Dark:  black background, cyan glow, lighter sky-blue text.
 *
 * Theme is keyed off the `.dark` class set on <html> by next-themes — Tailwind
 * `dark:` modifiers cover colors here, while the variant-specific keyframes
 * (different glow filters and ring opacities) live in globals.css.
 */
export function NyraLoader() {
  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-7 bg-white dark:bg-black"
      role="status"
      aria-live="polite"
      aria-label="Loading"
    >
      <div className="relative flex h-[280px] w-[280px] items-center justify-center">
        <span
          aria-hidden
          className="nyra-ring absolute left-1/2 top-1/2 -ml-[110px] -mt-[110px] h-[220px] w-[220px] rounded-full border-2 border-[#1E5FE8] opacity-0 dark:border-[#2BC4F2]"
          style={{ animationDelay: "0s" }}
        />
        <span
          aria-hidden
          className="nyra-ring absolute left-1/2 top-1/2 -ml-[110px] -mt-[110px] h-[220px] w-[220px] rounded-full border-2 border-[#2BC4F2] opacity-0 dark:border-[#1E5FE8]"
          style={{ animationDelay: "0.8s" }}
        />
        <span
          aria-hidden
          className="nyra-ring absolute left-1/2 top-1/2 -ml-[110px] -mt-[110px] h-[220px] w-[220px] rounded-full border-2 border-[#1E5FE8] opacity-0 dark:border-[#2BC4F2]"
          style={{ animationDelay: "1.6s" }}
        />
        <Image
          src="/nyra-logo.png"
          alt="NyraAI"
          width={220}
          height={220}
          priority
          className="nyra-logo-breathe relative z-[2] object-contain"
        />
      </div>

      <div className="flex items-center gap-2.5 text-[13px] font-semibold uppercase tracking-[0.15em] text-[#1E5FE8] dark:font-medium dark:text-[#7BB3F0]">
        <span>Loading</span>
        <span className="inline-flex gap-1.5">
          <span
            aria-hidden
            className="inline-block h-1.5 w-1.5 rounded-full bg-[#1E5FE8] dark:bg-[#2BC4F2]"
            style={{ animation: "nyra-dot 1.4s infinite ease-in-out both" }}
          />
          <span
            aria-hidden
            className="inline-block h-1.5 w-1.5 rounded-full bg-[#1E5FE8] dark:bg-[#2BC4F2]"
            style={{
              animation: "nyra-dot 1.4s infinite ease-in-out both",
              animationDelay: "0.2s",
            }}
          />
          <span
            aria-hidden
            className="inline-block h-1.5 w-1.5 rounded-full bg-[#1E5FE8] dark:bg-[#2BC4F2]"
            style={{
              animation: "nyra-dot 1.4s infinite ease-in-out both",
              animationDelay: "0.4s",
            }}
          />
        </span>
      </div>
    </div>
  );
}
