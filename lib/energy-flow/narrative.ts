import type { Settings, Narrative } from "./types";

/**
 * Genererar narrativ-text (rubrik + kropp + mood) för en given timme i
 * scenariot. Texten är **tid-baserad** — den växlar bara vid timgränser
 * mellan 5 stabila slots:
 *
 *   1. 22:00–06:00  Natt
 *   2. 06:00–09:00  Morgonpeak
 *   3. 09:00–15:00  Förmiddag/dag
 *   4. 15:00–20:00  Eftermiddag (elbil bortrest)
 *   5. 20:00–22:00  Kvällspeak
 *
 * Två overrides finns för speciella konfigurationer: 2015-passiv konsument
 * (en text hela dygnet) och utrustning utan dynamiskt pris (varning om
 * att investeringarna sover med månadsmedel).
 *
 * Tidigare versioner var event-triggade (t.ex. "om gridToBat > 0.3 visa X")
 * men det skapade flapping mellan minutrar. Tid-baserade slots ger 5
 * stabila byten per dygn istället för 15+.
 */
export function buildNarrative(settings: Settings, h: number): Narrative {
  const { season, hasHP, hasEV, hasSol, hasBat, hasSmart, prismodell } =
    settings;
  const dyn = prismodell === "dynamiskt";
  const smart = hasSmart && dyn;
  const isPassive =
    !hasHP && !hasEV && !hasSol && !hasBat && !hasSmart;

  // Override 1: 2015 passiv konsument (en text hela dygnet)
  if (isPassive) {
    return {
      mood: "warn",
      head: "Passiv konsument — direktel",
      body:
        "Hemmet köper varje kilowattimme rätt av nätet. Direktel toppar dramatiskt morgon och kväll. En värmepump skulle sänka elförbrukningen med ungefär 65 %.",
    };
  }

  // Override 2: utrustning utan dynamiskt pris (en text hela dygnet)
  if (!dyn && (hasEV || hasBat || hasSmart)) {
    return {
      mood: "warn",
      head: "Du sparar inte så mycket som du borde",
      body:
        "Batteri, elbil och smart styrning tjänar pengar främst på prisvariation. Med månadsmedel kostar alla timmar lika mycket — investeringarna sover tills du byter till dynamiskt pris.",
    };
  }

  // Slot 1: 22:00–06:00 Natt
  if (h >= 22 || h < 6) {
    if (smart && (hasBat || hasEV)) {
      return {
        mood: "",
        head: "Lugn natt — laddning på billiga timmar",
        body:
          "Smart styrning fyller batteri och elbil när priset är som lägst. Hemmet i övrigt vilar.",
      };
    }
    return {
      mood: "",
      head: "Lugn natt",
      body: hasHP
        ? "Värmepumpen tickar på, övriga laster är låga."
        : "Direktel håller värmen, övriga laster är låga.",
    };
  }

  // Slot 2: 06:00–09:00 Morgonpeak
  if (h < 9) {
    if (smart && (hasBat || hasEV)) {
      return {
        mood: "peak-good",
        head: "Morgonpeak — batteri och bil matar huset",
        body:
          "Smart styrning släpper lagrad el under dygnets dyraste morgontimmar. Du slipper köpa när elen är som dyrast.",
      };
    }
    if (hasHP) {
      return {
        mood: "",
        head: "Morgonpeak — värmepumpen drar",
        body:
          "Frukost, dusch och värmebehov pressar samtidigt. Värmepumpen drar ändå bara 1/3 av vad direktel skulle gjort.",
      };
    }
    return {
      mood: "warn",
      head: "Morgonpeak — direktel toppar",
      body:
        "Värme + varmvatten + frukost pressar samtidigt. Direktel ger dramatiska effekttoppar.",
    };
  }

  // Slot 3: 09:00–15:00 Förmiddag/dag
  if (h < 15) {
    if (season === "vinter") {
      return {
        mood: "",
        head: "Vintervardag — låg sol",
        body: hasSol
          ? "Solen är svag och dagarna korta. Värmepumpen drar mestadels från nätet."
          : hasHP
          ? "Värmepumpen jobbar mot kylan, mestadels från nätet."
          : "Direktel håller värmen, mestadels från nätet.",
      };
    }
    if (hasSol) {
      return {
        mood: "",
        head: "Vardag — solen jobbar",
        body:
          "Solen täcker stora delar av dagsförbrukningen, fyller batteriet och exporterar eventuellt överskott till nätet.",
      };
    }
    return {
      mood: "",
      head: "Vardag",
      body: hasHP
        ? "Värmepumpen håller jämn värme; lugna laster i bakgrunden."
        : "Direktel håller värmen; lugna laster i bakgrunden.",
    };
  }

  // Slot 4: 15:00–20:00 Eftermiddag (elbil bortrest)
  if (h < 20) {
    if (hasEV) {
      return {
        mood: "",
        head: "Elbilen är borta — kör barnen",
        body:
          "Bilen är ute mellan 15 och 20 (träning eller liknande). Hemmet drar bara värme och övriga laster under tiden.",
      };
    }
    return {
      mood: "",
      head: "Eftermiddag",
      body: hasHP
        ? "Värmepumpen håller värmen, hemmet är lugnt innan kvällspeak."
        : "Direktel håller värmen, hemmet är lugnt innan kvällspeak.",
    };
  }

  // Slot 5: 20:00–22:00 Kvällspeak
  if (smart && hasBat) {
    return {
      mood: "peak-good",
      head: "Kvällspeak — batteriet matar huset",
      body:
        "Lagrad el täcker kvällens behov istället för att köpa dyrt från nätet. Du både sparar pengar och kapar effekttoppen.",
    };
  }
  if (hasHP && dyn) {
    return {
      mood: "warn",
      head: "Kvällspeak — värmepumpen mot dyrt nät",
      body:
        "Värmepump + matlagning pressar under nätets dyraste timmar. Ett batteri hade jämnat ut den här toppen.",
    };
  }
  return {
    mood: "warn",
    head: "Kvällspeak",
    body: hasHP
      ? "Värmepump + matlagning + lampor pressar samtidigt."
      : "Direktel + matlagning + lampor — höga effekttoppar.",
  };
}
