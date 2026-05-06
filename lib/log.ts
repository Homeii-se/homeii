/**
 * Lättviktig log-helper med env-styrd utdata.
 *
 * Engine-pipelinen producerar mycket log-spam under utveckling
 * (`[CALIBRATION]`, `[8760-CONSUMPTION]`, `[ENGINE-V2]` etc.) som hjälper
 * vid debug men förorenar production-konsoler. Den här helpern låter
 * loggning styras via en miljövariabel utan att vi behöver flytta
 * varje console.log-anrop manuellt.
 *
 * Default-beteende:
 * - Development (`NODE_ENV !== "production"`): logga allt
 * - Production: logga bara om `NEXT_PUBLIC_DEBUG_LOG === "true"`
 *
 * `console.warn` och `console.error` är fortfarande fritt fram — de
 * är avsedda för faktiska problem som ska synas oavsett miljö.
 */

const isProduction = process.env.NODE_ENV === "production";
const debugFlag = process.env.NEXT_PUBLIC_DEBUG_LOG === "true";

/** True när debug-loggar ska skrivas ut. Beräknas en gång vid modul-load. */
const enabled = !isProduction || debugFlag;

/**
 * Logga ett debug-meddelande med en tagg (t.ex. "ENGINE-V2", "CALIBRATION").
 * No-op i production om `NEXT_PUBLIC_DEBUG_LOG` inte är satt.
 *
 * @example
 *   dlog("ENGINE-V2", "Baseline:", baselineKwh, "kWh");
 *   // Output i dev:  [ENGINE-V2] Baseline: 18000 kWh
 */
export function dlog(tag: string, ...args: unknown[]): void {
  if (!enabled) return;
  console.log(`[${tag}]`, ...args);
}

/** Är debug-loggning påslagen just nu? Användbart för att skippa
 *  dyra log-meddelanden helt (t.ex. JSON.stringify av stora objekt). */
export function isLogEnabled(): boolean {
  return enabled;
}
