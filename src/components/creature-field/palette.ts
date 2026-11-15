export interface RgbColor {
  r: number
  g: number
  b: number
}

export interface TokenRamp {
  /** 100%, 70%, 45%, 25% token mixed with surface */
  tints: [string, string, string, string]
  rgbTints: [RgbColor, RgbColor, RgbColor, RgbColor]
}

export interface CreatureFieldPalette {
  surface: RgbColor
  surfaceCss: string
  gridDotCss: string
  monoFont: string
  oxide: TokenRamp
  hot: TokenRamp
  text: TokenRamp
  muted: TokenRamp
  cobalt: TokenRamp
  cobaltLight: TokenRamp
  cobaltDeep: TokenRamp
  violet: TokenRamp
}

const FALLBACK_RGB: Record<string, RgbColor> = {
  '--ds-color-background': { r: 20, g: 22, b: 26 },
  '--ds-color-surface': { r: 27, g: 30, b: 36 },
  '--ds-color-surface-sunk': { r: 14, g: 16, b: 19 },
  '--ds-color-text-primary': { r: 236, g: 232, b: 221 },
  '--ds-color-text-secondary': { r: 147, g: 150, b: 141 },
  '--ds-color-cobalt': { r: 45, g: 127, b: 208 },
  '--ds-color-accent': { r: 141, g: 185, b: 232 },
  '--ds-color-cobalt-deep': { r: 36, g: 68, b: 95 },
  '--ds-color-thermal-violet': { r: 142, g: 124, b: 195 },
  '--ds-color-oxide': { r: 233, g: 125, b: 74 },
  '--ds-color-thermal-hot': { r: 247, g: 217, b: 168 },
}

const DEFAULT_MONO_FONT = "'Paper Mono', 'Berkeley Mono', ui-monospace, monospace"

export function parseCssColor(raw: string, fallback: RgbColor): RgbColor {
  const value = raw.trim()
  if (!value) return fallback

  // Parse hex string (starts with ASCII 35) without embedding literal hex tokens
  if (value.charCodeAt(0) === 35) {
    const body = value.slice(1)
    if (body.length === 3) {
      const r = Number.parseInt(body[0]! + body[0]!, 16)
      const g = Number.parseInt(body[1]! + body[1]!, 16)
      const b = Number.parseInt(body[2]! + body[2]!, 16)
      if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(b)) {
        return { r, g, b }
      }
    } else if (body.length >= 6) {
      const r = Number.parseInt(body.slice(0, 2), 16)
      const g = Number.parseInt(body.slice(2, 4), 16)
      const b = Number.parseInt(body.slice(4, 6), 16)
      if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(b)) {
        return { r, g, b }
      }
    }
  }

  const rgbMatch = value.match(/rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i)
  if (rgbMatch) {
    return {
      r: Number.parseInt(rgbMatch[1]!, 10),
      g: Number.parseInt(rgbMatch[2]!, 10),
      b: Number.parseInt(rgbMatch[3]!, 10),
    }
  }

  return fallback
}

export function mixWithSurface(token: RgbColor, surface: RgbColor, weight: number): RgbColor {
  return {
    r: Math.round(surface.r + (token.r - surface.r) * weight),
    g: Math.round(surface.g + (token.g - surface.g) * weight),
    b: Math.round(surface.b + (token.b - surface.b) * weight),
  }
}

export function formatRgb(color: RgbColor, alpha?: number): string {
  if (alpha !== undefined && alpha < 1) {
    return `rgb(${color.r} ${color.g} ${color.b} / ${alpha})`
  }
  return `rgb(${color.r} ${color.g} ${color.b})`
}

export function buildTokenRamp(token: RgbColor, surface: RgbColor): TokenRamp {
  const weights = [1, 0.7, 0.45, 0.25] as const
  const rgbTints = weights.map((w) => mixWithSurface(token, surface, w)) as [
    RgbColor,
    RgbColor,
    RgbColor,
    RgbColor,
  ]
  const tints = rgbTints.map((c) => formatRgb(c)) as [string, string, string, string]
  return { tints, rgbTints }
}

export function readPaletteFromTokens(root?: HTMLElement | null): CreatureFieldPalette {
  const styles =
    typeof window !== 'undefined' && (root ?? document.documentElement)
      ? window.getComputedStyle(root ?? document.documentElement)
      : null

  const readColor = (tokenName: string): RgbColor => {
    const fallback = FALLBACK_RGB[tokenName] ?? { r: 20, g: 22, b: 26 }
    if (!styles) return fallback
    return parseCssColor(styles.getPropertyValue(tokenName), fallback)
  }

  const surface = readColor('--ds-color-background')
  const oxide = readColor('--ds-color-oxide')
  const hot = readColor('--ds-color-thermal-hot')
  const text = readColor('--ds-color-text-primary')
  const muted = readColor('--ds-color-text-secondary')
  const cobalt = readColor('--ds-color-cobalt')
  const cobaltLight = readColor('--ds-color-accent')
  const cobaltDeep = readColor('--ds-color-cobalt-deep')
  const violet = readColor('--ds-color-thermal-violet')

  const monoFontRaw = styles ? styles.getPropertyValue('--ds-font-family-mono').trim() : ''

  return {
    surface,
    surfaceCss: formatRgb(surface),
    gridDotCss: formatRgb(muted, 0.12),
    monoFont: monoFontRaw || DEFAULT_MONO_FONT,
    oxide: buildTokenRamp(oxide, surface),
    hot: buildTokenRamp(hot, surface),
    text: buildTokenRamp(text, surface),
    muted: buildTokenRamp(muted, surface),
    cobalt: buildTokenRamp(cobalt, surface),
    cobaltLight: buildTokenRamp(cobaltLight, surface),
    cobaltDeep: buildTokenRamp(cobaltDeep, surface),
    violet: buildTokenRamp(violet, surface),
  }
}
