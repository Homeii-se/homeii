import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono, Fraunces } from "next/font/google";
import MobileNav from "./simulator/components/MobileNav";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["300", "400", "600"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "HOMEii – Din oberoende energirådgivare",
  description:
    "Vi analyserar din elräkning och ger dig personliga rekommendationer för att sänka dina energikostnader. Helt gratis, helt oberoende.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="sv">
      <body className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} min-h-screen antialiased text-text-primary`}>
        <a href="#main-content" className="sr-only sr-only-focusable">Hoppa till innehåll</a>

        <header className="sticky top-0 z-50 border-b border-brand-900 bg-brand-900">
          <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
            <Link href="/" className="flex items-center gap-2.5 rounded-md outline-none ring-green-light focus-visible:ring-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-green-light shadow-sm">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="12" r="6.5" stroke="white" strokeWidth="1.8" />
                  <circle cx="12" cy="12" r="2.2" fill="white" />
                </svg>
              </span>
              <span className="text-lg font-bold text-white tracking-tight font-[family-name:var(--font-fraunces)]">HOMEii</span>
            </Link>

            {/* Desktop nav */}
            <nav className="hidden sm:flex items-center gap-1">
              <Link href="/" className="rounded-lg px-3 py-2 text-sm font-medium text-white/65 transition-colors hover:text-white hover:bg-white/10">
                Hem
              </Link>
              <Link href="/" className="rounded-lg px-3 py-2 text-sm font-medium text-white/65 transition-colors hover:text-white hover:bg-white/10">
                Simulator
              </Link>
              <Link href="/" className="rounded-lg px-3 py-2 text-sm font-medium text-white/65 transition-colors hover:text-white hover:bg-white/10">
                Om HOMEii
              </Link>
            </nav>

            {/* Mobile nav */}
            <MobileNav />
          </div>
        </header>

        <main id="main-content">{children}</main>

        <footer className="border-t border-gray-200 bg-white/95 py-8 shadow-sm">
          <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-lg bg-brand-500">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="12" r="6.2" stroke="white" strokeWidth="1.8" />
                  <circle cx="12" cy="12" r="2.1" fill="white" />
                </svg>
              </span>
              <span className="font-semibold text-brand-900">HOMEii</span>
            </div>
            <p className="text-center text-sm text-text-secondary sm:text-left">
              Oberoende energirådgivning — vi säljer ingenting
            </p>
            <p className="text-xs text-text-muted">
              © 2026 HOMEii. Alla beräkningar är uppskattningar.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
