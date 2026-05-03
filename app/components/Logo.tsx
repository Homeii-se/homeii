/**
 * Homeii brand logo
 *
 * The wordmark is set in DM Sans (light, weight 300) with a green accent dot
 * after the final "i". The optional tagline below uses Geist medium with
 * upper-case letterforms and wide tracking — used on landing/hero placements.
 *
 * Sizing is controlled via the `size` prop. Tagline visibility is controlled
 * via the `withTagline` prop. The `tone` prop switches between dark wordmark
 * (default, for light backgrounds) and light wordmark (for dark backgrounds
 * like the brand-900 sticky header). The dot stays the same green in both
 * tones since it reads on any background. The component renders semantic
 * text rather than an SVG so it scales perfectly, is accessible to screen
 * readers, and is theme-friendly.
 */
type LogoProps = {
  /** Visual size preset. `header` is tuned for the sticky top nav; `hero` is
   *  larger and intended for landing-page placements. */
  size?: "header" | "hero";
  /** Wordmark color. `dark` uses brand-900 (for light bg); `light` uses white
   *  with a slight off-white tagline (for dark/brand bg). */
  tone?: "dark" | "light";
  /** Render the "Din energirådgivare" tagline beneath the wordmark. */
  withTagline?: boolean;
  /** Extra classes for the outer wrapper. */
  className?: string;
};

const SIZE_CLASSES = {
  header: {
    wordmark: "text-3xl sm:text-4xl",
    tagline: "text-[10px] sm:text-xs mt-1",
  },
  hero: {
    wordmark: "text-6xl sm:text-7xl",
    tagline: "text-sm sm:text-base mt-3",
  },
} as const;

const TONE_CLASSES = {
  dark: {
    wordmark: "text-brand-900",
    tagline: "text-brand-700",
  },
  light: {
    wordmark: "text-white",
    tagline: "text-white/70",
  },
} as const;

export default function Logo({
  size = "header",
  tone = "dark",
  withTagline = false,
  className = "",
}: LogoProps) {
  const sizeStyles = SIZE_CLASSES[size];
  const toneStyles = TONE_CLASSES[tone];

  return (
    <span
      aria-label="homeii — din energirådgivare"
      className={`inline-flex flex-col items-start leading-none ${className}`}
    >
      <span
        className={`font-[family-name:var(--font-dm-sans)] font-light tracking-[-0.04em] ${toneStyles.wordmark} ${sizeStyles.wordmark}`}
        aria-hidden="true"
      >
        homeii<span className="text-green-light">.</span>
      </span>
      {withTagline && (
        <span
          className={`font-medium uppercase tracking-[0.35em] ${toneStyles.tagline} ${sizeStyles.tagline}`}
          aria-hidden="true"
        >
          Din energirådgivare
        </span>
      )}
    </span>
  );
}
