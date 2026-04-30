"use client";

import LandingHero from "./simulator/components/LandingHero";

/**
 * Hem-sidan — visar bara LandingHero. När användaren klickar "Analysera min
 * elräkning" navigerar LandingHero till /analys, där hela analys-flödet
 * (Upload → Bekräfta → Resultat → Dashboard) lever som egen route.
 *
 * State-management (localStorage) hanteras inom /analys-routen — Hem-sidan
 * behöver ingen state alls.
 */
export default function Home() {
  return (
    <div className="bg-gradient-main relative min-h-screen pb-12">
      <LandingHero />
    </div>
  );
}
