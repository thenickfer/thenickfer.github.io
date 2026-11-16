import { Link, useLocation } from 'react-router-dom'

import { AsciiBackground } from '../components/ascii-background/AsciiBackground'
import { StarMark } from '../components/StarMark'
import { siteContent } from '../content/site'
import { navigateFromNonRootPathname } from '../lib/links'
import '../styles/ascii-background.css'
import '../styles/routes-404-links.css'
import { useState } from 'react'
import { ASCII_SCENERY_IDS } from '../components/ascii-background/config'

export interface NotFoundPageProps {
  /** Optional explicit missing path override for testing or direct embeds. */
  requestedPath?: string
}

function resolveRequestedPath(explicitPath?: string, routerPathname?: string, routerSearch?: string): string {
  if (explicitPath && explicitPath.trim().length > 0) {
    return explicitPath.trim()
  }

  if (routerSearch) {
    const params = new URLSearchParams(routerSearch)
    const fromQuery = params.get('path')
    if (fromQuery && fromQuery.trim().length > 0) {
      return fromQuery.trim()
    }
  }

  if (typeof window !== 'undefined') {
    const searchParams = new URLSearchParams(window.location.search)
    const fromWindowSearch = searchParams.get('path')
    if (fromWindowSearch && fromWindowSearch.trim().length > 0) {
      return fromWindowSearch.trim()
    }

    const hash = window.location.hash
    const qIdx = hash.indexOf('?')
    if (qIdx !== -1) {
      const hashParams = new URLSearchParams(hash.slice(qIdx + 1))
      const fromHashQuery = hashParams.get('path')
      if (fromHashQuery && fromHashQuery.trim().length > 0) {
        return fromHashQuery.trim()
      }
    }
  }

  if (routerPathname && routerPathname !== '/404' && routerPathname !== '/') {
    return routerPathname
  }

  if (typeof window !== 'undefined') {
    const pathname = window.location.pathname
    if (pathname && pathname !== '/' && pathname !== '/index.html' && pathname !== '/404.html') {
      return pathname
    }
  }

  return '/404'
}

export function NotFoundPage({ requestedPath }: NotFoundPageProps) {
  const location = useLocation()
  const missingPath = resolveRequestedPath(requestedPath, location.pathname, location.search)
  const [asciiPiece] = useState(() => {
    const randomIndex = Math.floor(Math.random() * ASCII_SCENERY_IDS.length)
    return ASCII_SCENERY_IDS[randomIndex]
  })

  return (
    <div className="page-grid not-found-shell" data-testid="not-found-page">
      <AsciiBackground piece={asciiPiece} />

      <header className="not-found-header">
        <Link
          className="cobalt-brand-link"
          to="/"
          aria-label="Return to main page"
          onClick={(event) => navigateFromNonRootPathname(event, '#/')}
        >
          <StarMark className="h-4 w-4 text-accent" />
          <span>{siteContent.profile.name}</span>
        </Link>
        <Link
          className="cobalt-secondary-action"
          to="/links"
          onClick={(event) => navigateFromNonRootPathname(event, '#/links')}
        >
          All links
        </Link>
      </header>

      <main className="not-found-main my-auto py-8">
        <section aria-labelledby="not-found-heading" className="plate not-found-card motion-enter">
          <div className="not-found-stamp-row">
            <span className="not-found-stamp">
              <StarMark className="h-3.5 w-3.5 text-oxide" />
              <span>STATUS 404</span>
            </span>
            <span className="font-mono text-xs uppercase tracking-[0.14em] text-text-secondary">
              Route not found
            </span>
          </div>

          <p className="not-found-code" aria-hidden="true">
            404
          </p>

          <h1 id="not-found-heading" className="not-found-title">
            Page not found
          </h1>

          <p className="not-found-description">
            The requested address does not match any page on this site. Check the URL or return to the main page.
          </p>

          <div className="not-found-path-box" aria-label="Requested path">
            <span className="text-accent">path:</span>{' '}
            <code data-testid="not-found-requested-path">{missingPath}</code>
          </div>

          <div className="not-found-actions">
            <Link
              className="cobalt-primary-action"
              to="/"
              data-testid="not-found-home-link"
              onClick={(event) => navigateFromNonRootPathname(event, '#/')}
            >
              <span aria-hidden="true">←</span>
              <span>Back to main page</span>
            </Link>
            <Link
              className="cobalt-secondary-action"
              to="/links"
              data-testid="not-found-links-link"
              onClick={(event) => navigateFromNonRootPathname(event, '#/links')}
            >
              <span>Personal links</span>
            </Link>
          </div>
        </section>
      </main>

      <footer className="cobalt-route-footer">
        <span>© {new Date().getFullYear()} {siteContent.profile.name}</span>
      </footer>
    </div>
  )
}

export default NotFoundPage
