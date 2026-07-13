import Image from "next/image";

/**
 * Full-screen MyTeamFlow loading splash: the faceted "M" brand mark floating
 * with a pulsing glow, wordmark letters rising in one by one with a blue→cyan
 * gradient flowing across them, and bouncing loading dots.
 *
 * Theme-aware via the `.dark` class next-themes sets on <html>; the gradient
 * palettes and reduced-motion fallbacks live in globals.css (mtf-* rules).
 */

const WORD = "MyTeamFlow";

export function AppLoader() {
  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-8 bg-white dark:bg-black"
      role="status"
      aria-live="polite"
      aria-label="Loading MyTeamFlow"
    >
      {/* brand mark: gentle float + glow pulse */}
      <Image
        src="/myteamflow-logo.svg"
        alt=""
        aria-hidden
        width={120}
        height={102}
        priority
        className="mtf-mark h-[102px] w-[120px] object-contain"
      />

      {/* animated wordmark */}
      <h1 className="select-none text-4xl font-bold tracking-tight sm:text-5xl" aria-hidden>
        {WORD.split("").map((ch, i) => (
          <span
            key={i}
            className="mtf-letter"
            style={{ animationDelay: `${i * 0.07}s, ${i * 0.18}s` }}
          >
            {ch}
          </span>
        ))}
      </h1>

      {/* loading dots */}
      <div className="flex items-center gap-2.5 text-[13px] font-semibold uppercase tracking-[0.15em] text-[#0E8FD8] dark:font-medium dark:text-[#6CC6F7]">
        <span>Loading</span>
        <span className="inline-flex gap-1.5" aria-hidden>
          {[0, 0.2, 0.4].map((delay) => (
            <span
              key={delay}
              className="inline-block h-1.5 w-1.5 rounded-full bg-[#0E8FD8] dark:bg-[#29ABF2]"
              style={{ animation: "mtf-dot 1.4s infinite ease-in-out both", animationDelay: `${delay}s` }}
            />
          ))}
        </span>
      </div>
    </div>
  );
}
