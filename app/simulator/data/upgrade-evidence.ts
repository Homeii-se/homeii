/**
 * HOMEii – Evidensdatabas för åtgärdsförslag
 * ============================================
 * Varje åtgärd har spårbara källor, antaganden och skyddsvärde mot
 * scenario-risker. Används av UpgradeEvidencePanel och ScenarioExplorerCard
 * för att visa "Så räknade vi" och "Dessa åtgärder skyddar mest mot X".
 */

import type { UpgradeId } from "../types";
import type { ScenarioSource } from "./scenarios-presets";

// =====================================================
// Källor (återanvända)
// =====================================================

const SRC_BOVERKET_BBR: ScenarioSource = {
  label: "Boverket – Byggregler (BBR) och energiprestanda",
  url: "https://www.boverket.se/sv/byggande/regler-for-byggande/om-boverkets-byggregler-bbr/",
  retrievedAt: "2026-04-24",
};

const SRC_EM_VP_TEST: ScenarioSource = {
  label: "Energimyndigheten – Oberoende tester av värmepumpar",
  url: "https://www.energimyndigheten.se/tester/tester-a-o/varmepumpar/",
  retrievedAt: "2026-04-24",
};

const SRC_EM_SOLEL: ScenarioSource = {
  label: "Energimyndigheten – Solceller för hushåll",
  url: "https://www.energimyndigheten.se/fornybart/solelportalen/",
  retrievedAt: "2026-04-24",
};

const SRC_SVEBY: ScenarioSource = {
  label: "SVEBY – Brukarindata för bostäder",
  url: "https://www.sveby.org/",
  retrievedAt: "2026-04-24",
};

const SRC_SVK_BATTERI: ScenarioSource = {
  label: "Svenska kraftnät – Nätstödstjänster och hembatterier",
  url: "https://www.svk.se/aktorsportalen/elmarknad/stodtjanster/",
  retrievedAt: "2026-04-24",
};

const SRC_NATURVARDSVERKET_ELDSTAD: ScenarioSource = {
  label: "Naturvårdsverket – Eldstäder och utsläpp",
  url: "https://www.naturvardsverket.se/amnesomraden/luft/utslapp-fran-uppvarmning/",
  retrievedAt: "2026-04-24",
};

const SRC_PVGIS: ScenarioSource = {
  label: "PVGIS – EU JRC Photovoltaic Geographical Information System",
  url: "https://re.jrc.ec.europa.eu/pvg_tools/en/",
  retrievedAt: "2026-04-24",
};

const SRC_EI_FAKTA: ScenarioSource = {
  label: "Energimarknadsinspektionen – Faktablad om elpriser och avtal",
  url: "https://ei.se/konsument",
  retrievedAt: "2026-04-24",
};

// =====================================================
// Evidensstruktur per upgrade
// =====================================================

export interface UpgradeEvidence {
  /** Vad åtgärden gör – en mening i Sofia-ton */
  whatItDoes: string;
  /** Hur besparingen räknas */
  savingsAssumption: {
    description: string;
    /** Tumregel – t.ex. "15-25% värmebesparing enligt Boverket" */
    rangeNote?: string;
  };
  /** Kostnad – källa och antaganden */
  costAssumption: string;
  /** Livslängd – källa */
  lifespanAssumption: string;
  /** Källor som underbygger siffrorna */
  sources: ScenarioSource[];
  /**
   * Skyddsvärde mot scenariorisker. Key = scenario-id, value = relativ skyddsnivå
   * där 0 = ingen effekt, 1 = stort skydd. Används av UI för att sortera åtgärder
   * efter hur mycket de dämpar ett givet scenario.
   */
  scenarioShielding: Partial<Record<string, { level: 0 | 1 | 2 | 3; why: string }>>;
}

// Skyddsnivåer (för UI-färgkodning):
//  0 = neutralt — åtgärden påverkar inte scenariorisken
//  1 = något skydd
//  2 = starkt skydd
//  3 = mycket starkt skydd (primär försvarsmekanism)

