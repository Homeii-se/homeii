import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono, Fraunces, DM_Sans } from "next/font/google";
import MobileNav from "./simulator/components/MobileNav";
import ChatDrawer from "./simulator/components/ChatDrawer";
import Logo from "./components/Logo";
import { NAV_ITEMS } from "@/lib/nav-items";
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

// DM Sans drives the brand wordmark in <Logo />. Loaded here so the typography
// is consistent with the rest of the UI even when DM Sans isn't installed
// system-wide.
const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
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
      <body className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} ${dmSans.variable} min-h-screen antialiased text-text-primary`}>
        <a href="#main-content" className="sr-only sr-only-focusable">Hoppa till innehåll</a>

        <header className="sticky top-0 z-50 border-b border-brand-900 bg-brand-900">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
            <Link
              href="/"
              aria-label="homeii — gå till startsidan"
              className="flex items-center rounded-md outline-none ring-green-light focus-visible:ring-2"
            >
              <Logo size="header" tone="light" />
            </Link>

            {/* Desktop nav */}
            <nav className="hidden sm:flex items-center gap-1">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-white/70 transition-colors hover:text-white hover:bg-white/10"
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            {/* Mobile nav */}
            <MobileNav />
          </div>
        </header>

        {/* pb-20 ger plats åt ChatDrawer-peek (~64px) längst ned */}
        <main id="main-content" className="pb-20">{children}</main>

        {/* Global AI-rådgivare — drag-bar bottom drawer på alla sidor */}
        <ChatDrawer />

        <footer className="border-t border-brand-900/10 bg-bg-warm py-8">
          <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6">
            <span className="font-[family-name:var(--font-dm-sans)] text-xl font-light tracking-[-0.04em] text-brand-900">
              homeii<span className="text-green-light">.</span>
            </span>
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
