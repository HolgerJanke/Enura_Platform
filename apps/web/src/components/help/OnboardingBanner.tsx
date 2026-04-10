'use client'

import { useState, useCallback } from 'react'
import { GuidedTour } from './GuidedTour'
import { TOUR_REGISTRY, type TourId } from '@/lib/onboarding-tours'

type OnboardingBannerProps = {
  tourId: TourId
  completedSteps: number
  onTourComplete: () => void
  onDismiss: () => void
  onStepChange?: (stepIndex: number) => void
}

export function OnboardingBanner({
  tourId,
  completedSteps,
  onTourComplete,
  onDismiss,
  onStepChange,
}: OnboardingBannerProps) {
  const [isTourActive, setIsTourActive] = useState(false)
  const [isDismissed, setIsDismissed] = useState(false)

  const tourDef = TOUR_REGISTRY[tourId]
  if (!tourDef || isDismissed) return null

  const totalSteps = tourDef.steps.length
  const percentage = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0
  const isComplete = completedSteps >= totalSteps

  if (isComplete) return null

  const handleStartTour = () => {
    setIsTourActive(true)
  }

  const handleTourComplete = () => {
    setIsTourActive(false)
    onTourComplete()
  }

  const handleTourSkip = () => {
    setIsTourActive(false)
  }

  const handleDismiss = () => {
    setIsDismissed(true)
    onDismiss()
  }

  return (
    <>
      {/* Fixed bottom-right banner */}
      <div
        className="fixed bottom-4 right-4 z-[9000] w-80 rounded-lg border border-gray-200 bg-white p-4 shadow-lg"
        role="complementary"
        aria-label="Einfuehrungstour"
      >
        {/* Header with dismiss */}
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-semibold text-[var(--brand-text-primary,#111827)]">
            {tourDef.label}
          </span>
          <button
            type="button"
            onClick={handleDismiss}
            className="text-[var(--brand-text-secondary,#6B7280)] hover:text-[var(--brand-text-primary,#111827)]"
            aria-label="Banner schliessen"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        {/* Progress bar */}
        <div className="mb-2">
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-[var(--brand-primary,#1A56DB)] transition-all duration-500"
              style={{ width: `${percentage}%` }}
              role="progressbar"
              aria-valuenow={percentage}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Tour-Fortschritt: ${percentage}%`}
            />
          </div>
          <p className="mt-1 text-xs text-[var(--brand-text-secondary,#6B7280)]">
            {completedSteps} von {totalSteps} Schritten abgeschlossen ({percentage}%)
          </p>
        </div>

        {/* Action */}
        <button
          type="button"
          onClick={handleStartTour}
          className="w-full rounded-md bg-[var(--brand-primary,#1A56DB)] px-3 py-2 text-sm font-medium text-white transition-colors hover:opacity-90"
        >
          {completedSteps === 0 ? 'Tour starten' : 'Tour fortsetzen'}
        </button>
      </div>

      {/* Tour overlay when active */}
      {isTourActive && (
        <GuidedTour
          tourId={tourId}
          steps={tourDef.steps}
          initialStep={completedSteps}
          onComplete={handleTourComplete}
          onSkip={handleTourSkip}
          onStepChange={onStepChange}
        />
      )}
    </>
  )
}
