"use client";

import { useState } from "react";
import type {
  RefinementAnswers,
  SEZone,
  HousingType,
  HeatingType,
  BigConsumer,
  BillData,
  ElContractType,
} from "../types";
import { STRINGS } from "../data/strings";
import { BIG_CONSUMER_PROFILES } from "../data/energy-profiles";

const SE_ZONES: { value: SEZone; label: string; description: string }[] = [
  { value: "SE1", label: "SE1", description: "Norra Sverige (Luleå)" },
  { value: "SE2", label: "SE2", description: "Mellannorrland (Sundsvall)" },
  { value: "SE3", label: "SE3", description: "Mellansverige (Stockholm)" },
  { value: "SE4", label: "SE4", description: "Södra Sverige (Malmö)" },
];

const HOUSING_OPTIONS: { value: HousingType; label: string; description: string }[] = [
  { value: "villa", label: "Villa", description: "Fristående hus" },
  { value: "radhus", label: "Radhus", description: "Rad-/kedjehus" },
  { value: "lagenhet", label: "Lägenhet", description: "Bostadsrätt/hyresrätt" },
];

const HEATING_OPTIONS: { value: HeatingType; label: string; description: string }[] = [
  { value: "direktel", label: "Direktel", description: "Element eller golvvärme" },
  { value: "luftluft", label: "Luft/luft-värmepump", description: "Vanligast i villor" },
  { value: "luftvatten", label: "Luft/vatten-värmepump", description: "Värmer hela huset via vatten" },
  { value: "bergvarme", label: "Bergvärme", description: "Borrhål, stabil COP" },
  { value: "fjarrvarme", label: "Fjärrvärme", description: "Vanligt i lägenheter/radhus" },
];

const EL_CONTRACT_OPTIONS: { value: ElContractType; label: string; description: string }[] = [
  { value: "dynamic", label: "Dynamiskt pris", description: "Timpris eller kvartspris — du betalar aktuellt spotpris" },
  { value: "monthly", label: "Månadsmedel", description: "Genomsnittligt spotpris per månad (hette tidigare rörligt pris)" },
  { value: "fixed", label: "Fast", description: "Fast pris — avtalat pris oavsett marknad" },
];

const BIG_CONSUMER_OPTIONS: { value: BigConsumer; label: string; icon: string }[] = [
  { value: "elbil", label: "Elbil", icon: BIG_CONSUMER_PROFILES.elbil.icon },
  { value: "pool", label: "Pool", icon: BIG_CONSUMER_PROFILES.pool.icon },
  { value: "spabad", label: "Spabad", icon: BIG_CONSUMER_PROFILES.spabad.icon },
  { value: "bastu", label: "Bastu", icon: BIG_CONSUMER_PROFILES.bastu.icon },
];

interface ProfileFormProps {
  billData: BillData;
  initialRefinement?: RefinementAnswers;
  initialSeZone?: SEZone;
  onComplete: (seZone: SEZone, refinement: RefinementAnswers, answeredQuestions: number) => void;
}

