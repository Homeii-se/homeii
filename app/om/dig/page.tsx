import type { Metadata } from "next";
import OmPageLayout from "../OmPageLayout";

export const metadata: Metadata = {
  title: "Vår oberoende roll — HOMEii",
  description: "Hur vi tjänar pengar och varför det inte påverkar våra rekommendationer.",
};

export default function OmDigPage() {
  return (
    <OmPageLayout
      eyebrow="Vår oberoende roll"
      title={<>Vi <em className="text-brand-500">säljer ingenting</em>. Det är vår viktigaste princip.</>}
      subtitle="HOMEii rekommenderar inga specifika tillverkare eller installatörer för att vi får extra betalt — vi rangordnar utifrån vad som ger bäst återbetalning för dig."
    >
      <div className="space-y-6 text-base leading-relaxed text-text-secondary">
        <h2 className="text-xl font-semibold text-brand-900 font-[family-name:var(--font-fraunces)]">
          Hur vi tjänar pengar
        </h2>
        <p>
          Vi har ett enkelt principiellt val: <strong className="text-brand-700">tjäna pengar
          på att hjälpa dig fatta bra beslut, inte på att styra ditt beslut</strong>. Det betyder
          att intäkterna kommer från:
        </p>
        <ul className="space-y-3 pl-0 list-none">
          <li className="rounded-xl border border-gray-200 bg-white p-4">
            <strong className="text-brand-900">Affiliate-ersättning från elhandlare</strong> när du
            byter — om du går från ett dyrt avtal till ett billigare via våra länkar får vi en
            mindre kickback. Vi visar alltid alla rimliga alternativ, inte bara de vi får
            ersättning för.
          </li>
          <li className="rounded-xl border border-gray-200 bg-white p-4">
            <strong className="text-brand-900">Lead-ersättning för installatörer</strong> (solceller,
            värmepumpar, batterier) när du själv ber om offert. Vi förmedlar dina uppgifter till
            ett par lokala leverantörer — du jämför själv och bestämmer.
          </li>
          <li className="rounded-xl border border-gray-200 bg-white p-4">
            <strong className="text-brand-900">Premium-prenumeration</strong> (kommer) för
            avancerade funktioner som löpande uppföljning och varningar — frivilligt, alltid
            förvalbart.
          </li>
        </ul>

        <h2 className="mt-8 text-xl font-semibold text-brand-900 font-[family-name:var(--font-fraunces)]">
          Vad vi aldrig gör
        </h2>
        <ul className="space-y-2 pl-5 list-disc marker:text-brand-500">
          <li>Rangordnar inte rekommendationer efter provision</li>
          <li>Säljer inte din kontaktdata utan ditt aktiva godkännande</li>
          <li>Visar inte annonser från elhandlare på resultat-sidor</li>
          <li>Tar inte betalt av tillverkare för att synas i analyser</li>
        </ul>

        <div className="mt-8 rounded-2xl bg-card-green border border-brand-500/20 p-6">
          <p className="text-sm leading-relaxed text-text-secondary">
            <strong className="text-brand-900">Transparens i praktiken:</strong> Om du ser en länk
            "Byt till elhandlare X" i en rekommendation — fråga oss varför just X föreslogs. Vi
            visar exakt vilka faktorer som vägde in (markup på din nuvarande, tillgänglighet i
            din zon, recension/betyg, om vi får provision) och du ser alltid jämförelsen mot
            alternativen.
          </p>
        </div>
      </div>
    </OmPageLayout>
  );
}
