import { useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'

import { CreatureField } from '../components/creature-field'
import { StarMark } from '../components/StarMark'
import { siteContent } from '../content/site'
import { LINKS_AVOID_SELECTOR, personalLinks, type LinkEntry } from '../data/links'
import { buildRel, navigateFromNonRootPathname } from '../lib/links'
import '../styles/routes-404-links.css'

export interface LinksPageProps {
  /** Optional custom link entries (defaults to `personalLinks` from `src/data/links.ts`). */
  entries?: readonly LinkEntry[]
}

function isExternalHttpUrl(href: string): boolean {
  return /^https?:\/\//i.test(href)
}

function getIndicatorSymbol(href: string): string {
  if (isExternalHttpUrl(href)) return '↗'
  if (href.startsWith('mailto:')) return '✉'
  return '→'
}

export function LinksPage({ entries = personalLinks }: LinksPageProps) {
  const headerPlateRef = useRef<HTMLElement | null>(null)
  const stackPlateRef = useRef<HTMLElement | null>(null)
  const avoidRefs = useMemo(() => [headerPlateRef, stackPlateRef], [])

  return (
    <div className="links-page-shell" data-testid="links-page">
      <CreatureField
        fixed
        avoid={avoidRefs}
        avoidSelector={LINKS_AVOID_SELECTOR}
      />

      <header className="links-header-bar" data-links-avoid="" data-creature-ignore="">
        <Link
          className="cobalt-brand-link"
          to="/"
          aria-label="Back to main page"
          data-testid="links-back-brand"
          onClick={(event) => navigateFromNonRootPathname(event, '#/')}
        >
          <StarMark className="h-4 w-4 text-accent" />
          <span>{siteContent.profile.name}</span>
        </Link>
        <Link
          className="cobalt-secondary-action"
          to="/"
          data-testid="links-back-home"
          onClick={(event) => navigateFromNonRootPathname(event, '#/')}
        >
          <span aria-hidden="true">←</span>
          <span>Main page</span>
        </Link>
      </header>

      <main className="links-main-column">
        <section
          ref={headerPlateRef}
          aria-labelledby="links-page-heading"
          data-links-avoid=""
          data-creature-ignore=""
          className="plate links-header-plate motion-enter"
        >
          <p className="links-eyebrow">
            Links
          </p>
          <h1 id="links-page-heading" className="links-title">
            {siteContent.profile.name}
          </h1>
          <p className="links-subtitle">
            My main page and profiles across the web.
          </p>
        </section>

        <section
          ref={stackPlateRef}
          aria-label="Personal links"
          data-links-avoid=""
          data-creature-ignore=""
          className="plate links-stack-plate motion-enter motion-enter-delay-1"
        >
          {entries.length > 0 ? (
            <ul className="links-list" data-testid="links-list">
              {entries.map((entry) => {
                const external = isExternalHttpUrl(entry.href)
                const internalHashRoute = entry.href.startsWith('#/')
                const rel = buildRel({
                  external,
                  identity: Boolean(entry.isIdentityLink),
                })

                const cardBody = (
                  <>
                    <div className="links-card-body">
                      <div className="links-card-title-row">
                        <span className="links-card-label">
                          {entry.label}
                        </span>
                        {entry.isIdentityLink ? (
                          <span className="links-card-badge">Profile</span>
                        ) : null}
                      </div>
                      {entry.description ? (
                        <p className="links-card-description">
                          {entry.description}
                        </p>
                      ) : null}
                    </div>
                    <span className="links-card-indicator" aria-hidden="true">
                      {getIndicatorSymbol(entry.href)}
                    </span>
                  </>
                )

                return (
                  <li key={`${entry.label}-${entry.href}`}>
                    {internalHashRoute ? (
                      <Link
                        className="links-card"
                        to={entry.href.slice(1)}
                        data-testid="links-card"
                        data-identity-link={entry.isIdentityLink ? 'true' : 'false'}
                        onClick={(event) => navigateFromNonRootPathname(event, entry.href)}
                      >
                        {cardBody}
                      </Link>
                    ) : (
                      <a
                        className="links-card"
                        href={entry.href}
                        target={external ? '_blank' : undefined}
                        rel={rel}
                        data-testid="links-card"
                        data-identity-link={entry.isIdentityLink ? 'true' : 'false'}
                      >
                        {cardBody}
                      </a>
                    )}
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="links-empty-state" data-testid="links-empty">
              No links configured.
            </p>
          )}
        </section>
      </main>
    </div>
  )
}

export default LinksPage
