export interface RelOptions {
  /** Existing rel value to preserve. */
  existing?: string
  /** The link points to another page that represents me (IndieWeb rel="me"). */
  identity?: boolean
  /** The link opens in a new tab. */
  newTab?: boolean
  /** Alias for newTab when linking to an external destination in a new tab. */
  external?: boolean
}

/** Combines rel tokens without overwriting existing ones. Returns undefined when empty. */
export function buildRel({ existing = '', identity = false, newTab = false, external = false }: RelOptions = {}): string | undefined {
  const tokens = existing.split(/\s+/).filter(Boolean)
  if (identity) tokens.push('me')
  if (newTab || external) tokens.push('noopener', 'noreferrer')
  const unique = [...new Set(tokens)]
  return unique.length > 0 ? unique.join(' ') : undefined
}

/**
 * Resets the browser URL to the root hash route when a page is rendered on a
 * non-root pathname (such as a direct unknown path), while letting React Router
 * handle standard SPA transitions on `/` and `/index.html`.
 */
export function navigateFromNonRootPathname(
  event: { preventDefault(): void },
  targetHash: string,
): void {
  if (typeof window === 'undefined') return
  const { pathname } = window.location
  if (pathname !== '/' && pathname !== '/index.html') {
    event.preventDefault()
    window.location.assign(targetHash.startsWith('/') ? targetHash : `/${targetHash}`)
  }
}
