import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
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
      <body className={`${geistSans.variable} ${geistMono.variable} min-h-screen antialiased text-slate-100`}>
        <a href="#main-content" className="sr-only sr-only-focusable">Hoppa till innehåll</a>

        <header className="sticky top-0 z-50 border-b border-sky-200/20 bg-slate-900/80 backdrop-blur-md">
          <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
            <Link href="/" className="flex items-center gap-2.5 rounded-md outline-none ring-sky-400 focus-visible:ring-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 shadow-sm">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="12" r="6.5" stroke="white" strokeWidth="1.8" />
                  <circle cx="12" cy="12" r="2.2" fill="white" />
                </svg>
              </span>
              <span className="text-lg font-bold text-white tracking-tight">HOMEii</span>
            </Link>

            {/* Desktop nav */}
            <nav className="hidden sm:flex items-center gap-1">
              <Link href="/" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-white/10 hover:text-white">
                Hem
              </Link>
              <Link href="/" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-white/10 hover:text-white">
                Simulator
              </Link>
              <Link href="/" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-white/10 hover:text-white">
                Om HOMEii
              </Link>
            </nav>

            {/* Mobile nav */}
            <MobileNav />
          </div>
        </header>

        <main id="main-content">{children}</main>

        <footer className="border-t border-sky-200/20 bg-slate-900/80 py-8 backdrop-blur-md">
          <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-400 to-brand-600">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="12" r="6.2" stroke="white" strokeWidth="1.8" />
                  <circle cx="12" cy="12" r="2.1" fill="white" />
                </svg>
              </span>
              <span className="font-semibold text-white">HOMEii</span>
            </div>
            <p className="text-center text-sm text-slate-400 sm:text-left">
              Oberoende energirådgivning — vi säljer ingenting
            </p>
            <p className="text-xs text-slate-500">
              © 2026 HOMEii. Alla beräkningar är uppskattningar.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