export default function VerificationScreen({ billData, initialRefinement, initialSeZone, onComplete }: ProfileFormProps) {
  // Pure input — no inference. Sensible defaults instead.
  const [seZone, setSeZone] = useState<SEZone>(initialSeZone ?? billData.seZone ?? "SE3");
  const [housingType, setHousingType] = useState<HousingType>(initialRefinement?.housingType ?? "villa");
  const [heatingTypes, setHeatingTypes] = useState<HeatingType[]>(initialRefinement?.heatingTypes ?? []);
  const [area, setArea] = useState(initialRefinement?.area ?? 120);
  const [residents, setResidents] = useState(initialRefinement?.residents ?? 3);
  const [bigConsumers, setBigConsumers] = useState<BigConsumer[]>(initialRefinement?.bigConsumers ?? []);
  const [noneOfThese, setNoneOfThese] = useState(false);
  const [elContractType, setElContractType] = useState<ElContractType>(initialRefinement?.elContractType ?? billData.elContractType ?? "monthly");
  const [hasSolar, setHasSolar] = useState(initialRefinement?.hasSolar ?? billData.hasProductionRevenue ?? false);
  const [solarSizeKw, setSolarSizeKw] = useState(initialRefinement?.solarSizeKw ?? 10);
  const [hasBattery, setHasBattery] = useState(initialRefinement?.hasBattery ?? false);
  const [batterySizeKwh, setBatterySizeKwh] = useState(initialRefinement?.batterySizeKwh ?? 15);

  const annualKwh = billData.annualKwh ?? billData.kwhPerMonth * 12;

  const toggleHeating = (ht: HeatingType) => {
    setHeatingTypes((prev) =>
      prev.includes(ht) ? prev.filter((t) => t !== ht) : [...prev, ht]
    );
  };

  const toggleBigConsumer = (bc: BigConsumer) => {
    setNoneOfThese(false);
    setBigConsumers((prev) =>
      prev.includes(bc) ? prev.filter((c) => c !== bc) : [...prev, bc]
    );
  };

  const handleNoneOfThese = () => {
    setNoneOfThese(true);
    setBigConsumers([]);
  };

  const handleSubmit = () => {
    const refinement: RefinementAnswers = {
      housingType,
      heatingTypes,
      heatingType: heatingTypes[0],
      area,
      residents,
      elContractType,
      bigConsumers: bigConsumers.length > 0 ? bigConsumers : undefined,
      hasSolar,
      solarSizeKw: hasSolar ? solarSizeKw : undefined,
      hasBattery: hasSolar ? hasBattery : false,
      batterySizeKwh: hasSolar && hasBattery ? batterySizeKwh : undefined,
    };
    onComplete(seZone, refinement, 6);
  };

  return (
    <div className="mx-auto max-w-md px-4 animate-fade-in">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-text-primary">
          Bekräfta &amp; komplettera
        </h2>
        <p className="mt-1 text-sm text-text-secondary">
          Kontrollera fakturadatan vi tolkat och fyll i några uppgifter om ditt hem
          för en träffsäker analys.
        </p>
      </div>

      {/* Vi hittade följande — parsed bill data */}
      <div className="mb-5 rounded-2xl border border-brand-200 bg-brand-50/40 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text-primary">Vi hittade följande på din faktura</h3>
          <span className="text-[10px] font-medium uppercase tracking-wider text-brand-600">automatiskt tolkat</span>
        </div>
        <div className="flex flex-col gap-2 text-sm">
          {billData.invoicePeriodKwh && billData.invoiceMonth !== undefined && (
            <div className="flex justify-between">
              <span className="text-text-secondary">
                Förbrukning ({["jan","feb","mar","apr","maj","jun","jul","aug","sep","okt","nov","dec"][billData.invoiceMonth]})
              </span>
              <span className="font-semibold text-text-primary">{Math.round(billData.invoicePeriodKwh).toLocaleString("sv-SE")} kWh</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-text-secondary">Beräknad årsförbrukning</span>
            <span className="font-semibold text-text-primary">{Math.round(annualKwh).toLocaleString("sv-SE")} kWh</span>
          </div>
          {billData.costPerMonth > 0 && (
            <div className="flex justify-between">
              <span className="text-text-secondary">Periodens kostnad</span>
              <span className="font-semibold text-text-primary">{Math.round(billData.costPerMonth).toLocaleString("sv-SE")} kr</span>
            </div>
          )}
          {billData.seZone && (
            <div className="flex justify-between">
              <span className="text-text-secondary">Elområde</span>
              <span className="font-semibold text-text-primary">{billData.seZone}</span>
            </div>
          )}
          {billData.elhandlare && (
            <div className="flex justify-between">
              <span className="text-text-secondary">Elhandlare</span>
              <span className="font-semibold text-text-primary">{billData.elhandlare}</span>
            </div>
          )}
          {billData.natAgare && (
            <div className="flex justify-between">
              <span className="text-text-secondary">Nätbolag</span>
              <span className="font-semibold text-text-primary">{billData.natAgare}</span>
            </div>
          )}
          {billData.elContractType && (
            <div className="flex justify-between">
              <span className="text-text-secondary">Avtalstyp</span>
              <span className="font-semibold text-text-primary">
                {billData.elContractType === "dynamic" ? "Timspot" :
                 billData.elContractType === "monthly" ? "Månadsmedel" :
                 "Fastpris"}
              </span>
            </div>
          )}
          {billData.invoiceSpotPriceOre !== undefined && (
            <div className="flex justify-between">
              <span className="text-text-secondary">Spotpris (snitt)</span>
              <span className="font-semibold text-text-primary">{billData.invoiceSpotPriceOre.toFixed(1)} öre/kWh</span>
            </div>
          )}
          {billData.invoiceMarkupOre !== undefined && (
            <div className="flex justify-between">
              <span className="text-text-secondary">Påslag</span>
              <span className="font-semibold text-text-primary">{billData.invoiceMarkupOre.toFixed(1)} öre/kWh</span>
            </div>
          )}
        </div>
        <p className="mt-3 text-xs text-text-muted">
          Stämmer det inte? <button type="button" className="underline hover:text-text-secondary" onClick={() => window.history.back()}>Tillbaka för att ladda upp fler fakturor</button>
        </p>
      </div>

      <div className="mb-4">
        <h3 className="text-base font-semibold text-text-primary">Berätta om ditt hem</h3>
        <p className="mt-0.5 text-xs text-text-secondary">Hjälper oss anpassa simuleringen efter din situation.</p>
      </div>

      <div className="flex flex-col gap-5">
        {/* Boendetyp */}
        <div className="card-strong rounded-2xl p-4">
          <label className="text-sm font-semibold text-text-primary">Boendetyp</label>
          <div className="mt-2 flex gap-2">
            {HOUSING_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setHousingType(opt.value)}
                className={`flex-1 flex flex-col items-center gap-0.5 rounded-xl border-2 px-3 py-2.5 text-sm font-medium transition-all ${
                  housingType === opt.value
                    ? "border-brand-500 bg-brand-50 text-brand-700"
                    : "border-border text-text-secondary hover:border-brand-500"
                }`}
              >
                <span>{opt.label}</span>
                <span className="text-[10px] text-text-muted font-normal">{opt.description}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Uppvärmning (multi-select) */}
        <div className="card-strong rounded-2xl p-4">
          <label className="text-sm font-semibold text-text-primary">Uppvärmning</label>
          <p className="mt-0.5 text-[11px] text-text-muted">Välj en eller flera — detta påverkar analysen mest</p>
          <div className="mt-2 flex flex-col gap-2">
            {HEATING_OPTIONS.map((opt) => {
              const checked = heatingTypes.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  onClick={() => toggleHeating(opt.value)}
                  className={`flex items-center gap-3 rounded-xl border-2 px-4 py-2.5 text-left text-sm font-medium transition-all ${
                    checked
                      ? "border-brand-500 bg-brand-50 text-brand-700"
                      : "border-border text-text-secondary hover:border-brand-500"
                  }`}
                >
                  <div className={`flex h-5 w-5 items-center justify-center rounded border-2 transition-colors ${
                    checked ? "border-brand-500 bg-brand-500" : "border-gray-300"
                  }`}>
                    {checked && (
                      <svg className="h-3 w-3 text-white" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <span>{opt.label}</span>
                    <span className="block text-[10px] text-text-muted font-normal">{opt.description}</span>
                  </div>
                </button>
              );
            })}
          </div>
          {heatingTypes.length === 0 && (
            <p className="mt-2 text-[11px] text-amber-600">Välj minst ett uppvärmningssätt för att gå vidare</p>
          )}
        </div>

        {/* Elområde */}
        <div className="card-strong rounded-2xl p-4">
          <label className="text-sm font-semibold text-text-primary">Elområde</label>
          <p className="mt-0.5 text-[11px] text-text-muted">Påverkar elpriser och klimatprofil</p>
          <div className="mt-2 flex gap-2">
            {SE_ZONES.map((zone) => (
              <button
                key={zone.value}
                onClick={() => setSeZone(zone.value)}
                className={`flex-1 rounded-xl border-2 px-2 py-2.5 text-center transition-all ${
                  seZone === zone.value
                    ? "border-brand-500 bg-brand-500/10"
                    : "border-border hover:border-brand-500"
                }`}
              >
                <span className={`text-sm font-bold ${seZone === zone.value ? "text-brand-600" : "text-text-primary"}`}>
                  {zone.label}
                </span>
                <span className="block text-[10px] text-text-muted">{zone.description.split("(")[1]?.replace(")", "") ?? zone.description}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Elavtal */}
        <div className="card-strong rounded-2xl p-4">
          <label className="text-sm font-semibold text-text-primary">Elavtal</label>
          <p className="mt-0.5 text-[11px] text-text-muted">Avgör hur du kan dra nytta av prisvariationer</p>
          <div className="mt-2 flex flex-col gap-2">
            {EL_CONTRACT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setElContractType(opt.value)}
                className={`flex items-center gap-3 rounded-xl border-2 px-4 py-2.5 text-left text-sm font-medium transition-all ${
                  elContractType === opt.value
                    ? "border-brand-500 bg-brand-50 text-brand-700"
                    : "border-border text-text-secondary hover:border-brand-500"
                }`}
              >
                <div className={`flex h-4 w-4 items-center justify-center rounded-full border-2 transition-colors ${
                  elContractType === opt.value ? "border-brand-500" : "border-gray-300"
                }`}>
                  {elContractType === opt.value && (
                    <div className="h-2 w-2 rounded-full bg-brand-500" />
                  )}
                </div>
                <div>
                  <span>{opt.label}</span>
                  <span className="block text-[10px] text-text-muted font-normal">{opt.description}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Total bostadsyta (slider) */}
        <div className="card-strong rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-text-primary">Total bostadsyta</label>
            <span className="text-sm font-bold text-brand-600">{area} m²</span>
          </div>
          <p className="mt-1 text-[11px] text-text-muted leading-relaxed">
            All uppvärmd yta tillsammans — boarea + biarea (källare, garage,
            vind eller tillbyggnad som du värmer upp).
          </p>
          <input
            type="range"
            min={20}
            max={400}
            step={5}
            value={area}
            onChange={(e) => setArea(Number(e.target.value))}
            className="mt-3 w-full accent-brand-500"
          />
          <div className="flex justify-between text-[10px] text-text-muted">
            <span>20 m²</span>
            <span>400 m²</span>
          </div>
        </div>

        {/* Antal boende (slider) */}
        <div className="card-strong rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-text-primary">Antal boende</label>
            <span className="text-sm font-bold text-brand-600">{residents} {residents === 1 ? "person" : "personer"}</span>
          </div>
          <input
            type="range"
            min={1}
            max={8}
            step={1}
            value={residents}
            onChange={(e) => setResidents(Number(e.target.value))}
            className="mt-3 w-full accent-brand-500"
          />
          <div className="flex justify-between text-[10px] text-text-muted">
            <span>1</span>
            <span>8</span>
          </div>
        </div>

        {/* Befintlig utrustning */}
        <div className="card-strong rounded-2xl p-4">
          <label className="text-sm font-semibold text-text-primary">Befintlig utrustning</label>
          <p className="mt-0.5 text-[11px] text-text-muted">Har du någon av dessa redan installerat?</p>

          {/* Solceller */}
          <div className="mt-3">
            <button
              onClick={() => {
                const next = !hasSolar;
                setHasSolar(next);
                if (!next) setHasBattery(false);
              }}
              className={`flex w-full items-center gap-3 rounded-xl border-2 px-4 py-2.5 text-left text-sm font-medium transition-all ${
                hasSolar
                  ? "border-brand-500 bg-brand-50 text-brand-700"
                  : "border-border text-text-secondary hover:border-brand-500"
              }`}
            >
              <div className={`flex h-5 w-5 items-center justify-center rounded border-2 transition-colors ${
                hasSolar ? "border-brand-500 bg-brand-500" : "border-gray-300"
              }`}>
                {hasSolar && (
                  <svg className="h-3 w-3 text-white" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <span>☀️ Solceller</span>
            </button>
            {hasSolar && (
              <div className="mt-2 ml-8 mr-2">
                <div className="flex items-center justify-between text-[12px]">
                  <span className="text-text-muted">Storlek</span>
                  <span className="font-bold text-brand-600">{solarSizeKw} kW</span>
                </div>
                <input
                  type="range"
                  min={2}
                  max={20}
                  step={1}
                  value={solarSizeKw}
                  onChange={(e) => setSolarSizeKw(Number(e.target.value))}
                  className="mt-1 w-full accent-brand-500"
                />
                <div className="flex justify-between text-[10px] text-text-muted">
                  <span>2 kW</span>
                  <span>20 kW</span>
                </div>
              </div>
            )}
          </div>

          {/* Hembatteri (bara om solceller) */}
          {hasSolar && (
            <div className="mt-2">
              <button
                onClick={() => setHasBattery(!hasBattery)}
                className={`flex w-full items-center gap-3 rounded-xl border-2 px-4 py-2.5 text-left text-sm font-medium transition-all ${
                  hasBattery
                    ? "border-brand-500 bg-brand-50 text-brand-700"
                    : "border-border text-text-secondary hover:border-brand-500"
                }`}
              >
                <div className={`flex h-5 w-5 items-center justify-center rounded border-2 transition-colors ${
                  hasBattery ? "border-brand-500 bg-brand-500" : "border-gray-300"
                }`}>
                  {hasBattery && (
                    <svg className="h-3 w-3 text-white" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <span>🔋 Hembatteri</span>
              </button>
              {hasBattery && (
                <div className="mt-2 ml-8 mr-2">
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="text-text-muted">Kapacitet</span>
                    <span className="font-bold text-brand-600">{batterySizeKwh} kWh</span>
                  </div>
                  <input
                    type="range"
                    min={5}
                    max={50}
                    step={1}
                    value={batterySizeKwh}
                    onChange={(e) => setBatterySizeKwh(Number(e.target.value))}
                    className="mt-1 w-full accent-brand-500"
                  />
                  <div className="flex justify-between text-[10px] text-text-muted">
                    <span>5 kWh</span>
                    <span>50 kWh</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Storförbrukare */}
        <div className="card-strong rounded-2xl p-4">
          <label className="text-sm font-semibold text-text-primary">{STRINGS.bigConsumersTitle}</label>
          <div className="mt-3 flex flex-wrap gap-2">
            {BIG_CONSUMER_OPTIONS.map((opt) => {
              const selected = bigConsumers.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  onClick={() => toggleBigConsumer(opt.value)}
                  className={`flex items-center gap-2 rounded-xl border-2 px-4 py-2.5 text-sm font-medium transition-all ${
                    selected
                      ? "border-brand-500 bg-brand-50 text-brand-700"
                      : "border-border text-text-secondary hover:border-brand-500"
                  }`}
                >
                  <span>{opt.icon}</span>
                  {opt.label}
                </button>
              );
            })}
            <button
              onClick={handleNoneOfThese}
              className={`flex items-center gap-2 rounded-xl border-2 px-4 py-2.5 text-sm font-medium transition-all ${
                noneOfThese
                  ? "border-brand-500 bg-brand-50 text-brand-700"
                  : "border-border text-text-secondary hover:border-brand-500"
              }`}
            >
              {STRINGS.noneOfThese}
            </button>
          </div>
        </div>
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={heatingTypes.length === 0}
        className="mt-6 mb-8 w-full rounded-2xl bg-cta-orange px-6 py-3 font-semibold text-white shadow-lg transition-all hover:shadow-xl hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {STRINGS.next}
      </button>
    </div>
  );
}