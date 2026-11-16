export const asciiTokens = {
  surface: '#14161A',
  surfaceSunk: '#0E1013',
  surfaceRaised: '#1B1E24',
  text: '#ECE8DD',
  muted: '#93968D',
  cobalt: '#2D7FD0',
  cobaltLight: '#8DB9E8',
  cobaltDeep: '#24445F',
  violet: '#8E7CC3',
  oxide: '#E97D4A',
  cream: '#F7D9A8',
} as const

export type AsciiToken = keyof typeof asciiTokens
