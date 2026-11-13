export const designTokens = {
  colors: {
    background: 'var(--ds-color-background)',
    surface: 'var(--ds-color-surface)',
    textPrimary: 'var(--ds-color-text-primary)',
    textSecondary: 'var(--ds-color-text-secondary)',
    accent: 'var(--ds-color-accent)',
    border: 'var(--ds-color-border)',
  },
  typography: {
    fontFamilyPrimary: 'var(--ds-font-family-primary)',
    fontFamilyMono: 'var(--ds-font-family-mono)',
    fontSize: {
      xs: 'var(--ds-font-size-xs)',
      sm: 'var(--ds-font-size-sm)',
      md: 'var(--ds-font-size-md)',
      lg: 'var(--ds-font-size-lg)',
      xl: 'var(--ds-font-size-xl)',
    },
    fontWeight: {
      regular: 'var(--ds-font-weight-regular)',
      medium: 'var(--ds-font-weight-medium)',
      semibold: 'var(--ds-font-weight-semibold)',
    },
    lineHeight: {
      tight: 'var(--ds-line-height-tight)',
      normal: 'var(--ds-line-height-normal)',
      relaxed: 'var(--ds-line-height-relaxed)',
    },
  },
  spacing: {
    1: 'var(--ds-spacing-1)',
    2: 'var(--ds-spacing-2)',
    3: 'var(--ds-spacing-3)',
    4: 'var(--ds-spacing-4)',
    6: 'var(--ds-spacing-6)',
    8: 'var(--ds-spacing-8)',
  },
  radii: {
    sm: 'var(--ds-radius-sm)',
    md: 'var(--ds-radius-md)',
    lg: 'var(--ds-radius-lg)',
  },
  borders: {
    defaultWidth: 'var(--ds-border-width-default)',
    strongWidth: 'var(--ds-border-width-strong)',
  },
  shadows: {
    sm: 'var(--ds-shadow-sm)',
    md: 'var(--ds-shadow-md)',
  },
  layout: {
    contentMaxWidth: 'var(--ds-content-max-width)',
  },
  transitions: {
    fastDuration: 'var(--ds-transition-duration-fast)',
    baseDuration: 'var(--ds-transition-duration-base)',
    standardEasing: 'var(--ds-transition-easing-standard)',
  },
  zIndex: {
    base: 'var(--ds-z-index-base)',
    dropdown: 'var(--ds-z-index-dropdown)',
    overlay: 'var(--ds-z-index-overlay)',
    modal: 'var(--ds-z-index-modal)',
  },
} as const

export type DesignTokens = typeof designTokens
