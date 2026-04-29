"use client";

/**
 * Stub: /mina-sidor är inte den riktiga "Mina sidor"-routen.
 * Den verkliga vyn (alternativt resultat-flöde) finns nu inbäddad i
 * ResultOverview.tsx via toggle "Klassisk vy" / "Ny vy". Användaren
 * når den genom det vanliga analysflödet — inte via separat URL.
 *
 * Denna sida finns bara som placeholder tills mappen kan tas bort
 * (filsystemtillstånd hindrar `rm` just nu).
 */

import { redirect } from "next/navigation";

export default function MinaSidorRedirect() {
  redirect("/");
}
