import type { Metadata } from "next";
import KunskapPlaceholder from "../KunskapPlaceholder";

export const metadata: Metadata = {
  title: "Nyheter & trender — Kunskap — HOMEii",
  description: "Aktuellt om svensk elmarknad, regelverk och teknikutveckling.",
};

export default function NyheterPage() {
  return (
    <KunskapPlaceholder
      eyebrow="Kunskap › Nyheter & trender"
      title="Vad händer på"
      italicTitle="elmarknaden"
      subtitle="Vi följer utvecklingen och förklarar vad nya regler och pristrender betyder för dig som hushållskund."
      comingSoon={[
        "Energiskattens utveckling 2020–2027 — varför sänktes den 2026?",
        "15-minuters spotpriser — vad ändras för småhusägare?",
        "Elnätsavgifternas effekttariffer — vilka bolag har infört det?",
        "Nord Pool day-ahead — så fungerar prisbildningen",
        "Subventioner och stöd — vad finns just nu?",
      ]}
    />
  );
}
