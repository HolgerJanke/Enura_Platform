'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { TourTooltip } from './TourTooltip'

export type TourStep = {
  id: string
  targetId: string
  position: 'top' | 'bottom' | 'left' | 'right'
  title: string
  content: string
  actionLabel: string
  action?: () => void
  waitFor?: string
}

type GuidedTourProps = {
  steps: TourStep[]
  tourId: string
  onComplete: () => void
  onSkip: () => void
  onStepChange?: (stepIndex: number) => void
  initialStep?: number
}

const CUTOUT_PADDING = 8

function createOverlayClipPath(rect: DOMRect | null): string {
  if (!rect) return 'none'

  const x = rect.left - CUTOUT_PADDING
  const y = rect.top - CUTOUT_PADDING
  const w = rect.width + CUTOUT_PADDING * 2
  const h = rect.height + CUTOUT_PADDING * 2
  const r = 8

  // SVG-style clip path with rounded cutout using polygon + evenodd
  // We create an outer rectangle (viewport) and an inner rounded rectangle (cutout)
  return `polygon(
    evenodd,
    0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%,
    ${x + r}px ${y}px,
    ${x + w - r}px ${y}px,
    ${x + w}px ${y + r}px,
    ${x + w}px ${y + h - r}px,
    ${x + w - r}px ${y + h}px,
    ${x + r}px ${y + h}px,
    ${x}px ${y + h - r}px,
    ${x}px ${y + r}px,
    ${x + r}px ${y}px
  )`
}

export function GuidedTour({
  steps,
  tourId,
  onComplete,
  onSkip,
  onStepChange,
  initialStep = 0,
}: GuidedTourProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(initialStep)
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
  const [isWaiting, setIsWaiting] = useState(false)
  const observerRef = useRef<MutationObserver | null>(null)
  const animationFrameRef = useRef<number>(0)

  const currentStep = steps[currentStepIndex]

  // Track target element position
  const updateTargetRect = useCallback(() => {
    if (!currentStep) return
    const el = document.getElementById(currentStep.targetId)
    if (el) {
      const rect = el.getBoundingClientRect()
      setTargetRect(rect)

      // Scroll target into view if needed
      const inView =
        rect.top >= 0 &&
        rect.bottom <= window.innerHeight &&
        rect.left >= 0 &&
        rect.right <= window.innerWidth

      if (!inView) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    } else {
      setTargetRect(null)
    }
  }, [currentStep])

  // Observe DOM for target element appearance and position changes
  useEffect(() => {
    if (!currentStep) return

    updateTargetRect()

    // Re-measure on scroll and resize
    const handleReposition = () => {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = requestAnimationFrame(updateTargetRect)
    }

    window.addEventListener('scroll', handleReposition, true)
    window.addEventListener('resize', handleReposition)

    // MutationObserver for DOM changes (e.g. waitFor elements appearing)
    observerRef.current = new MutationObserver(() => {
      updateTargetRect()

      if (isWaiting && currentStep.waitFor) {
        const waitEl = document.getElementById(currentStep.waitFor)
        if (waitEl) {
          setIsWaiting(false)
          advanceStep()
        }
      }
    })

    observerRef.current.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['id', 'class', 'style'],
    })

    return () => {
      window.removeEventListener('scroll', handleReposition, true)
      window.removeEventListener('resize', handleReposition)
      cancelAnimationFrame(animationFrameRef.current)
      observerRef.current?.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStepIndex, currentStep, isWaiting, updateTargetRect])

  const advanceStep = useCallback(() => {
    const nextIndex = currentStepIndex + 1

    if (nextIndex >= steps.length) {
      onComplete()
      return
    }

    setCurrentStepIndex(nextIndex)
    onStepChange?.(nextIndex)
  }, [currentStepIndex, steps.length, onComplete, onStepChange])

  const handleAdvance = useCallback(() => {
    if (!currentStep) return

    // Execute step action if defined
    if (currentStep.action) {
      currentStep.action()
    }

    // If this step has a waitFor, enter waiting mode
    if (currentStep.waitFor) {
      const waitEl = document.getElementById(currentStep.waitFor)
      if (!waitEl) {
        setIsWaiting(true)
        return
      }
    }

    advanceStep()
  }, [currentStep, advanceStep])

  const handleSkip = useCallback(() => {
    observerRef.current?.disconnect()
    onSkip()
  }, [onSkip])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleSkip()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleSkip])

  if (!currentStep) return null

  const clipPath = createOverlayClipPath(targetRect)

  return (
    <div aria-live="polite" data-tour-id={tourId}>
      {/* Dark overlay with cutout */}
      <div
        className="fixed inset-0 z-[10000] bg-black/60 transition-all duration-300"
        style={{ clipPath }}
        aria-hidden="true"
        onClick={handleSkip}
      />

      {/* Tooltip */}
      <TourTooltip
        title={currentStep.title}
        content={currentStep.content}
        stepIndex={currentStepIndex}
        totalSteps={steps.length}
        actionLabel={isWaiting ? 'Warte...' : currentStep.actionLabel}
        position={currentStep.position}
        targetRect={targetRect}
        onAdvance={handleAdvance}
        onSkip={handleSkip}
      />
    </div>
  )
}
