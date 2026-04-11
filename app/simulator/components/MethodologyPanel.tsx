"use client";

import { useState } from "react";
import { DATA_SOURCES } from "../data/strings";
import { CLIMATE_DATA_SOURCES } from "../climate";

const ALL_SOURCES = { ...DATA_SOURCES, ...CLIMATE_DATA_SOURCES };

export default function MethodologyPanel() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="glass-card-strong rounded-2xl">
      {/* Header — always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between p-4 text-left"
      >
        <div>
          <h3 className="text-base font-semibold text-text-primary">
            Så räknar vi
          </h3>
          <p className="text-xs text-text-muted">
            Metodologi, datakällor och beräkningsmodell
          </p>
        </div>
        <svg
          className={`h-5 w-5 text-text-muted transition-transform ${
            expanded ? "rotate-180" : ""
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expandable content */}
      {expanded && (
        <div className="border-t border-border p-4">
          {/* Architecture overview */}
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-text-primary mb-3">
              Beräkningsmodell
            </h4>
            <p className="text-xs text-text-muted leading-relaxed mb-3">
              Simuleringen bygger på fyra oberoende lager som samverkar för att ge en
              komplett bild av din energiekonomi:
            </p>
            <div className="space-y-3 text-sm text-text-muted leading-relaxed">
              <div className="rounded-lg bg-brand-500/5 p-3 border border-brand-500/10">
                <p className="text-xs font-semibold text-text-primary mb-1">
                  1. Förbrukningsprofil
                </p>
                <p className="text-xs">
                  Din årsförbrukning fördelas över årets månader med hjälp av
                  <strong> gradtimmar</strong> — ett mått på uppvärmningsbehovet
                  baserat på utetemperaturen i din SE-zon. Temperaturdatan kommer
                  från SMHI:s normalvärden 1991-2020 för representativa städer
                  (Luleå, Sundsvall, Stockholm, Malmö). Resultat: en villa i SE1 får
                  en helt annan säsongsvariation än en i SE4.
                </p>
              </div>

              <div className="rounded-lg bg-brand-500/5 p-3 border border-brand-500/10">
                <p className="text-xs font-semibold text-text-primary mb-1">
                  2. Produktionsprofil
                </p>
                <p className="text-xs">
                  <strong>Solproduktion</strong> beräknas timvis per SE-zon med PVGIS-data
                  anpassad för latituden (55–66°N). Daglängd, solhöjd och säsongsblending
                  varierar mellan zonerna. <strong>Värmepumpar</strong> modelleras med
                  COP-kurvor från Energimyndighetens värmepumpslista, interpolerade mot
                  den faktiska utetemperaturen i din zon — timme för timme.
                </p>
              </div>

              <div className="rounded-lg bg-brand-500/5 p-3 border border-brand-500/10">
                <p className="text-xs font-semibold text-text-primary mb-1">
                  3. Prismodell
                </p>
                <p className="text-xs">
                  Elpriser baseras på historiska genomsnittspriser per SE-zon från
                  Elpriskollen/Nord Pool, med timprisvariationer som speglar typiska
                  dag-/nattmönster. Modellen stödjer prisscenarier: vad händer med
                  din investering om elpriset stiger 5%/år? Eller sjunker?
                </p>
              </div>

              <div className="rounded-lg bg-brand-500/5 p-3 border border-brand-500/10">
                <p className="text-xs font-semibold text-text-primary mb-1">
                  4. Investeringsmodell
                </p>
                <p className="text-xs">
                  Investeringskostnader baseras på Boverkets och Energimyndighetens
                  data (2025-2026 priser inkl. moms). Lönsamheten beräknas med
                  nuvärdesmetoden (NPV) med hänsyn till kalkylränta, livslängd och
                  framtida prisförändringar — inte bara enkel payback.
                </p>
              </div>
            </div>
          </div>

          {/* Battery simulation details */}
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-text-primary mb-3">
              Batterisimulering
            </h4>
            <p className="text-xs text-text-muted leading-relaxed">
              Batteriet optimerar timme för timme: laddar från solöverskott först,
              sedan från nätet vid låga priser (under 65 öre/kWh, max 30% av
              laddkapacitet, max 20% av batteriets kapacitet per dag). Urladdning
              sker vid förbrukning som överstiger solproduktionen. Förlusterna
              (round-trip efficiency) är 92%.
            </p>
          </div>

          {/* Data sources */}
          <div>
            <h4 className="text-sm font-semibold text-text-primary mb-3">
              Datakällor
            </h4>
            <div className="space-y-3">
              {Object.entries(ALL_SOURCES).map(([key, source]) => (
                <div key={key} className="rounded-lg bg-brand-500/5 p-3 border border-brand-500/10">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-xs font-semibold text-text-primary">
                      {source.label}
                    </p>
                  </div>
                  <p className="text-xs text-text-muted mb-2">
                    <strong>Källa:</strong>{" "}
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand-300 hover:text-brand-200 transition-colors underline"
                    >
                      {source.source}
                    </a>
                  </p>
                  <p className="text-xs text-text-muted italic">
                    {source.note}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Disclaimer */}
          <div className="mt-6 rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-3">
            <p className="text-xs text-text-muted">
              <strong>Observera:</strong> Dessa beräkningar är estimat baserade på genomsnittlig
              klimatdata och typiska förbrukningsmönster. Faktiska besparingar beror på väder,
              användarmönster och systemkonfiguration. Modellen blir mer träffsäker om du anger
              dina uppgifter korrekt. För större investeringar rekommenderas alltid en kompletterande
              bedömning av en auktoriserad energikonsult.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}