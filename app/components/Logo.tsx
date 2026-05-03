/**
 * Homeii brand logo
 *
 * The wordmark is set in DM Sans (light, weight 300) with a green accent dot
 * after the final "i". The optional tagline below uses Geist medium with
 * upper-case letterforms and wide tracking — used on landing/hero placements.
 *
 * Colors come from the design system:
 *   - wordmark: text-brand-900 (#1A3C2A)
 *   - dot:      text-green-light (#52B788)
 *   - tagline:  text-brand-700 (close to ink-soft #2E5640)
 *
 * Sizing is controlled via the `size` prop. Tagline visibility is controlled
 * via the `withTagline` prop. The component renders semantic text rather than
 * an SVG so it scales perfectly, is accessible to screen readers, and is
 * theme-friendly.
 */
type LogoProps = {
  /** Visual size preset. `header` is tuned for the sticky top nav; `hero` is
   *  larger and intended for landing-page placements. */
  size?: "header" | "hero";
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

export default function Logo({
  size = "header",
  withTagline = false,
  className = "",
}: LogoProps) {
  const styles = SIZE_CLASSES[size];

  return (
    <span
      aria-label="homeii — din energirådgivare"
      className={`inline-flex flex-col items-start leading-none ${className}`}
    >
      <span
        className={`font-[family-name:var(--font-dm-sans)] font-light tracking-[-0.04em] text-brand-900 ${styles.wordmark}`}
        aria-hidden="true"
      >
        homeii<span className="text-green-light">.</span>
      </span>
      {withTagline && (
        <span
          className={`font-medium uppercase tracking-[0.35em] text-brand-700 ${styles.tagline}`}
          aria-hidden="true"
        >
          Din energirådgivare
        </span>
      )}
    </span>
  );
}
