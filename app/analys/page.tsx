"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import type {
  SimulatorState,
  BillData,
  RefinementAnswers,
  SEZone,
  UpgradeId,
  Assumptions,
} from "../simulator/types";
import { DEFAULT_STATE } from "../simulator/data/defaults";
import { UPGRADE_DEFINITIONS, DEFAULT_ACTIVE_UPGRADES } from "../simulator/data/upgrade-catalog";
import { loadState, saveState, clearState } from "../simulator/storage";
import { generateRecommendations } from "../simulator/recommendations/engine";
import StepIndicator from "../simulator/components/StepIndicator";
import UploadBill from "../simulator/components/UploadBill";
import VerificationScreen from "../simulator/components/VerificationScreen";
import ResultOverview from "../simulator/components/ResultOverview";
import RecommendationResults from "../simulator/components/RecommendationResults";
import Dashboard from "../simulator/components/Dashboard";
import { calculateThreeScenarios } from "../simulator/simulation/scenarios";
import { fetchTmyData } from "../simulator/data/pvgis-tmy";
import type { TmyHourlyData } from "../simulator/data/pvgis-tmy";
import { SE_ZONE_CENTROIDS } from "../simulator/data/geocoding";

const TOTAL_STEPS = 3;

export default function AnalysPage() {
  const router = useRouter();
  // HYDRATION-SAFE: börja alltid med DEFAULT_STATE så server/client matchar.
  // Läs sparad state från localStorage i useEffect efter hydration nedan.
  const [state, setState] = useState<SimulatorState>(DEFAULT_STATE);
  const [hydrated, setHydrated] = useState(false);
  const [tmyData, setTmyData] = useState<TmyHourlyData[] | null>(null);

  // Ladda sparad state efter hydration (klient-only). Om completedStep är 0
  // (användaren har inte börjat ännu) bumpar vi direkt till 1 så analys-flödet
  // startar på UploadBill-steget — landing-sidan ligger nu på / istället.
  useEffect(() => {
    const saved = loadState();
    if (!saved.selectedDate || saved.selectedDate === "2026-03-25") {
      saved.selectedDate = new Date().toISOString().split("T")[0];
    }
    if (saved.completedStep === 0) {
      saved.completedStep = 1;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(saved);
    setHydrated(true);
  }, []);

  // Persist state vid varje ändring (efter hydration)
  useEffect(() => {
    if (!hydrated) return;
    saveState(state);
  }, [state, hydrated]);

  const updateState = useCallback((updates: Partial<SimulatorState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  const currentStep = state.completedStep + 1;

  // Scrolla till toppen vid varje stegbyte
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "auto" });
    }
  }, [currentStep]);

  // TMY-data när billData finns
  useEffect(() => {
    if (!state.billData) return;
    if (tmyData) return;

    let lat = state.billData.latitude;
    let lon = state.billData.longitude;
    if (!lat || !lon) {
      const centroid = SE_ZONE_CENTROIDS[state.seZone];
      lat = centroid.lat;
      lon = centroid.lon;
    }

    let cancelled = false;
    fetchTmyData(lat, lon)
      .then((data) => { if (!cancelled) setTmyData(data); })
      .catch(() => { /* fallback handled in components */ });
    return () => { cancelled = true; };
  }, [state.billData, state.seZone, tmyData]);

  const threeScenarios = useMemo(() => {
    if (!state.billData || !state.recommendations) return null;
    const recommendedIds = state.recommendations.recommendations.map((r) => r.upgradeId);
    return calculateThreeScenarios(state.billData, state.refinement, state.seZone, state.assumptions, recommendedIds, tmyData ?? undefined);
  }, [state.billData, state.refinement, state.seZone, state.assumptions, state.recommendations, tmyData]);

  // Step handlers
  const handleBillComplete = useCallback(
    (billData: BillData) => {
      updateState({ completedStep: 2, billData });
    },
    [updateState]
  );

  const handleVerificationComplete = useCallback(
    (
      seZone: SEZone,
      refinement: RefinementAnswers,
      answeredQuestions: number,
      editedBillData: BillData
    ) => {
      // Use the edited bill data — VerificationScreen lets the user
      // correct AI-extracted fields inline, and downstream consumers
      // (recommendations, comparison, simulation) must see the corrections.
      const billData = editedBillData;

      const updatedAssumptions: Assumptions = {
        ...state.assumptions,
        ...(refinement.solarSizeKw ? { solarSizeKw: refinement.solarSizeKw } : {}),
        ...(refinement.batterySizeKwh ? { batterySizeKwh: refinement.batterySizeKwh } : {}),
      };

      if (billData.natAgare) updatedAssumptions.gridOperator = billData.natAgare;
      if (billData.gridFixedFeeKr !== undefined) updatedAssumptions.gridFixedFeeKr = billData.gridFixedFeeKr;
      if (billData.gridTransferFeeOre !== undefined) updatedAssumptions.gridTransferFeeOre = billData.gridTransferFeeOre;
      if (billData.gridPowerChargeKrPerKw !== undefined) {
        updatedAssumptions.gridPowerChargeKrPerKw = billData.gridPowerChargeKrPerKw;
        updatedAssumptions.gridHasPowerCharge = true;
      }
      if (billData.invoiceMarkupOre !== undefined) updatedAssumptions.elhandelMarkupOre = billData.invoiceMarkupOre;
      if (billData.invoiceMonthlyFeeKr !== undefined) updatedAssumptions.elhandelMonthlyFeeKr = billData.invoiceMonthlyFeeKr;

      const recs = generateRecommendations(billData, refinement, seZone, updatedAssumptions);

      const newUpgrades = { ...DEFAULT_ACTIVE_UPGRADES };
      if (refinement.hasSolar) newUpgrades.solceller = true;
      if (refinement.hasBattery) newUpgrades.batteri = true;
      for (const rec of recs.recommendations) {
        newUpgrades[rec.upgradeId] = true;
        if (rec.upgradeId === "solceller") newUpgrades.batteri = true;
      }

      updateState({
        completedStep: 3,
        seZone,
        refinement,
        answeredQuestions,
        // Persist the corrected bill data so re-runs use the edits.
        billData,
        recommendations: recs,
        activeUpgrades: newUpgrades,
        assumptions: updatedAssumptions,
      });
    },
    [state.assumptions, updateState]
  );

  const handleViewRecommendations = useCallback(() => {
    updateState({ completedStep: 5 });
  }, [updateState]);

  const handleViewDashboard = useCallback(() => {
    updateState({ completedStep: 5 });
  }, [updateState]);

  const handleBackToRecommendations = useCallback(() => {
    updateState({ completedStep: 3 });
  }, [updateState]);

  const handleSEZoneChange = useCallback(
    (zone: SEZone) => updateState({ seZone: zone }),
    [updateState]
  );

  const handleUpgradeToggle = useCallback((id: UpgradeId) => {
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
      } else if (id === "solceller") {
        newUpgrades.batteri = false;
      }

      return { ...prev, activeUpgrades: newUpgrades };
    });
  }, []);

  const handleDateChange = useCallback(
    (date: string) => updateState({ selectedDate: date }),
    [updateState]
  );

  const handleAssumptionsChange = useCallback(
    (assumptions: Assumptions) => updateState({ assumptions }),
    [updateState]
  );

  const handleStepClick = useCallback(
    (step: number) => updateState({ completedStep: step }),
    [updateState]
  );

  // "Börja om" — rensa state och gå tillbaka till landingssidan
  const handleRestart = useCallback(() => {
    clearState();
    setState({
      ...DEFAULT_STATE,
      selectedDate: new Date().toISOString().split("T")[0],
    });
    router.push("/");
  }, [router]);

  if (!hydrated) {
    // Render-tom medan vi hydrar localStorage — undviker flicker
    return <div className="bg-gradient-main relative min-h-screen pb-12" />;
  }

  return (
    <div className="bg-gradient-main relative min-h-screen pb-12">
      {/* Step indicator — minimal progress-tråd. "Börja om" och
          "← Tillbaka" lever båda inuti StepIndicator nu så de inte
          slåss om samma absolut-positionerade slot. */}
      <div className="relative z-10 bg-white/80">
        <StepIndicator
          currentStep={Math.min(currentStep, TOTAL_STEPS)}
          totalSteps={TOTAL_STEPS}
          onStepClick={handleStepClick}
          onRestart={handleRestart}
        />
      </div>

      <div className="relative z-10 mx-auto max-w-2xl pt-8">
        {/* Step 1: Upload bill */}
        {currentStep === 2 && (
          <UploadBill
            onComplete={handleBillComplete}
            initialData={state.billData}
          />
        )}

        {/* Step 2: Bekräfta + hus */}
        {currentStep === 3 && state.billData && (
          <VerificationScreen
            billData={state.billData}
            initialRefinement={state.refinement}
            initialSeZone={state.seZone}
            onComplete={handleVerificationComplete}
          />
        )}

        {/* Step 3: ResultOverview */}
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
