import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Common layout wrapper for /om sub-pages.
 * Provides consistent breadcrumb, title block and back-to-hub link.
 */
interface OmPageLayoutProps {
  eyebrow: string;
  title: ReactNode;
  subtitle?: string;
  children: ReactNode;
}

export default function OmPageLayout({ eyebrow, title, subtitle, children }: OmPageLayoutProps) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <Link
        href="/om"
        className="mb-6 inline-flex items-center gap-1 text-xs font-medium text-text-muted hover:text-text-secondary transition-colors"
      >
        <span aria-hidden>&larr;</span> Tillbaka till Om HOMEii
      </Link>

      <div className="mb-8">
        <p className="mb-3 text-xs font-medium uppercase tracking-widest text-text-muted">
          {eyebrow}
        </p>
        <h1 className="text-3xl font-light leading-tight text-brand-900 sm:text-4xl font-[family-name:var(--font-fraunces)]">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-3 text-base leading-relaxed text-text-secondary">{subtitle}</p>
        )}
      </div>

      <div className="prose-sized">{children}</div>
    </div>
  );
}
