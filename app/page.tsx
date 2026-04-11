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

const TOTAL_STEPS = 4;

export default function Home() {
  const [state, setState] = useState<SimulatorState>(DEFAULT_STATE);
  const [loaded, setLoaded] = useState(false);
  const [tmyData, setTmyData] = useState<TmyHourlyData[] | null>(null);
  const [tmyLoading, setTmyLoading] = useState(false);

  // Load state from localStorage on mount
  useEffect(() => {
    const saved = loadState();
    if (!saved.selectedDate || saved.selectedDate === "2026-03-25") {
      saved.selectedDate = new Date().toISOString().split("T")[0];
    }
    setState(saved);
    setLoaded(true);
  }, []);

  // Persist state on every change (after initial load)
  useEffect(() => {
    if (loaded) {
      saveState(state);
    }
  }, [state, loaded]);

  const updateState = useCallback((updates: Partial<SimulatorState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  const currentStep = state.completedStep + 1;

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
    setTmyLoading(true);

    fetchTmyData(lat, lon)
      .then((data) => {
        if (!cancelled) {
          setTmyData(data);
          console.log(`[PAGE] TMY data loaded: ${data.length} hours`);
        }
      })
      .catch((err) => {
        console.warn("[PAGE] Failed to fetch TMY data, falling back to legacy:", err);
      })
      .finally(() => {
        if (!cancelled) setTmyLoading(false);
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

  const handleViewRecommendations = useCallback(() => {
    updateState({ completedStep: 4 });
  }, [updateState]);

  const handleViewDashboard = useCallback(() => {
    updateState({ completedStep: 5 });
  }, [updateState]);

  const handleBackToRecommendations = useCallback(() => {
    updateState({ completedStep: 4 });
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
    // Step indicator shows steps 1-4, which map to completedStep values:
    // Step 1 (Elräkning)       → completedStep 1 → currentStep 2
    // Step 2 (Bekräfta)        → completedStep 2 → currentStep 3
    // Step 3 (Resultat)        → completedStep 3 → currentStep 4
    // Step 4 (Rekommendation)  → completedStep 4 → currentStep 5
    // Dashboard (beyond indicator) → completedStep 5 → currentStep 6
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

  if (!loaded) {
    return (
      <div className="bg-gradient-main flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-brand-400/30 border-t-brand-400 animate-spin-slow" />
      </div>
    );
  }

  return (
    <div className="bg-gradient-main relative min-h-screen pb-12">
      <div className="glow-teal" />
      <div className="glow-warm" />

      {/* Step indicator (hidden on landing) */}
      {currentStep > 1 && (
        <div className="relative z-10 border-b border-white/10 bg-slate-900/40 backdrop-blur-md">
          <div className="mx-auto flex max-w-2xl items-center justify-between">
            <StepIndicator currentStep={Math.min(currentStep, TOTAL_STEPS)} totalSteps={TOTAL_STEPS} onStepClick={handleStepClick} />
            <button
              onClick={handleRestart}
              className="mr-4 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-400 transition-colors hover:bg-white/10 hover:text-slate-200"
              title="Börja om från början"
            >
              Börja om
            </button>
          </div>
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