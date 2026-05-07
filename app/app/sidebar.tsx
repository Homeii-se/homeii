'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

const NAV_ITEMS = [
  { href: '/app/start', label: 'Start' },
  { href: '/app/hem', label: 'Mina hem' },
  { href: '/app/min-plan', label: 'Min plan' },
  { href: '/app/min-uppfoljning', label: 'Min uppföljning' },
  { href: '/app/mina-dokument', label: 'Mina dokument' },
  { href: '/app/mina-offerter', label: 'Mina offerter' },
  { href: '/app/mina-erbjudanden', label: 'Mina erbjudanden' },
  { href: '/app/min-kunskap', label: 'Min kunskap' },
  { href: '/app/notiser', label: 'Notiser' },
  { href: '/app/installningar', label: 'Inställningar' },
];

export function Sidebar({ userEmail }: { userEmail?: string }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile header med hamburger */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 md:hidden">
        <span className="font-semibold">Mina sidor</span>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Öppna meny"
          className="rounded-md p-2 hover:bg-gray-100"
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d={mobileOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'}
            />
          </svg>
        </button>
      </div>

      {/* Sidomeny — desktop alltid synlig, mobil togglas */}
      <aside
        className={`${
          mobileOpen ? 'block' : 'hidden'
        } w-full border-b border-gray-200 bg-white md:block md:w-64 md:border-b-0 md:border-r md:min-h-screen`}
      >
        <div className="hidden border-b border-gray-200 px-6 py-4 md:block">
          <span className="text-lg font-semibold">Mina sidor</span>
        </div>

        <nav className="flex flex-col p-2">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`rounded-md px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {userEmail && (
          <div className="mt-auto border-t border-gray-200 px-4 py-3 text-xs text-gray-600">
            Inloggad som <span className="font-medium">{userEmail}</span>
          </div>
        )}
      </aside>
    </>
  );
}