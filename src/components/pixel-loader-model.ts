import { createElement, useEffect, useState } from 'react'

import { nestedRadius } from '../styles/tokens.ts'
import { useReducedMotion } from './creature-field/useReducedMotion.ts'

export type PixelLoaderVariant =
  | 'page'
  | 'full-page'
  | 'section'
  | 'component'
  | 'inline'
  | 'button'

export type NormalizedPixelLoaderVariant = 'page' | 'section' | 'inline' | 'button'

export type PixelLoaderSize = 'sm' | 'md' | 'lg'

export type PixelLoaderState = 'loading' | 'finished'

export interface PixelLoaderProps {
  variant?: PixelLoaderVariant
  size?: PixelLoaderSize
  label?: string
  showLabel?: boolean
  delayMs?: number
  state?: PixelLoaderState
  active?: boolean
  reducedMotion?: boolean
  ariaLive?: 'polite' | 'assertive' | 'off'
  className?: string
  testId?: string
}

export const MAX_PIXEL_LABEL_LENGTH = 24

/**
 * 5x5 pixel-star silhouette (COBALT_LAB.md "Star"):
 * Four needle tips on the axes, concave waist on diagonals, thermal center core.
 * Numbers represent the thermal ring tier (0 = hot center .. 3 = cobalt needle tips).
 */
export const PIXEL_STAR_5X5: readonly (readonly (number | null)[])[] = [
  [null, null, 3, null, null],
  [null, 2, 1, 2, null],
  [3, 1, 0, 1, 3],
  [null, 2, 1, 2, null],
  [null, null, 3, null, null],
] as const

/**
 * 7x7 pixel-star silhouette (COBALT_LAB.md "Star"):
 * Four needle tips on the axes, concave waist (~40% of R), thermal center core.
 * Numbers represent the thermal ring tier (0 = hot center .. 4 = outer needle tips).
 */
export const PIXEL_STAR_7X7: readonly (readonly (number | null)[])[] = [
  [null, null, null, 4, null, null, null],
  [null, null, null, 3, null, null, null],
  [null, null, 2, 1, 2, null, null],
  [4, 3, 1, 0, 1, 3, 4],
  [null, null, 2, 1, 2, null, null],
  [null, null, null, 3, null, null, null],
  [null, null, null, 4, null, null, null],
] as const

/**
 * 3-cell horizontal button loader (COBALT_LAB.md "Components": "3-cell loader inside buttons").
 */
export const PIXEL_BUTTON_3X1: readonly number[] = [3, 1, 0] as const

export function normalizePixelLoaderVariant(
  variant: PixelLoaderVariant = 'section',
): NormalizedPixelLoaderVariant {
  switch (variant) {
    case 'page':
    case 'full-page':
      return 'page'
    case 'section':
    case 'component':
      return 'section'
    case 'inline':
      return 'inline'
    case 'button':
      return 'button'
  }
}

export function resolvePixelLoaderSize(
  variant: NormalizedPixelLoaderVariant,
  size?: PixelLoaderSize,
): PixelLoaderSize {
  if (size) return size
  switch (variant) {
    case 'page':
      return 'lg'
    case 'section':
      return 'md'
    case 'inline':
    case 'button':
      return 'sm'
  }
}

export function resolveShowLabel(
  variant: NormalizedPixelLoaderVariant,
  showLabel?: boolean,
): boolean {
  if (typeof showLabel === 'boolean') return showLabel
  return variant === 'page' || variant === 'section'
}

/**
 * Formats loader labels for the Silkscreen pixel font rule in COBALT_LAB.md:
 * Uppercase, 24 characters or fewer.
 */
export function formatPixelLoaderLabel(label: string): string {
  const normalized = label.trim().replace(/\s+/g, ' ').toUpperCase()
  const fallback = normalized.length > 0 ? normalized : 'LOADING'
  return fallback.slice(0, MAX_PIXEL_LABEL_LENGTH)
}

/**
 * Pure helper evaluating whether a loader should render given `active`, `delayMs`, and elapsed time.
 */
export function shouldRenderDelayedLoader(
  active: boolean,
  delayMs: number,
  elapsedMs: number,
): boolean {
  if (!active) return false
  if (delayMs <= 0) return true
  return elapsedMs >= delayMs
}

