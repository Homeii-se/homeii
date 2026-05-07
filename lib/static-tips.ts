/**
 * Statiska tips per kategori för åtgärder som engine v2 inte modellerar
 * (sänk huvudsäkring, byt elhandlare, avtal utan månadsavgift, batteri som
 * standalone) eller där batteri ska synas separat även när det bundlas
 * med solceller. Visas efter engine-rekommendationer i kategori-korten,
 * märkta som "tips" — utan exakt kr/år eftersom modellering saknas.
 *
 * Delas idag av:
 *   - app/app/hem/page.tsx (Section4Actions / CategoryCard)
 *   - app/app/min-plan/page.tsx (Section3Tips / TipCard)
 */

export type StaticTip = {
  id: string;
  icon: string;
  title: string;
  desc: string;
  /** t.ex. "~600 kr / år" — eller undefined för "kan vara värt undersöka" */
  approxKr?: string;
};

export type StaticTipCategory = "anvanda" | "effekt" | "fast";

export const STATIC_TIPS: Record<StaticTipCategory, StaticTip[]> = {
  anvanda: [
    {
      id: "smarta-vanor",
      icon: "💡",
      title: "Smartare vanor",
      desc: "Sänk inomhustemp 1°C, stäng av standby, tvätta på 30°C. Ingen investering — börja idag.",
      approxKr: "~3 % av räkningen",
    },
  ],
  effekt: [
    {
      id: "flytta-last",
      icon: "🌙",
      title: "Flytta tvätt och disk till kvällen",
      desc: "Schemalägg tunga apparater så de inte krockar med matlagning eller hemkomst-toppen.",
      approxKr: "Gratis · ändra rutiner",
    },
    {
      id: "hembatteri-tip",
      icon: "🔋",
      title: "Hembatteri",
      desc: "Ladda billig natt-el och använd när priset är högt — eller lagra solel om du har det. Kan även ge intäkter via stödtjänster till Svenska Kraftnät (FCR-D/FFR).",
      approxKr: "3 000–8 000 kr / år i stödtjänster",
    },
  ],
  fast: [
    {
      id: "mindre-sakring",
      icon: "⚡",
      title: "Mindre huvudsäkring",
      desc: "Om dina toppar sällan går över 16 A räcker det med en mindre säkring. Kontakta nätbolaget.",
      approxKr: "~25 % av nätabonnemanget",
    },
    {
      id: "byt-elhandlare",
      icon: "📞",
      title: "Byt elhandlare",
      desc: "Jämför priser på Elskling.se eller Elpriskollen. Tar 5 minuter att byta online.",
      approxKr: "~3–5 % av elhandelskostnaden",
    },
    {
      id: "ingen-manadsavgift",
      icon: "💰",
      title: "Avtal utan månadsavgift",
      desc: "Vissa elhandlare erbjuder avtal helt utan fast månadsavgift. Spar du över 600 kr per år.",
      approxKr: "~600 kr / år",
    },
  ],
};