// =====================================================
// Evidens per åtgärd
// =====================================================

export const UPGRADE_EVIDENCE: Record<UpgradeId, UpgradeEvidence> = {

  solceller: {
    whatItDoes:
      "Producerar el från solljus på ditt tak. Minskar hur mycket el du köper från nätet och genererar överskott när solen skiner.",
    savingsAssumption: {
      description:
        "10 kW solcellsanläggning producerar 8 500–10 500 kWh/år beroende på SE-zon (PVGIS-data per latitud). Cirka 30–50 % används direkt i hushållet, resten exporteras till nätet för spotpris minus påslag.",
      rangeNote: "Egenanvändning ökar till 50–70 % med batteri eller smart styrning.",
    },
    costAssumption:
      "140 000 kr inkl. moms för 10 kW nyckelfärdig anläggning. Efter grönt ROT-avdrag (20 %): ~112 000 kr. Källa: Energimyndighetens prisstatistik 2025–2026.",
    lifespanAssumption:
      "25 år garanterad paneleffekt, ~30 år teknisk livslängd. Växelriktare ofta 10–15 år.",
    sources: [SRC_EM_SOLEL, SRC_PVGIS, SRC_BOVERKET_BBR],
    scenarioShielding: {
      "energikrisen-2022": { level: 2, why: "Solcellerna producerar mest på sommaren när elpriset var relativt lägre under krisen. Men sänker totala förbrukningen från nätet." },
      "eu-sammankoppling":  { level: 2, why: "Tyska prisvärden har större dagsvariation – solceller täcker dagtimmarna då priset är högt." },
      "fornybar-expansion": { level: 1, why: "I detta scenario blir soltimmar nästan gratis ändå – solcellernas exportvärde sjunker, men egenanvändning ger fortsatt värde." },
      "norra-sverige-stalboom": { level: 2, why: "Högre priser i norr ökar värdet av egen produktion markant. I SE1/SE2 kan åtgärden betala sig dubbelt så snabbt." },
      "eu-2030-mal":        { level: 3, why: "När efterfrågan stiger i hela Europa blir egen produktion guld värd. Primär försvarsmekanism." },
    },
  },

  batteri: {
    whatItDoes:
      "Lagrar solel eller billig natt-el så du kan använda den när priset är högt. Kan även delta i stödtjänster åt Svenska kraftnät.",
    savingsAssumption: {
      description:
        "25 kWh batteri ökar egenanvändning av solel från ~35 % till ~65 %. Laddar från nätet nattetid (20–30 öre/kWh billigare) och används på kvällen. Kräver timavtal för att ge full nytta.",
      rangeNote: "Extra intäkter från FCR-D/FFR-stödtjänster: 3 000–8 000 kr/år beroende på storlek och avtalspartner.",
    },
    costAssumption:
      "110 000 kr inkl. moms för 25 kWh batteri + installation. Efter grönt ROT-avdrag (20 %): ~88 000 kr. Källa: branschdata Tesla Powerwall, Huawei LUNA, Pixii 2025–2026.",
    lifespanAssumption:
      "15 år eller ~6 000 cykler (70 % kvarvarande kapacitet). Garanti varierar 10–15 år mellan tillverkare.",
    sources: [SRC_SVK_BATTERI, SRC_EM_SOLEL],
    scenarioShielding: {
      "energikrisen-2022": { level: 3, why: "Kraftig dag/natt-spread under krisen gjorde prisarbitrage extremt värdefullt. Batteriet skulle betala sig 3–4× snabbare." },
      "eu-sammankoppling":  { level: 3, why: "Tyska prisprofilen har stor dygnsvariation. Batteri + timavtal är primär försvarsmekanism." },
      "fornybar-expansion": { level: 3, why: "Scenariot där batteri vinner MEST. Ladda gratis blåsdagar, sälj/använd på vindstilla morgnar." },
      "norra-sverige-stalboom": { level: 2, why: "Stora timvariationer när industrin kör. Batteriet arbitrerar bra men totalpriset är ändå högre." },
      "eu-2030-mal":        { level: 2, why: "Ökad efterfrågan → dyrare peak-timmar → större spread att arbitrera." },
    },
  },

  luftluft: {
    whatItDoes:
      "Värmer bara luften i huset från en innedel. Effektiv för att komplettera direktel i enskilda rum.",
    savingsAssumption: {
      description:
        "SCOP (årsmedelvärdets COP) 3,5–4,5 enligt Energimyndighetens tester. Ersätter 30–50 % av direktelbehovet (oftast bara ett våningsplan). Fungerar sämre vid temperaturer under –15 °C – direktel kvar som back-up.",
      rangeNote: "Ca 30–40 % minskning av värmebehovet i elen, inte 60–70 % som en luft-vatten.",
    },
    costAssumption:
      "35 000 kr inkl. moms + installation. Efter ROT-avdrag: ~28 000 kr. Källa: Energimyndighetens prisstatistik och branschgenomsnitt.",
    lifespanAssumption:
      "15 år typisk livslängd. Kompressor ofta det som går sönder först.",
    sources: [SRC_EM_VP_TEST, SRC_BOVERKET_BBR],
    scenarioShielding: {
      "energikrisen-2022": { level: 2, why: "Minskad elförbrukning = mindre exponering mot höga vinterpriser." },
      "eu-sammankoppling":  { level: 2, why: "Lägre totalförbrukning dämpar effekten av högre spotpriser." },
      "fornybar-expansion": { level: 1, why: "Lägre genomsnittspris ändå – värmepumpens värde är relativt mindre." },
      "norra-sverige-stalboom": { level: 2, why: "Högre priser framåt = större besparing av mindre förbrukning." },
      "eu-2030-mal":        { level: 2, why: "Skyddar mot högre framtida priser genom lägre förbrukning." },
    },
  },

  luftvatten: {
    whatItDoes:
      "Ersätter hela husets värmesystem. Värmer både hus och varmvatten med luft som energikälla.",
    savingsAssumption: {
      description:
        "SCOP 3,0–3,8. Minskar uppvärmningskostnaden med 60–70 % jämfört med direktel. Täcker hela uppvärmningsbehovet, även varmvatten. Behöver komplettering med elpatron vid –20 °C och kallare.",
      rangeNote: "Ju sämre U-värden huset har, desto större absolut besparing.",
    },
    costAssumption:
      "130 000 kr inkl. moms + installation. Efter ROT-avdrag: ~104 000 kr. Källa: Energimyndighetens pristester.",
    lifespanAssumption:
      "20 år typisk. Kompressor och fläkt slits ut innan ackumulatortanken.",
    sources: [SRC_EM_VP_TEST, SRC_BOVERKET_BBR, SRC_SVEBY],
    scenarioShielding: {
      "energikrisen-2022": { level: 3, why: "Stor absolut besparing när priset är högt – skyddsvärdet är som störst i kris." },
      "eu-sammankoppling":  { level: 3, why: "Primär försvar mot Tyska prisnivåer – halverar uppvärmningsförbrukningen." },
      "fornybar-expansion": { level: 2, why: "Lägre medelpris men större timvariationer. Värmepumpen kan styras till billiga timmar för bonus." },
      "norra-sverige-stalboom": { level: 3, why: "Helt avgörande för att skydda boende i SE1/SE2 där påslaget är störst." },
      "eu-2030-mal":        { level: 3, why: "Skyddar med minst 60 % mot elprishöjningar i värmedelen." },
    },
  },

  bergvarme: {
    whatItDoes:
      "Hämtar värme ur berggrunden via ett borrhål. Mest stabil och effektiv värmepump – fungerar bra även vid –25 °C.",
    savingsAssumption: {
      description:
        "SCOP 4,0–4,8 – den mest effektiva värmepumpen. Minskar uppvärmningskostnaden med 70–80 %. Stabil prestanda oavsett utetemperatur.",
      rangeNote: "Störst besparing i norra Sverige där det är kallast.",
    },
    costAssumption:
      "180 000 kr inkl. moms + borrhål + installation. Efter ROT-avdrag: ~144 000 kr. Borrhålets djup påverkar priset mycket (150–250 m vanligt).",
    lifespanAssumption:
      "25 år för värmepumpen, ~50 år för borrhålet.",
    sources: [SRC_EM_VP_TEST, SRC_BOVERKET_BBR, SRC_SVEBY],
    scenarioShielding: {
      "energikrisen-2022": { level: 3, why: "Största skydd mot dyrtider – avlastar 70–80 % av elbehovet för värme." },
      "eu-sammankoppling":  { level: 3, why: "Stabil effektivitet även vintertid när tyska kopplingen gör SE dyrast." },
      "fornybar-expansion": { level: 2, why: "Lägre medelpris ger mindre absolut besparing, men värdefull för peak-priser." },
      "norra-sverige-stalboom": { level: 3, why: "Mest avgörande åtgärden i norra Sverige – kan halvera din totalräkning i scenariot." },
      "eu-2030-mal":        { level: 3, why: "Långsiktigt det största skyddet mot elprishöjningar." },
    },
  },

  tillaggsisolering: {
    whatItDoes:
      "Minskar värmeförlusten genom tak, väggar eller golv. Sänker hela värmebehovet oavsett uppvärmningskälla.",
    savingsAssumption: {
      description:
        "Typiskt 15–25 % minskning av värmebehovet beroende på hur husets U-värden ser ut innan. Boverkets BBR-schabloner: ett 1970-tals hus kan få U-värde för tak från 0,25 till 0,13 W/m²K efter tilläggsisolering (halvering av takets värmeförlust).",
      rangeNote: "Större effekt i äldre hus (pre-1980). Nya hus har redan bra U-värden.",
    },
    costAssumption:
      "80 000 kr inkl. moms (tak + ev vindsbjälklag). Lokalt utförande varierar.",
    lifespanAssumption:
      "40+ år – isoleringsmaterial behåller sin funktion hela husets livslängd.",
    sources: [SRC_BOVERKET_BBR, SRC_SVEBY],
    scenarioShielding: {
      "energikrisen-2022": { level: 2, why: "Mindre värmebehov = mindre exponering mot krispriser." },
      "eu-sammankoppling":  { level: 2, why: "Permanent sänkt förbrukning oavsett vad priset gör." },
      "fornybar-expansion": { level: 1, why: "Mindre påverkan när priserna är låga, men fortsatt värdefullt." },
      "norra-sverige-stalboom": { level: 2, why: "Viktigt skydd för norr där kallast klimat + högst priser." },
      "eu-2030-mal":        { level: 2, why: "Permanent skydd mot framtida prishöjningar." },
    },
  },

  eldstad: {
    whatItDoes:
      "Minskar behovet av eluppvärmning genom ved eller pellets. Kombineras ofta med värmepump som primär värmekälla.",
    savingsAssumption: {
      description:
        "Ca 15 % minskning av eluppvärmningen enligt Naturvårdsverket och branschdata. Kräver att man faktiskt eldar regelbundet – annars blir effekten mindre. Ved-/pelletskostnad ersätter en del av elkostnaden.",
      rangeNote: "Moderna pelletskaminer kan nå 20–25 % om de används dagligen vintertid.",
    },
    costAssumption:
      "50 000 kr inkl. moms – kamin + skorsten + installation. Efter ROT-avdrag: ~40 000 kr.",
    lifespanAssumption:
      "30 år för eldstaden, skorstenen ofta 50+ år.",
    sources: [SRC_NATURVARDSVERKET_ELDSTAD, SRC_BOVERKET_BBR],
    scenarioShielding: {
      "energikrisen-2022": { level: 2, why: "Alternativ energikälla till elnätet – vedpriset steg mindre än elpriset 2022." },
      "eu-sammankoppling":  { level: 1, why: "Begränsat skydd – behöver aktivt användas för att ha effekt." },
      "fornybar-expansion": { level: 0, why: "Ved är dyrare än billig el från förnybar expansion. Mindre relevant." },
      "norra-sverige-stalboom": { level: 2, why: "Lokal tillgång till ved = viktigt alternativ när elpriset stiger." },
      "eu-2030-mal":        { level: 1, why: "Alternativ bränslekälla dämpar elprishöjning något." },
    },
  },

  smartstyrning: {
    whatItDoes:
      "Styr automatiskt värmepump, varmvatten och laddning efter timpriset. Flyttar förbrukning till billiga timmar utan att du behöver tänka.",
    savingsAssumption: {
      description:
        "Flyttar 20–40 % av styrbar förbrukning (värme, varmvatten, EV-laddning) till billiga timmar. Ger 8–15 % lägre elkostnad med timavtal jämfört med utan styrning. Värdet växer med timvariationen.",
      rangeNote: "Värdet ökar med volatilitet – mest värt i Grön omställning- eller Energikris-scenarier.",
    },
    costAssumption:
      "12 000 kr inkl. moms för hårdvara + app (t.ex. Tibber Pulse, Ngenic, Sensibo).",
    lifespanAssumption:
      "10 år för hårdvaran, mjukvaran uppdateras kontinuerligt.",
    sources: [SRC_EI_FAKTA],
    scenarioShielding: {
      "energikrisen-2022": { level: 3, why: "Störst värde när variationerna är störst. Kunde ha halverat den dagliga kostnaden i september 2022." },
      "eu-sammankoppling":  { level: 3, why: "Tyska prisprofilen är volatil – smart styrning är primär försvar." },
      "fornybar-expansion": { level: 3, why: "SCENARIOT där smart styrning vinner MEST. Utan det är värdet av lägre medelpris nästan obefintligt." },
      "norra-sverige-stalboom": { level: 2, why: "Stora timvariationer när stålverken kör – smart styrning flyttar till natten/helgen." },
      "eu-2030-mal":        { level: 2, why: "Volatilare marknad ger större värde åt automation." },
    },
  },

  varmvattenpump: {
    whatItDoes:
      "En separat värmepump bara för varmvatten. Värmer beredaren med 2–3× mindre el än en vanlig varmvattenberedare.",
    savingsAssumption: {
      description:
        "SCOP ~3 för varmvatten. Minskar varmvattenkostnaden med ca 65 %. Varmvatten står för 20–30 % av ett hushålls elförbrukning enligt SVEBY.",
      rangeNote: "Störst vinst för hushåll med mycket varmvattenanvändning (t.ex. barnfamiljer).",
    },
    costAssumption:
      "35 000 kr inkl. moms + installation. Efter ROT-avdrag: ~28 000 kr.",
    lifespanAssumption:
      "15 år typisk livslängd.",
    sources: [SRC_EM_VP_TEST, SRC_SVEBY],
    scenarioShielding: {
      "energikrisen-2022": { level: 2, why: "Minskar total elförbrukning med 10–15 %." },
      "eu-sammankoppling":  { level: 2, why: "Reducerar basförbrukning permanent." },
      "fornybar-expansion": { level: 1, why: "Mindre viktig när medelpriset är lågt." },
      "norra-sverige-stalboom": { level: 2, why: "Varje sparad kWh är värdefull i högprisregioner." },
      "eu-2030-mal":        { level: 2, why: "Permanent minskning som skyddar mot prishöjningar." },
    },
  },

  fonsterbyte: {
    whatItDoes:
      "Byter till 3-glasfönster med låga U-värden. Minskar värmeförlusten genom glasytor – samt dragkänsla och kondens.",
    savingsAssumption: {
      description:
        "Typiskt U-värde från 2,8 (2-glas) till 1,0 W/m²K (3-glas). Minskar värmebehovet med ca 10 % beroende på fönsterareal. Ger även bättre inomhusklimat.",
      rangeNote: "Största effekten i hus med mycket fönster eller gamla 2-glas.",
    },
    costAssumption:
      "130 000 kr för komplett fönsterbyte i normalstor villa (10–12 fönster). Efter ROT-avdrag: ~104 000 kr.",
    lifespanAssumption:
      "30 år minst – ofta längre för bra kvalitet.",
    sources: [SRC_BOVERKET_BBR, SRC_SVEBY],
    scenarioShielding: {
      "energikrisen-2022": { level: 1, why: "Mindre värmebehov = något mindre exponering." },
      "eu-sammankoppling":  { level: 1, why: "Begränsad procentuell effekt på värmedelen." },
      "fornybar-expansion": { level: 1, why: "Mindre viktig vid lågt medelpris." },
      "norra-sverige-stalboom": { level: 2, why: "Värt mer i kallare klimat med högre priser." },
      "eu-2030-mal":        { level: 1, why: "Permanent skydd men liten storlek." },
    },
  },

  dynamiskt_elpris: {
    whatItDoes:
      "Timavtal där du betalar spotpriset timme för timme. Kombinerat med smart styrning flyttar det billigare timmar till din fördel.",
    savingsAssumption: {
      description:
        "Med en 'dum' förbrukningsprofil är timavtal och månadsavtal ungefär lika. Men med smart styrning (batteri, värmepump med timstyrning) flyttas 20–40 % av konsumtionen till billiga timmar → 8–15 % lägre elkostnad. Ger ENORMT värde i volatila scenarier.",
      rangeNote: "Värdet på timavtal växer med marknadsvolatiliteten – Grön omställning och Energikris är där vinsten är störst.",
    },
    costAssumption:
      "0 kr – inget behöver köpas. Ibland ingen månadsavgift, ibland 49–99 kr/mån.",
    lifespanAssumption:
      "Ingen livslängd – du byter avtal när marknaden ändras.",
    sources: [SRC_EI_FAKTA],
    scenarioShielding: {
      "energikrisen-2022": { level: 2, why: "Kunde minska kostnaden med 10–20 % om man flyttade användning till natten." },
      "eu-sammankoppling":  { level: 2, why: "Stora dygnsvariationer i tyska priser gör timavtal värdefullt." },
      "fornybar-expansion": { level: 3, why: "PRIMÄR värde-drivare i detta scenario. Utan timavtal missar du alla billiga blåsiga timmar." },
      "norra-sverige-stalboom": { level: 2, why: "När industrin kör på dagen blir natten relativt billigare." },
      "eu-2030-mal":        { level: 2, why: "Volatilare marknad ger större vinst av att ha timavtal." },
    },
  },
};

/**
 * Sortera åtgärder efter hur mycket de skyddar mot ett specifikt scenario.
 * Returnerar ranking: åtgärder med level 3 först, sedan 2, 1, 0.
 */
export function rankUpgradesByScenarioShielding(scenarioId: string): UpgradeId[] {
  return (Object.entries(UPGRADE_EVIDENCE) as [UpgradeId, UpgradeEvidence][])
    .map(([id, ev]) => ({
      id,
      level: ev.scenarioShielding[scenarioId]?.level ?? 0,
    }))
    .sort((a, b) => b.level - a.level)
    .map((x) => x.id);
}

/** Hjälpare: hämta de N bäst skyddande åtgärderna mot ett scenario (level >= 2). */
export function topShieldingUpgrades(scenarioId: string, n = 3): UpgradeId[] {
  return rankUpgradesByScenarioShielding(scenarioId)
    .filter((id) => (UPGRADE_EVIDENCE[id].scenarioShielding[scenarioId]?.level ?? 0) >= 2)
    .slice(0, n);
}
