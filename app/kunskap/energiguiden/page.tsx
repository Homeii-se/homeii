import type { Metadata } from "next";
import KunskapPlaceholder from "../KunskapPlaceholder";

export const metadata: Metadata = {
  title: "Energiguiden — Kunskap — HOMEii",
  description:
    "Guider och interaktiva visualiseringar för solceller, värmepumpar, batterier och elbilar — plus räkneexempel som visar vad du faktiskt sparar.",
};

export default function EnergiguidenPage() {
  return (
    <KunskapPlaceholder
      eyebrow="Kunskap › Energiguiden"
      title="Förstå energiflödena i"
      italicTitle="ditt hem"
      subtitle="Praktiska guider och interaktiva visualiseringar för dig som vill förstå hur el rör sig genom hemmet — och vad olika åtgärder faktiskt sparar."
      comingSoon={[
        "Energiflöden över ett dygn — interaktiv jämförelse mellan gårdagens och morgondagens hem",
        "Solceller — vad du behöver veta innan första offerten",
        "Luft-vatten-värmepump vs bergvärme — så väljer du rätt",
        "Hembatteri — räknar det hem för dig?",
        "Smart laddning av elbilen — verktyg och taktiker",
        "Räkneexempel — vad sparar en typisk villa?",
        "ROT-avdrag för grön teknik — så maxar du subventionen",
      ]}
    />
  );
}
