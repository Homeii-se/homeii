"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import type { SimulatorState, BillData, RefinementAnswers, SEZone, UpgradeId, Assumptions } from "./simulator/types";
import { DEFAULT_STATE } from "./simulator/data/defaults";
import { UPGRADE_DEFINITIONS, DEFAULT_ACTIVE_UPGRADES } from "./simulator/data/upgrade-catalog";
import { loadState, saveState, clearState } from "./simulator/storage";
import { generateRecommendations } from "./simulator/recommendations/engine";
import StepIndicator from "./simulator/components/StepIndicator";
import LandingHero from "./simulator/components/LandingHero";
import UploadBill from "./simulator/components/UploadBill";
import VerificationScreen from "./simulator/components/VerificationScreen";
import ResultOverview from "./simulator/components/ResultOverview";
import RecommendationResults from "./simulator/components/RecommendationResults";
import Dashboard from "./simulator/components/Dashboard";
import { calculateThreeScenarios } from "./simulator/simulation/scenarios";
import { fetchTmyData } from "./simulator/data/pvgis-tmy";
import type { TmyHourlyData } from "./simulator/data/pvgis-tmy";
import { SE_ZONE_CENTROIDS } from "./simulator/data/geocoding";

const TOTAL_STEPS = 3;

export default function Home() {
  // HYDRATION-SAFE: börja alltid med DEFAULT_STATE så server/client matchar.
  // Läs sparad state från localStorage i useEffect efter hydration nedan.
  const [state, setState] = useState<SimulatorState>(DEFAULT_STATE);
  const [hydrated, setHydrated] = useState(false);
  const [tmyData, setTmyData] = useState<TmyHourlyData[] | null>(null);

  // Ladda sparad state efter hydration (klient-only)
  useEffect(() => {
    const saved = loadState();
    if (!saved.selectedDate || saved.selectedDate === "2026-03-25") {
      saved.selectedDate = new Date().toISOString().split("T")[0];
    }
    // Hydration-safe bootstrap: startar med DEFAULT_STATE så server/klient matchar,
    // läser sedan localStorage enbart client-side i detta mount-once effect. Medvetet mönster.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(saved);
    setHydrated(true);
  }, []);

  // Persist state på alla ändringar — men först efter att vi laddat localStorage
  // (annars skriver vi över sparad state med DEFAULT_STATE i en flicker-frame)
  useEffect(() => {
    if (!hydrated) return;
    saveState(state);
  }, [state, hydrated]);

  const updateState = useCallback((updates: Partial<SimulatorState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  const currentStep = state.completedStep + 1;

  // Scrolla till toppen vid varje stegbyte så användaren inte landar mitt på sidan
  // (kan annars hända om föregående steg var långt eller chatten auto-scrollat)
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "auto" });
    }
  }, [currentStep]);

  // Fetch TMY data when billData exists (use coordinates or SE-zone centroid as fallback)
  useEffect(() => {
    if (!state.billData) return;
    if (tmyData) return; // already fetched

    let lat = state.billData.latitude;
    let lon = state.billData.longitude;

    // Fallback to SE-zone centroid when geocoding failed (Nominatim 403 etc.)
    if (!lat || !lon) {
      const centroid = SE_ZONE_CENTROIDS[state.seZone];
      lat = centroid.lat;
      lon = centroid.lon;
      console.log(`[PAGE] No coordinates on invoice, using ${state.seZone} centroid: ${lat}, ${lon}`);
    }

    let cancelled = false;

    fetchTmyData(lat, lon)
      .then((data) => {
        if (!cancelled) {
          setTmyData(data);
          console.log(`[PAGE] TMY data loaded: ${data.length} hours`);
        }
      })
      .catch((err) => {
        console.warn("[PAGE] Failed to fetch TMY data, falling back to legacy:", err);
      });

    return () => { cancelled = true; };
  }, [state.billData, state.seZone, tmyData]);

  // Compute three scenarios for ResultOverview when recommendations are available
  const threeScenarios = useMemo(() => {
    if (!state.billData || !state.recommendations) return null;
    const recommendedIds = state.recommendations.recommendations.map((r) => r.upgradeId);
    return calculateThreeScenarios(state.billData, state.refinement, state.seZone, state.assumptions, recommendedIds, tmyData ?? undefined);
  }, [state.billData, state.refinement, state.seZone, state.assumptions, state.recommendations, tmyData]);

  // Step handlers
  const handleStart = useCallback(() => {
    updateState({ completedStep: 1 });
  }, [updateState]);

  const handleBillComplete = useCallback(
    (billData: BillData) => {
      updateState({ completedStep: 2, billData });
    },
    [updateState]
  );

  const handleVerificationComplete = useCallback(
    (seZone: SEZone, refinement: RefinementAnswers, answeredQuestions: number) => {
      const billData = state.billData!;

      // Update assumptions with equipment sizes from verification
      const updatedAssumptions: Assumptions = {
        ...state.assumptions,
        ...(refinement.solarSizeKw ? { solarSizeKw: refinement.solarSizeKw } : {}),
        ...(refinement.batterySizeKwh ? { batterySizeKwh: refinement.batterySizeKwh } : {}),
      };

      // Use invoice-extracted pricing if available
      if (billData.natAgare) {
        updatedAssumptions.gridOperator = billData.natAgare;
      }
      if (billData.gridFixedFeeKr !== undefined) {
        updatedAssumptions.gridFixedFeeKr = billData.gridFixedFeeKr;
      }
      if (billData.gridTransferFeeOre !== undefined) {
        updatedAssumptions.gridTransferFeeOre = billData.gridTransferFeeOre;
      }
      if (billData.gridPowerChargeKrPerKw !== undefined) {
        updatedAssumptions.gridPowerChargeKrPerKw = billData.gridPowerChargeKrPerKw;
        updatedAssumptions.gridHasPowerCharge = true;
      }
      if (billData.invoiceMarkupOre !== undefined) {
        updatedAssumptions.elhandelMarkupOre = billData.invoiceMarkupOre;
      }
      if (billData.invoiceMonthlyFeeKr !== undefined) {
        updatedAssumptions.elhandelMonthlyFeeKr = billData.invoiceMonthlyFeeKr;
      }

      const recs = generateRecommendations(billData, refinement, seZone, updatedAssumptions);

      // Pre-select recommended upgrades + existing equipment
      const newUpgrades = { ...DEFAULT_ACTIVE_UPGRADES };
      if (refinement.hasSolar) {
        newUpgrades.solceller = true;
      }
      if (refinement.hasBattery) {
        newUpgrades.batteri = true;
      }
      for (const rec of recs.recommendations) {
        newUpgrades[rec.upgradeId] = true;
        if (rec.upgradeId === "solceller") {
          newUpgrades.batteri = true;
        }
      }

      updateState({
        completedStep: 3,
        seZone,
        refinement,
        answeredQuestions,
        recommendations: recs,
        activeUpgrades: newUpgrades,
        assumptions: updatedAssumptions,
      });
    },
    [state.billData, state.assumptions, updateState]
  );

  // Steg 3 = Resultat & åtgärder är nu sista numrerade steget. CTA:n från resultat-sidan
  // leder direkt till Dashboard (detaljerad analys), inte till en separat rekommendations-sida.
  const handleViewRecommendations = useCallback(() => {
    updateState({ completedStep: 5 });
  }, [updateState]);

  const handleViewDashboard = useCallback(() => {
    updateState({ completedStep: 5 });
  }, [updateState]);

  const handleBackToRecommendations = useCallback(() => {
    // Tillbaka från Dashboard → resultat-sidan (steg 3)
    updateState({ completedStep: 3 });
  }, [updateState]);

  const handleSEZoneChange = useCallback(
    (zone: SEZone) => {
      updateState({ seZone: zone });
    },
    [updateState]
  );

  const handleUpgradeToggle = useCallback(
    (id: UpgradeId) => {
      setState((prev) => {
        const newUpgrades = { ...prev.activeUpgrades };
        const newValue = !newUpgrades[id];
        newUpgrades[id] = newValue;

        if (newValue) {
          const upgrade = UPGRADE_DEFINITIONS.find((u) => u.id === id);
          if (upgrade?.incompatibleWith) {
            for (const incompId of upgrade.incompatibleWith) {
              newUpgrades[incompId as UpgradeId] = false;
            }
          }
        } else {
          if (id === "solceller") {
            newUpgrades.batteri = false;
          }
        }

        return { ...prev, activeUpgrades: newUpgrades };
      });
    },
    []
  );

  const handleDateChange = useCallback(
    (date: string) => {
      updateState({ selectedDate: date });
    },
    [updateState]
  );

  const handleAssumptionsChange = useCallback(
    (assumptions: Assumptions) => {
      updateState({ assumptions });
    },
    [updateState]
  );

  const handleStepClick = useCallback((step: number) => {
    // Step indicator shows steps 1-3, which map to completedStep values:
    // Step 1 (Elräkning)              → completedStep 1 → currentStep 2 = UploadBill
    // Step 2 (Bekräfta)               → completedStep 2 → currentStep 3 = VerificationScreen
    // Step 3 (Resultat & åtgärder)    → completedStep 3 → currentStep 4 = ResultOverview (sista numrerade steget)
    // Dashboard (bortom indikatorn)   → completedStep 5 → currentStep 6 = Dashboard
    // Clicking a completed step navigates back to it
    updateState({ completedStep: step });
  }, [updateState]);

  const handleRestart = useCallback(() => {
    clearState();
    setState({
      ...DEFAULT_STATE,
      selectedDate: new Date().toISOString().split("T")[0],
    });
  }, []);

  return (
    <div className="bg-gradient-main relative min-h-screen pb-12">
      {/* Step indicator — minimal progress-tråd, bara synlig efter landing */}
      {currentStep > 1 && (
        <div className="relative z-10 bg-white/80">
          <StepIndicator
            currentStep={Math.min(currentStep, TOTAL_STEPS)}
            totalSteps={TOTAL_STEPS}
            onStepClick={handleStepClick}
          />
          {/* "Börja om" — diskret länk uppe i högra hörnet */}
          <button
            onClick={handleRestart}
            className="absolute right-3 top-2 text-xs text-text-muted/70 hover:text-text-secondary transition-colors"
            title="Börja om från början"
          >
            Börja om
          </button>
        </div>
      )}

      <div className="relative z-10 mx-auto max-w-2xl pt-8">
        {/* Step 0: Landing */}
        {currentStep === 1 && <LandingHero onStart={handleStart} />}

        {/* Step 1: Upload bill */}
        {currentStep === 2 && (
          <UploadBill
            onComplete={handleBillComplete}
            initialData={state.billData}
          />
        )}

        {/* Step 2: Profile form — user fills in their details */}
        {currentStep === 3 && state.billData && (
          <VerificationScreen
            billData={state.billData}
            initialRefinement={state.refinement}
            initialSeZone={state.seZone}
            onComplete={handleVerificationComplete}
          />
        )}

        {/* Step 3: ResultOverview — your current situation */}
        {currentStep === 4 && threeScenarios && state.billData && (
          <ResultOverview
            threeScenarios={threeScenarios}
            seZone={state.seZone}
            billData={state.billData}
            assumptions={state.assumptions}
            refinement={state.refinement}
            onContinue={handleViewRecommendations}
            tmyData={tmyData ?? undefined}
          />
        )}

        {/* Step 4: Recommendation results */}
        {currentStep === 5 && state.recommendations && threeScenarios && (
          <RecommendationResults
            recommendations={state.recommendations}
            billData={state.billData!}
            refinement={state.refinement}
            seZone={state.seZone}
            assumptions={state.assumptions}
            tmyData={tmyData ?? undefined}
            onViewDashboard={handleViewDashboard}
            onRestart={handleRestart}
          />
        )}

        {/* Step 5: Dashboard — detailed analysis */}
        {currentStep === 6 && state.billData && (
          <Dashboard
            billData={state.billData}
            refinement={state.refinement}
            answeredQuestions={state.answeredQuestions}
            seZone={state.seZone}
            onSEZoneChange={handleSEZoneChange}
            activeUpgrades={state.activeUpgrades}
            onUpgradeToggle={handleUpgradeToggle}
            selectedDate={state.selectedDate}
            onDateChange={handleDateChange}
            assumptions={state.assumptions}
            onAssumptionsChange={handleAssumptionsChange}
            onBackToRecommendations={handleBackToRecommendations}
            recommendedUpgradeIds={state.recommendations?.recommendations.map((r) => r.upgradeId)}
            tmyData={tmyData ?? undefined}
          />
        )}
      </div>
    </div>
  );
}