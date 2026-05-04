"use client";

import { useEffect, useState } from "react";
import { STRINGS } from "../data/strings";

interface ProcessingAnimationProps {
  onComplete: () => void;
  /**
   * Signal that the underlying API call has finished. When provided as
   * `false`, the last step's spinner stays visible until this flips to
   * `true` — preventing the animation from "completing" while the user
   * is still waiting on the server.
   *
   * Defaults to `undefined` which preserves the original timer-driven
   * completion behavior for any caller that does not pass the prop.
   */
  apiCompleted?: boolean;
}

const STEPS = [
  "Läser in dokument...",
  "Identifierar förbrukningsdata...",
  "Analyserar mönster...",
  "Beräknar nyckeltal...",
  "Förbereder simulering...",
];

export default function ProcessingAnimation({
  onComplete,
  apiCompleted,
}: ProcessingAnimationProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [timerDone, setTimerDone] = useState(false);
  const lineWidths = ["64%", "78%", "72%", "86%", "69%", "81%"];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev >= STEPS.length - 1) {
          clearInterval(timer);
          setTimerDone(true);
          return prev;
        }
        return prev + 1;
      });
    }, 800);
    return () => clearInterval(timer);
  }, []);

  // Trigger onComplete when the timer is done AND the API has completed.
  // If `apiCompleted` is undefined (legacy callers), behave exactly as
  // before — fire onComplete 600 ms after the timer finishes.
  useEffect(() => {
    if (!timerDone) return;
    const apiReady = apiCompleted !== false;
    if (!apiReady) return;
    const t = setTimeout(onComplete, 600);
    return () => clearTimeout(t);
  }, [timerDone, apiCompleted, onComplete]);

  // Last step shows checkmark only once timer reached the end AND the
  // API has reported completion. Until then it keeps spinning so the
  // user sees the work is still in progress.
  const lastStepResolved = timerDone && apiCompleted !== false;

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 animate-fade-in">
      {/* Scanning animation */}
      <div className="relative mb-8 h-32 w-24 rounded-lg border-2 border-brand-500/30 bg-brand-50">
        <div
          className="absolute left-0 h-0.5 w-full bg-brand-500 animate-scan-line"
          style={{ boxShadow: "0 0 8px 2px rgba(46, 125, 82, 0.3)" }}
        />
        {/* Fake text lines */}
        <div className="flex flex-col gap-2 p-3 pt-4">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="h-1.5 rounded-full bg-brand-200 animate-pulse-slow"
              style={{
                width: lineWidths[i],
                animationDelay: `${i * 200}ms`,
              }}
            />
          ))}
        </div>
      </div>

      <h2 className="mb-6 text-xl font-semibold text-text-primary">
        {STRINGS.processingTitle}
      </h2>

      {/* Step progress */}
      <div className="flex flex-col gap-3 w-full max-w-xs">
        {STEPS.map((step, i) => {
          const isLast = i === STEPS.length - 1;
          const isDone = i < currentStep || (i === currentStep && isLast && lastStepResolved);
          const isActive = i === currentStep && !isDone;
          return (
            <div
              key={i}
              className={`flex items-center gap-3 text-sm transition-all duration-300 ${
                i <= currentStep ? "text-text-primary" : "text-text-muted"
              }`}
            >
              {isDone ? (
                <svg className="h-5 w-5 text-energy-green shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              ) : isActive ? (
                <div className="h-5 w-5 shrink-0 rounded-full border-2 border-brand-500 border-t-transparent animate-spin-slow" />
              ) : (
                <div className="h-5 w-5 shrink-0 rounded-full border-2 border-gray-300" />
              )}
              {step}
            </div>
          );
        })}
      </div>
    </div>
  );
}
