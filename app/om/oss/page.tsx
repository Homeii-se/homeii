import type { Metadata } from "next";
import OmPageLayout from "../OmPageLayout";

export const metadata: Metadata = {
  title: "Om oss — HOMEii",
  description: "Vilka vi är och varför vi byggde HOMEii.",
};

export default function OmOssPage() {
  return (
    <OmPageLayout
      eyebrow="Om oss"
      title={<>Vi är ett litet team som <em className="text-brand-500">tror på</em> elektrifieringen.</>}
      subtitle="HOMEii är byggt av människor som vill att svenska hushåll ska få verktyg för att fatta välgrundade energibeslut — utan att behöva genomlida säljsamtal."
    >
      <div className="space-y-6 text-base leading-relaxed text-text-secondary">
        <p>
          HOMEii startades efter ett samtal som vi tror många känner igen: en granne hade fått
          tre helt olika offerter på samma värmepump — alla med olika återbetalningstider och
          olika antaganden. Ingen visste hur man jämförde dem rättvist.
        </p>
        <p>
          Vi insåg att informationen finns där ute — Nord Pool publicerar timpriser, PVGIS har
          väderdata, Energimyndigheten har installationspriser. Men ingen hade satt ihop det
          till en analys som <strong className="text-brand-700">utgår från din egen elräkning</strong>.
        </p>
        <p>
          Så vi byggde det. Idag analyserar HOMEii hundratals fakturor varje månad och hjälper
          hushåll förstå vad de faktiskt betalar för — och vilka åtgärder som lönar sig.
        </p>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-2xl font-light text-brand-500 font-[family-name:var(--font-fraunces)]">
            2025
          </p>
          <p className="mt-1 text-sm font-medium text-brand-900">Grundades</p>
          <p className="mt-1 text-xs text-text-muted">Stockholm, Sverige</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-2xl font-light text-brand-500 font-[family-name:var(--font-fraunces)]">
            100%
          </p>
          <p className="mt-1 text-sm font-medium text-brand-900">Oberoende</p>
          <p className="mt-1 text-xs text-text-muted">Vi säljer inga produkter</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-2xl font-light text-brand-500 font-[family-name:var(--font-fraunces)]">
            Gratis
          </p>
          <p className="mt-1 text-sm font-medium text-brand-900">För hushåll</p>
          <p className="mt-1 text-xs text-text-muted">Inga dolda avgifter</p>
        </div>
      </div>
    </OmPageLayout>
  );
}
