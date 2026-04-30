import type { Metadata } from "next";
import KunskapPlaceholder from "../KunskapPlaceholder";

export const metadata: Metadata = {
  title: "Guider — Kunskap — HOMEii",
  description: "Steg-för-steg-guider för svenska hushåll som vill optimera sin elkonsumtion.",
};

export default function GuiderPage() {
  return (
    <KunskapPlaceholder
      eyebrow="Kunskap › Guider"
      title="Steg-för-steg-guider för"
      italicTitle="energieffektivisering"
      subtitle="Praktiska guider för dig som vill förstå tekniken, prata med installatören eller bara veta vad du köper."
      comingSoon={[
        "Solceller — vad du behöver veta innan första offerten",
        "Luft-vatten-värmepump vs bergvärme — så väljer du rätt",
        "Hembatteri — räknar det hem för dig?",
        "Smart laddning av elbilen — verktyg och taktiker",
        "ROT-avdrag för grön teknik — så maxar du subventionen",
      ]}
    />
  );
}
