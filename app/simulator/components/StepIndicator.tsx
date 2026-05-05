"use client";

/**
 * StepIndicator — minimal progress-tråd.
 *
 * Visar bara en tunn grön rand som fylls från vänster mot höger baserat på
 * currentStep / totalSteps. Ingen text, inga numrerade cirklar — användaren
 * får implicit feedback om progress utan att det dominerar UI:t.
 *
 * När föregående steg klickas (på den klickbara overlay-zonen) navigerar
 * onStepClick tillbaka dit. Inte synligt, men funktionalitet bevaras.
 */

interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
  onStepClick?: (step: number) => void;
  /**
   * Optional "start over" handler. When provided, renders a subtle
   * "Börja om"-link next to the "Tillbaka"-button so they don't fight
   * for the same absolute-positioned slot in the page header.
   */
  onRestart?: () => void;
}

const STEP_LABELS = ["Elräkning", "Bekräfta", "Resultat & åtgärder"];

export default function StepIndicator({ currentStep, totalSteps, onStepClick, onRestart }: StepIndicatorProps) {
  // currentStep är 1-indexerat. Visa 0% innan steg 1 är klart, 100% när alla är klara.
  // För 3 steg: steg 1 = 33%, steg 2 = 66%, steg 3 = 100%
  const progressPct = Math.min(100, Math.max(0, (currentStep / totalSteps) * 100));
  const currentLabel = STEP_LABELS[Math.min(currentStep, totalSteps) - 1] ?? "";

  return (
    <div className="relative">
      {/* Tunn progress-tråd */}
      <div className="h-[3px] w-full bg-gray-200/60">
        <div
          className="h-full bg-brand-500 transition-all duration-500 ease-out"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Liten kontextuell etikett — bara namnet på aktuell sida, subtil */}
      <div className="flex items-center justify-between px-4 py-2 sm:px-6">
        <p className="text-xs text-text-muted">
          <span className="text-text-secondary">{currentLabel}</span>
          {currentStep < totalSteps && (
            <span className="text-text-muted/60"> · steg {currentStep} av {totalSteps}</span>
          )}
        </p>

        {/* Höger-sida: "Börja om" (subtil) + "← Tillbaka" som primär. Båda
            är optional så vi kan dölja dem på första steget. */}
        <div className="flex items-center gap-3">
          {onRestart && currentStep > 1 && (
            <button
              type="button"
              onClick={onRestart}
              className="text-[11px] text-text-muted/70 hover:text-text-secondary transition-colors"
              title="Börja om från början"
            >
              Börja om
            </button>
          )}
          {onStepClick && currentStep > 1 && (
            <button
              type="button"
              onClick={() => onStepClick(currentStep - 1)}
              className="text-xs text-text-muted hover:text-text-secondary transition-colors"
              aria-label={`Tillbaka till ${STEP_LABELS[currentStep - 2]}`}
            >
              ← Tillbaka
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
