"use client";

import { useState } from "react";
import Link from "next/link";

export default function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <div className="sm:hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-white/75 transition-colors hover:bg-white/10 hover:text-white"
        aria-label={open ? "Stäng meny" : "Öppna meny"}
      >
        {open ? (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )}
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-14 z-40 border-b border-gray-200 bg-white/98 shadow-lg">
          <nav className="mx-auto flex max-w-5xl flex-col px-4 py-3">
            <Link
              href="/"
              onClick={() => setOpen(false)}
              className="rounded-lg px-4 py-3 text-sm font-medium text-text-secondary transition-colors hover:bg-gray-100"
            >
              Hem
            </Link>
            <Link
              href="/"
              onClick={() => setOpen(false)}
              className="rounded-lg px-4 py-3 text-sm font-medium text-text-secondary transition-colors hover:bg-gray-100"
            >
              Simulator
            </Link>
            <Link
              href="/"
              onClick={() => setOpen(false)}
              className="rounded-lg px-4 py-3 text-sm font-medium text-text-secondary transition-colors hover:bg-gray-100"
            >
              Om HOMEii
            </Link>
          </nav>
        </div>
      )}
    </div>
  );
}
