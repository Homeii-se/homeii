"use client";

import { useEffect, useState } from "react";
import { STRINGS } from "../data/strings";

interface ProcessingAnimationProps {
  onComplete: () => void;
}

const STEPS = [
  "Läser in dokument...",
  "Identifierar förbrukningsdata...",
  "Analyserar mönster...",
  "Beräknar nyckeltal...",
  "Förbereder simulering...",
];

export default function ProcessingAnimation({ onComplete }: ProcessingAnimationProps) {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev >= STEPS.length - 1) {
          clearInterval(timer);
          setTimeout(onComplete, 600);
          return prev;
        }
        return prev + 1;
      });
    }, 800);
    return () => clearInterval(timer);
  }, [onComplete]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 animate-fade-in">
      {/* Scanning animation */}
      <div className="relative mb-8 h-32 w-24 rounded-lg border-2 border-brand-400/40 bg-brand-500/10">
        <div
          className="absolute left-0 h-0.5 w-full bg-brand-500 animate-scan-line"
          style={{ boxShadow: "0 0 8px 2px rgba(59, 130, 246, 0.4)" }}
        />
        {/* Fake text lines */}
        <div className="flex flex-col gap-2 p-3 pt-4">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="h-1.5 rounded-full bg-brand-400/30 animate-pulse-slow"
              style={{
                width: `${60 + Math.random() * 30}%`,
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
        {STEPS.map((step, i) => (
          <div
            key={i}
            className={`flex items-center gap-3 text-sm transition-all duration-300 ${
              i <= currentStep ? "text-text-primary" : "text-text-muted"
            }`}
          >
            {i < currentStep ? (
              <svg className="h-5 w-5 text-energy-green shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            ) : i === currentStep ? (
              <div className="h-5 w-5 shrink-0 rounded-full border-2 border-brand-500 border-t-transparent animate-spin-slow" />
            ) : (
              <div className="h-5 w-5 shrink-0 rounded-full border-2 border-border" />
            )}
            {step}
          </div>
        ))}
      </div>
    </div>
  );
}