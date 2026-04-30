import type { Metadata } from "next";
import KunskapPlaceholder from "../KunskapPlaceholder";

export const metadata: Metadata = {
  title: "Räkneexempel — Kunskap — HOMEii",
  description: "Verkliga räkneexempel på energiåtgärder och deras återbetalningstid.",
};

export default function ExempelPage() {
  return (
    <KunskapPlaceholder
      eyebrow="Kunskap › Räkneexempel"
      title="Räkneexempel från"
      italicTitle="riktiga hushåll"
      subtitle="Anonymiserade case där vi visar hela räkningen — inte bara pengar in och ut, utan antagandena bakom."
      comingSoon={[
        "Villa 150 m² i SE3 — solceller + batteri, 12 års payback",
        "Radhus 110 m² med direktel — luft-luft-värmepump halverar kostnaden",
        "Lägenhet i Stockholm — vad lönar sig egentligen?",
        "Sommarstuga med poolvärme — så hanterar du säsongstoppar",
        "Familj med två elbilar — smart laddning sparar 8 000 kr/år",
      ]}
    />
  );
}
