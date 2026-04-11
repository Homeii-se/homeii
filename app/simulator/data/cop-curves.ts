/**
 * Heat pump COP curves and temperature data.
 */

/**
 * Heat pump COP at different outdoor temperatures [temp °C, COP]
 * @source Energimyndighetens värmepumpslista
 * @updated 2026-04-04
 * @notes Typiska SCOP-värden för olika utomhustemperaturer
 */
export const HEAT_PUMP_COP_CURVES: Record<string, [number, number][]> = {
  luftluft: [[-20, 1.3], [-10, 1.8], [0, 2.6], [7, 3.3], [15, 4.0]],
  luftvatten: [[-20, 1.5], [-10, 2.1], [0, 2.8], [7, 3.6], [15, 4.3]],
  bergvarme: [[-20, 3.2], [-10, 3.4], [0, 3.6], [7, 4.0], [15, 4.2]],
};

/**
 * Average monthly temperatures for Stockholm (°C)
 * @source SMHI normalvärden 1991-2020
 * @updated 2026-04-04
 * @notes Används som fallback; zonspecifika temperaturer finns i climate.ts
 */
export const AVERAGE_MONTHLY_TEMP_STOCKHOLM = [
  -3, -3, 1, 6, 12, 17,
  20, 18, 13, 7, 2, -1,
];

/**
 * Hourly temperature offset from daily mean (°C)
 * @source SMHI
 * @updated 2026-04-04
 * @notes Typisk dygnsvariation, min vid 04:00, max vid 14:00
 */
export const HOURLY_TEMP_OFFSET = [
  -3, -3.5, -4, -4.5, -4, -3,
  -1, 0, 1, 2, 3, 3.5,
  4, 4.5, 4, 3.5, 3, 2,
  1, 0, -0.5, -1, -1.5, -2,
];