export function PixelLoader({
  variant = 'section',
  size,
  label = 'Loading',
  showLabel,
  delayMs = 0,
  state = 'loading',
  active = true,
  reducedMotion: reducedMotionOverride,
  ariaLive = 'polite',
  className = '',
  testId = 'pixel-loader',
}: PixelLoaderProps) {
  const envReducedMotion = useReducedMotion()
  const isReducedMotion = reducedMotionOverride ?? envReducedMotion
  const normalizedDelay = Math.max(0, Math.floor(delayMs))
  const delayCycleKey = `${active ? '1' : '0'}:${normalizedDelay}`

  const [completedDelayKey, setCompletedDelayKey] = useState<string | null>(null)

  useEffect(() => {
    if (!active || normalizedDelay === 0) {
      return
    }
    const timer = setTimeout(() => {
      setCompletedDelayKey(delayCycleKey)
    }, normalizedDelay)
    return () => {
      clearTimeout(timer)
    }
  }, [active, normalizedDelay, delayCycleKey])

  const delayElapsed = normalizedDelay === 0 || completedDelayKey === delayCycleKey

  if (!active || !delayElapsed) {
    return null
  }

  const normalizedVariant = normalizePixelLoaderVariant(variant)
  const resolvedSize = resolvePixelLoaderSize(normalizedVariant, size)
  const shouldDisplayLabel = resolveShowLabel(normalizedVariant, showLabel)
  const accessibleLabel = label.trim().length > 0 ? label.trim() : 'Loading'
  const visiblePixelLabel = formatPixelLoaderLabel(accessibleLabel)

  // Inner radius = max(outerRadius - padding, 0); < 2px uses square corners (0px).
  const plateOuterRadiusPx = 8
  const platePaddingPx = normalizedVariant === 'page' ? 24 : 16
  const computedInnerRadius = nestedRadius(plateOuterRadiusPx, platePaddingPx)
  const gridRadiusPx = computedInnerRadius < 2 ? 0 : computedInnerRadius

  const useButtonCells = normalizedVariant === 'button'
  const use5x5Star = !useButtonCells && (normalizedVariant === 'inline' || resolvedSize === 'sm')
  const starMatrix = use5x5Star ? PIXEL_STAR_5X5 : PIXEL_STAR_7X7

  const gridClassName = useButtonCells
    ? 'pixel-loader__grid pixel-loader__grid--button'
    : use5x5Star
      ? 'pixel-loader__grid pixel-loader__grid--5'
      : 'pixel-loader__grid pixel-loader__grid--7'

  const cellElements = useButtonCells
    ? PIXEL_BUTTON_3X1.map((tier, idx) =>
        createElement('span', {
          key: `btn-cell-${idx}`,
          'aria-hidden': 'true',
          'data-cell-active': 'true',
          'data-cell-tier': String(tier),
          className: `pixel-loader__cell pixel-loader__cell--active pixel-loader__cell--tier-${tier} pixel-loader__cell--step-${idx}`,
        }),
      )
    : starMatrix.flatMap((row, rIdx) =>
        row.map((tier, cIdx) => {
          const isActive = tier !== null
          return createElement('span', {
            key: `star-cell-${rIdx}-${cIdx}`,
            'aria-hidden': 'true',
            'data-cell-active': isActive ? 'true' : 'false',
            'data-cell-tier': isActive ? String(tier) : undefined,
            className: isActive
              ? `pixel-loader__cell pixel-loader__cell--active pixel-loader__cell--tier-${tier}`
              : 'pixel-loader__cell',
          })
        }),
      )

  const gridElement = createElement(
    'span',
    {
      'aria-hidden': 'true',
      className: gridClassName,
      style: { borderRadius: `${gridRadiusPx}px` },
    },
    ...cellElements,
  )

  const srLabelElement = createElement(
    'span',
    { className: 'sr-only' },
    accessibleLabel,
  )

  const visibleLabelElement = shouldDisplayLabel
    ? createElement(
        'span',
        {
          'aria-hidden': 'true',
          className: 'pixel-loader__label',
        },
        visiblePixelLabel,
      )
    : null

  const usesPlate = normalizedVariant === 'page' || normalizedVariant === 'section'
  const rootClasses = [
    'pixel-loader',
    `pixel-loader--${normalizedVariant}`,
    `pixel-loader--size-${resolvedSize}`,
    state === 'finished' ? 'pixel-loader--finished' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return createElement(
    'div',
    {
      role: 'status',
      'aria-live': ariaLive,
      'aria-busy': state === 'loading' ? 'true' : 'false',
      'data-testid': testId,
      'data-pixel-loader': 'true',
      'data-variant': normalizedVariant,
      'data-size': resolvedSize,
      'data-state': state,
      'data-reduced-motion': isReducedMotion ? 'true' : 'false',
      className: rootClasses,
    },
    srLabelElement,
    usesPlate
      ? createElement(
          'div',
          { className: 'pixel-loader__plate' },
          gridElement,
          visibleLabelElement,
        )
      : gridElement,
    !usesPlate ? visibleLabelElement : null,
  )
}
