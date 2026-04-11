/**
 * Default electricity retailer (elhandlare) pricing.
 *
 * Elhandlarens påslag varierar kraftigt:
 * - Tibber: ~6 öre fast påslag + 3-4 öre rörligt = ~10 öre totalt
 * - Soldags: ~4 öre fast påslag + 7 öre rörligt = ~11 öre totalt
 * - Green Hero: liknande Soldags
 * - Stora handlare (Vattenfall, E.ON): 5-15 öre beroende på avtal
 *
 * @source Elpriskollen / Energimarknadsinspektionen
 * @updated 2026-04-04
 * @notes Genomsnittligt påslag för rörliga/timavtal. Fastprisavtal har
 *        påslaget inbakat i priset och modelleras annorlunda.
 */

export const ELHANDEL_DEFAULTS = {
  /** Genomsnittligt påslag (rörligt + fast per kWh) exkl moms (öre/kWh) */
  avgMarkupOrePerKwh: 8.0,
  /** Typisk månadsavgift exkl moms (kr/mån) — många har 0-39 kr */
  avgMonthlyFeeKr: 0,
  /** Spotprisersättning för producerad/exporterad el (andel av spotpris) */
  productionCompensationRate: 0.80,
} as const;
