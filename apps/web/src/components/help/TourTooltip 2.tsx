'use client'

import { useCallback } from 'react'

type TourTooltipProps = {
  title: string
  content: string
  stepIndex: number
  totalSteps: number
  actionLabel: string
  position: 'top' | 'bottom' | 'left' | 'right'
  targetRect: DOMRect | null
  onAdvance: () => void
  onSkip: () => void
}

const TOOLTIP_OFFSET = 12
const TOOLTIP_WIDTH = 340

function computeStyle(
  position: TourTooltipProps['position'],
  rect: DOMRect | null,
): React.CSSProperties {
  if (!rect) {
    return { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
  }

  const base: React.CSSProperties = { position: 'fixed', width: TOOLTIP_WIDTH, zIndex: 10001 }

  switch (position) {
    case 'bottom':
      return {
        ...base,
        top: rect.bottom + TOOLTIP_OFFSET,
        left: rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2,
      }
    case 'top':
      return {
        ...base,
        bottom: window.innerHeight - rect.top + TOOLTIP_OFFSET,
        left: rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2,
      }
    case 'right':
      return {
        ...base,
        top: rect.top + rect.height / 2 - 60,
        left: rect.right + TOOLTIP_OFFSET,
      }
    case 'left':
      return {
        ...base,
        top: rect.top + rect.height / 2 - 60,
        right: window.innerWidth - rect.left + TOOLTIP_OFFSET,
      }
    default:
      return base
  }
}

export function TourTooltip({
  title,
  content,
  stepIndex,
  totalSteps,
  actionLabel,
  position,
  targetRect,
  onAdvance,
  onSkip,
}: TourTooltipProps) {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') onSkip()
      if (e.key === 'Enter') onAdvance()
    },
    [onAdvance, onSkip],
  )

  const style = computeStyle(position, targetRect)

  return (
    <div
      role="dialog"
      aria-label={`Tour-Schritt ${stepIndex + 1} von ${totalSteps}: ${title}`}
      className="rounded-lg border border-gray-200 bg-white p-5 shadow-xl"
      style={style}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      {/* Step indicator dots */}
      <div className="mb-3 flex items-center gap-1.5">
        {Array.from({ length: totalSteps }, (_, i) => (
          <span
            key={i}
            className={`block h-1.5 rounded-full transition-all ${
              i === stepIndex
                ? 'w-4 bg-[var(--brand-primary,#1A56DB)]'
                : i < stepIndex
                  ? 'w-1.5 bg-[var(--brand-primary,#1A56DB)] opacity-40'
                  : 'w-1.5 bg-gray-300'
            }`}
            aria-hidden="true"
          />
        ))}
        <span className="ml-auto text-xs text-[var(--brand-text-secondary,#6B7280)]">
          {stepIndex + 1}/{totalSteps}
        </span>
      </div>

      {/* Title */}
      <h3 className="mb-1.5 text-sm font-semibold text-[var(--brand-text-primary,#111827)]">
        {title}
      </h3>

      {/* Content */}
      <p className="mb-4 text-sm leading-relaxed text-[var(--brand-text-secondary,#6B7280)]">
        {content}
      </p>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onSkip}
          className="text-xs text-[var(--brand-text-secondary,#6B7280)] underline-offset-2 hover:underline"
          aria-label="Tour ueberspringen"
        >
          Ueberspringen
        </button>
        <button
          type="button"
          onClick={onAdvance}
          className="rounded-md bg-[var(--brand-primary,#1A56DB)] px-4 py-1.5 text-sm font-medium text-white transition-colors hover:opacity-90"
          aria-label={actionLabel}
        >
          {actionLabel}
        </button>
      </div>
    </div>
  )
}
