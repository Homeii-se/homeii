/**
 * Typer för energiflödes-simuleringen.
 *
 * Modulen `lib/energy-flow` simulerar ett dygn i ett svenskt villa-hushåll
 * med varierande utrustning (värmepump, solpaneler, hembatteri, elbil med
 * V2H, smart styrning) under olika säsonger och prismodeller.
 *
 * All logik är ren TypeScript utan UI-beroenden — kan användas både i
 * React-komponenter och i tester.
 */

export type Season = "vinter" | "host" | "sommar";

export type PriceModel = "manadsmedel" | "dynamiskt";

/**
 * Konfiguration av hushållet och prismodell. Används som input till
 * `buildScenario` och `computeAnnualSaving`.
 */
export interface Settings {
  season: Season;
  /** Värmepump (COP ~3,2). Annars direktel (COP 1,0). */
  hasHP: boolean;
  /** Elbil med V2H (Vehicle-to-Home). */
  hasEV: boolean;
  /** Solpaneler. */
  hasSol: boolean;
  /** Hembatteri (10 kWh, 5 kW peak). */
  hasBat: boolean;
  /** Smart styrning (kräver dynamiskt pris för full effekt). */
  hasSmart: boolean;
  prismodell: PriceModel;
}

/**
 * Snapshot av ett enskilt timsteg i simuleringen. Energiposterna är i kW
 * (motsvarar kWh under 1 timme). Pris är i öre/kWh.
 */
export interface HourSnapshot {
  /** Timme 0–23. */
  h: number;
  /** Solproduktion (kW). */
  sol: number;
  /** Total husefterfrågan inkl. EV-laddning (kW). */
  totalDemand: number;
  /** Värme + varmvatten + ev. AC-kylning (kW). */
  heatTotal: number;
  /** EV-laddning från husets energisystem (kW). */
  ev: number;
  /** V2H — elbil → huset (kW). */
  evToHouse: number;
  /** Är elbilen bortrest just nu (kör barnen 15:00–20:00)? */
  evAway: boolean;
  /** Övrig hushållsel (kW). */
  other: number;

  /** Sol → husets instantana laster (kW). */
  solToHouse: number;
  /** Sol → batteri-laddning (kW). */
  solToBat: number;
  /** Sol → exporterad till nät (kW). */
  solToGrid: number;
  /** Nät → huset (inkl. ev. nät → batteri) (kW). */
  gridToHouse: number;
  /** Nät → batteri-laddning (kW). */
  gridToBat: number;
  /** Batteri → husets laster (kW). */
  batToHouse: number;
  /** Total batteri-laddning denna timme (sol + nät) (kW). */
  batCharge: number;
  /** Total batteri-urladdning denna timme (kW). */
  batDischarge: number;

  /** Batteriets state-of-charge efter timsteget (0–1). */
  soc: number;
  /** Elbilens räckvidd efter timsteget (mil). */
  evMil: number;

  /** Spotpris denna timme (öre/kWh). */
  price: number;
  /** Effektivt pris (månadsmedel eller spot beroende på prismodell). */
  effectivePrice: number;
  /** Månadens medelspotpris (öre/kWh). */
  monthAvg: number;
  /** Kumulativ kostnad fram till och med denna timme (kr). */
  cumCost: number;
}

/**
 * Resultat av att simulera ett dygn. Returneras från `buildScenario`.
 */
export interface Scenario {
  /** 24 timsteg, index = h. */
  hours: HourSnapshot[];
  /** Hourly spotpriser (öre/kWh) för säsongen. */
  prices: number[];
  /** Månadsmedel av spotpriser (öre/kWh). */
  monthAvg: number;

  /** Total nät-importerad energi gånger pris (kr). */
  gridCost: number;
  /** Intäkt från sol-export (kr). */
  exportRevenue: number;
  /** Energi-kostnad netto: gridCost − exportRevenue (kr). */
  energyCost: number;
  /** Effektavgift baserad på dygnets högsta nät-effekt (kr). */
  effektavgift: number;
  /** Dygnets högsta nät-effekt (kW). */
  peakKw: number;
  /** Total dygnskostnad: energyCost + effektavgift (kr).
   *  Subtrahera ev. stödtjänst-intäkt för att få nettokostnad. */
  dayCost: number;
}

/**
 * Allokeringsnycklar för energiflöden mellan källor och sänkor.
 * Används av `allocate()` för proportionell fördelning av varje
 * källas bidrag till lasterna värme, EV-laddning och övrigt.
 */
export type AllocationKey =
  | "sol-heat"
  | "sol-ev"
  | "sol-other"
  | "sol-bat"
  | "sol-grid"
  | "grid-heat"
  | "grid-ev"
  | "grid-other"
  | "grid-bat"
  | "bat-heat"
  | "bat-ev"
  | "bat-other"
  | "ev-heat"
  | "ev-ev"
  | "ev-other";

export type Allocation = Record<AllocationKey, number>;

/**
 * Narrativ-block med rubrik och kropp. `mood` styr visuell färgning
 * (grön peak-good, gul varning, neutralt tomt).
 */
export interface Narrative {
  mood: "" | "warn" | "peak-good";
  head: string;
  body: string;
}

/**
 * Frekvensreserv-event där batteriet stöttar nätets frekvens och
 * får betalt för det. Tidsangivelser i minuter sedan midnatt.
 */
export interface StodtjanstEvent {
  startMin: number;
  endMin: number;
  /** Belopp som tjänas på event:et (kr). */
  kr: number;
}

/**
 * Säsongsviktad årsbesparing jämfört med gårdagens hem (passiv konsument).
 */
export interface AnnualSaving {
  /** Total årsbesparing (kr). */
  total: number;
  /** Bidrag per säsong (kr). */
  byseason: Record<Season, number>;
}
