import Link from "next/link";

/**
 * Shared placeholder for /kunskap sub-categories that don't have content yet.
 * Renders a hero block + back-link + "innehåll kommer snart"-message.
 */
interface KunskapPlaceholderProps {
  eyebrow: string;
  title: string;
  italicTitle?: string;
  subtitle: string;
  comingSoon: string[];
}

export default function KunskapPlaceholder({
  eyebrow,
  title,
  italicTitle,
  subtitle,
  comingSoon,
}: KunskapPlaceholderProps) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <Link
        href="/kunskap"
        className="mb-6 inline-flex items-center gap-1 text-xs font-medium text-text-muted hover:text-text-secondary transition-colors"
      >
        <span aria-hidden>&larr;</span> Tillbaka till Kunskap
      </Link>

      <div className="mb-10">
        <p className="mb-3 text-xs font-medium uppercase tracking-widest text-text-muted">
          {eyebrow}
        </p>
        <h1 className="text-3xl font-light leading-tight text-brand-900 sm:text-4xl font-[family-name:var(--font-fraunces)]">
          {title}
          {italicTitle && (
            <>
              {" "}
              <em className="text-brand-500">{italicTitle}</em>.
            </>
          )}
        </h1>
        <p className="mt-3 text-base leading-relaxed text-text-secondary">{subtitle}</p>
      </div>

      <div className="rounded-2xl border border-dashed border-brand-500/30 bg-brand-50/30 p-8">
        <p className="mb-4 text-xs font-medium uppercase tracking-widest text-brand-600">
          Innehåll kommer snart
        </p>
        <p className="mb-5 text-sm leading-relaxed text-text-secondary">
          Vi bygger ut den här sektionen löpande. På kommande artiklar:
        </p>
        <ul className="space-y-2 text-sm leading-relaxed text-text-secondary">
          {comingSoon.map((item) => (
            <li key={item} className="flex gap-2">
              <span className="text-brand-400" aria-hidden>·</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      <p className="mt-8 text-xs italic text-text-muted">
        Vill du att vi prioriterar något särskilt? Mejla{" "}
        <a href="mailto:hej@homeii.se" className="text-brand-500 underline hover:text-brand-700">
          hej@homeii.se
        </a>
        .
      </p>
    </div>
  );
}
