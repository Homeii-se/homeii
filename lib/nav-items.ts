/**
 * Shared top-level navigation items.
 *
 * Used by both the desktop nav (in app/layout.tsx) and the mobile nav
 * (in app/simulator/components/MobileNav.tsx). Adding a new top-level
 * route? Add it here once and both navs pick it up automatically.
 *
 * UI strings are kept centralized here so a future i18n migration
 * becomes mechanical rather than archaeological — see CLAUDE.md
 * conventions.
 */
export type NavItem = {
  href: string;
  label: string;
};

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/", label: "Hem" },
  { href: "/kunskap", label: "Kunskap" },
  { href: "/om", label: "Om HOMEii" },
  { href: "/partners", label: "Partners" },
  { href: "/app/hem", label: "Mina sidor" },
] as const;
