import type { Metadata } from "next";
import KunskapPlaceholder from "../KunskapPlaceholder";

export const metadata: Metadata = {
  title: "Ordlista — Kunskap — HOMEii",
  description: "En jordnära ordlista med svenska elmarknads-termer.",
};

export default function OrdlistaPage() {
  return (
    <KunskapPlaceholder
      eyebrow="Kunskap › Ordlista"
      title="Termer och begrepp,"
      italicTitle="förklarade enkelt"
      subtitle="Allt från effekttariff och COP till spotpris och säkringsstorlek — utan svårbegripligt fackspråk."
      comingSoon={[
        "Spotpris, månadsspot, fast pris — vad är skillnaden?",
        "Effekttariff och säkringsabonnemang — vad betyder det för dig?",
        "COP-värde för värmepumpar — så jämför du rättvist",
        "kW vs kWh — den vanligaste förvirringen",
        "SE1 till SE4 — varför har Sverige fyra elområden?",
      ]}
    />
  );
}
