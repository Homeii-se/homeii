"use client";

const STEP_LABELS = ["Elräkning", "Bekräfta", "Resultat", "Rekommendation"];

interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
  onStepClick?: (step: number) => void;
}

export default function StepIndicator({ currentStep, totalSteps, onStepClick }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-center gap-2 py-4">
      {Array.from({ length: totalSteps }, (_, i) => {
        const step = i + 1;
        const isActive = step === currentStep;
        const isCompleted = step < currentStep;
        const isClickable = isCompleted && onStepClick;

        return (
          <div key={step} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => isClickable && onStepClick(step)}
              disabled={!isClickable}
              className="flex flex-col items-center gap-0.5 bg-transparent border-none p-0 disabled:cursor-default"
            >
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-all duration-300 ${
                  isActive
                    ? "bg-brand-500 text-white scale-110 shadow-md"
                    : isCompleted
                    ? "bg-energy-green text-white hover:bg-energy-green/80 cursor-pointer"
                    : "bg-gray-200 text-text-muted"
                }`}
              >
                {isCompleted ? (
                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  step
                )}
              </div>
              <span className={`text-[10px] hidden sm:block ${isClickable ? "text-text-secondary hover:text-text-primary cursor-pointer" : "text-text-muted"}`}>
                {STEP_LABELS[i]}
              </span>
            </button>
            {step < totalSteps && (
              <div
                className={`h-0.5 w-6 transition-colors duration-300 ${
                  isCompleted ? "bg-energy-green" : "bg-gray-200"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
