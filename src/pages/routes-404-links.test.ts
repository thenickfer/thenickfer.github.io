import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { dirname, resolve as resolvePath } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'
import vm from 'node:vm'

import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { transformSync } from 'rolldown/utils'

import { siteContent } from '../content/site.ts'
import { LINKS_AVOID_SELECTOR, personalLinks, type LinkEntry } from '../data/links.ts'
import { buildRel, navigateFromNonRootPathname } from '../lib/links.ts'

// Register synchronous TSX, CSS, and asset loader hooks so React route/page components can be rendered in node:test.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.endsWith('.css')) {
      return { url: 'file:///virtual-styles.css', shortCircuit: true }
    }
    if (/\.(svg|png|jpe?g|webp|gif|woff2?)$/i.test(specifier)) {
      return { url: `file:///virtual-asset${specifier.startsWith('/') ? specifier : `/${specifier}`}`, shortCircuit: true }
    }
    if (specifier.startsWith('.') && context.parentURL) {
      const parentDir = dirname(fileURLToPath(context.parentURL))
      const candidateBase = resolvePath(parentDir, specifier)
      for (const ext of ['', '.ts', '.tsx', '/index.ts', '/index.tsx']) {
        const full = candidateBase + ext
        if (existsSync(full) && (full.endsWith('.ts') || full.endsWith('.tsx'))) {
          return { url: pathToFileURL(full).href, shortCircuit: true }
        }
      }
    }
    return nextResolve(specifier, context)
  },
  load(url, context, nextLoad) {
    if (url === 'file:///virtual-styles.css') {
      return { format: 'module', shortCircuit: true, source: 'export default {};' }
    }
    if (url.startsWith('file:///virtual-asset/') || /\.(svg|png|jpe?g|webp|gif|woff2?)$/i.test(url)) {
      return { format: 'module', shortCircuit: true, source: `export default ${JSON.stringify(url)};` }
    }
    if (url.endsWith('.tsx')) {
      const filePath = fileURLToPath(url)
      const source = readFileSync(filePath, 'utf8')
      const transformed = transformSync(filePath, source, { lang: 'tsx' })
      return { format: 'module', shortCircuit: true, source: transformed.code }
    }
    return nextLoad(url, context)
  },
})

const { NotFoundPage } = await import('./NotFoundPage.tsx')
const { LinksPage } = await import('./LinksPage.tsx')
const { HomePage } = await import('./HomePage.tsx')
const { CreatureFieldDemo } = await import('./CreatureFieldDemo.tsx')
const { default: App } = await import('../App.tsx')

function renderAtRoute(route: string, element?: React.ReactElement): string {
  return renderToStaticMarkup(
    React.createElement(
      MemoryRouter,
      { initialEntries: [route] },
      element ?? React.createElement(App),
    ),
  )
}

function parseAbbrTags(html: string): Array<{ title: string; text: string }> {
  const tags: Array<{ title: string; text: string }> = []
  const pattern = new RegExp('<' + 'abbr\\b[^>]*\\btitle="([^"]*)"[^>]*>([^<]*)<\\/' + 'abbr>', 'g')
  for (const match of html.matchAll(pattern)) {
    tags.push({ title: match[1] ?? '', text: match[2] ?? '' })
  }
  return tags
}

function parseAnchorTags(html: string): Array<Record<string, string>> {
  const anchors: Array<Record<string, string>> = []
  for (const match of html.matchAll(/<a\b([^>]*)>/g)) {
    const attrs: Record<string, string> = {}
    const attrText = match[1] ?? ''
    for (const attrMatch of attrText.matchAll(/([a-zA-Z0-9_-]+)="([^"]*)"/g)) {
      const key = attrMatch[1]
      const val = attrMatch[2]
      if (key !== undefined && val !== undefined) {
        attrs[key] = val
      }
    }
    anchors.push(attrs)
  }
  return anchors
}

describe('Custom 404 page and GitHub Pages fallback routing', () => {
  it('public/404.html redirects unknown direct paths to #/404?path=... and never to the homepage (#/)', () => {
    const html404Path = resolvePath(dirname(fileURLToPath(import.meta.url)), '../../public/404.html')
    const html404 = readFileSync(html404Path, 'utf8')

    // Ensure fallback HTML contains 404 heading, main page link, and zero Cobalt Lab copy
    assert.match(html404, /<h1[^>]*>Page not found<\/h1>/)
    assert.match(html404, /href="\/#\/"/)
    assert.match(html404, /Back to main page/)
    assert.doesNotMatch(html404, /portfolio/i)
    assert.doesNotMatch(html404, /cobalt\s*lab/i)

    // Extract inline redirect script and execute against simulated missing URLs
    const scriptMatch = html404.match(/<script>([\s\S]*?)<\/script>/)
    assert.ok(scriptMatch?.[1], 'Expected inline redirect script in public/404.html')
    const scriptCode = scriptMatch[1]

    const runRedirectFor = (pathname: string, search = '', hash = ''): string => {
      let replacedUrl = ''
      const sandbox = {
        URLSearchParams,
        encodeURIComponent,
        window: {
          location: {
            pathname,
            search,
            hash,
            replace(target: string) {
              replacedUrl = target
            },
          },
        },
      }
      vm.runInNewContext(scriptCode, sandbox)
      return replacedUrl
    }

    const directMissing = runRedirectFor('/some-missing-page')
    assert.equal(directMissing, '/#/404?path=%2Fsome-missing-page')
    assert.notEqual(directMissing, '/#/')

    const nestedWithQuery = runRedirectFor('/deep/missing/route', '?ref=test')
    assert.equal(nestedWithQuery, '/#/404?path=%2Fdeep%2Fmissing%2Froute%3Fref%3Dtest')

    const direct404Html = runRedirectFor('/404.html')
    assert.equal(direct404Html, '/#/404?path=%2F404')
  })

  it('renders NotFoundPage for unknown client-side routes and /404 with a homepage link', () => {
    for (const missingRoute of ['/unknown-route', '/some-missing-page', '/404?path=%2Fmissing-direct']) {
      const html = renderAtRoute(missingRoute)
      assert.match(html, /data-testid="not-found-page"/, `Expected NotFoundPage for ${missingRoute}`)
      assert.match(html, /data-ascii-piece="lorenz-butterfly"/)
      assert.match(html, /class="ascii-background\s*"[^>]*aria-hidden="true"/)
      assert.match(html, /<canvas\b[^>]*class="ascii-background__canvas"/)
      assert.match(html, />404</)
      assert.match(html, /Page not found/)
      assert.match(html, /data-testid="not-found-home-link"/)

      const anchors = parseAnchorTags(html)
      const homeLink = anchors.find((a) => a['data-testid'] === 'not-found-home-link')
      assert.ok(homeLink, 'Expected primary Back to main page link on 404 page')
      assert.equal(homeLink.href, '/')
      assert.match(html, /Back to main page/)
      assert.doesNotMatch(html, /portfolio/i)
      assert.doesNotMatch(html, /cobalt\s*lab/i)
    }

    // Verify requested path display for both direct query param and unknown route pathname
    const htmlFromQuery = renderAtRoute('/404?path=%2Fcustom-missing-url')
    assert.match(htmlFromQuery, /<code data-testid="not-found-requested-path">\/custom-missing-url<\/code>/)

    const htmlFromCatchAll = renderAtRoute('/non-existent-section')
    assert.match(htmlFromCatchAll, /<code data-testid="not-found-requested-path">\/non-existent-section<\/code>/)

    const htmlFromExplicitProp = renderAtRoute('/404', React.createElement(NotFoundPage, { requestedPath: '/explicit-path' }))
    assert.match(htmlFromExplicitProp, /<code data-testid="not-found-requested-path">\/explicit-path<\/code>/)
  })
})

describe('Personal links page (#/links) and src/data/links.ts', () => {
  it('populates src/data/links.ts only with verified web destinations and zero emails or PUCRS/LiS mentions', () => {
    assert.equal(personalLinks.length, 3, 'Expected 3 verified web destinations in src/data/links.ts')
    assert.deepEqual(
      personalLinks.map((entry) => entry.label),
      ['Main page', 'GitHub', 'LinkedIn'],
    )

    const allowedHrefs = new Set<string>([
      '#/',
      ...siteContent.contacts.filter((c) => !c.href.startsWith('mailto:')).map((c) => c.href),
    ])

    for (const entry of personalLinks) {
      assert.ok(entry.label.trim().length > 0, 'Link entry must have a non-empty label')
      assert.ok(entry.href.trim().length > 0, 'Link entry must have a non-empty href')
      assert.ok(
        allowedHrefs.has(entry.href),
        `Link href "${entry.href}" must come from verified non-email repository content`,
      )
      assert.doesNotMatch(entry.href, /^mailto:/i)
      assert.doesNotMatch(entry.label, /email/i)
      const combined = `${entry.label} ${entry.href} ${entry.description ?? ''}`
      assert.doesNotMatch(combined, /@gmail|@edu\.|mailto:/i)
      assert.doesNotMatch(combined, /\bpucrs\b/i)
      assert.doesNotMatch(combined, /\blis\b/i)
      assert.doesNotMatch(combined, /cobalt\s*lab/i)
    }

    const identityEntries = personalLinks.filter((entry) => entry.isIdentityLink)
    assert.deepEqual(
      identityEntries.map((entry) => entry.label).sort(),
      ['GitHub', 'LinkedIn'],
    )
  })

  it('renders #/links via App router with CreatureField background, avoidSelector, back-link to #/, and zero Cobalt Lab/email/PUCRS/LiS text', () => {
    const html = renderAtRoute('/links')
    assert.match(html, /data-testid="links-page"/)
    assert.match(html, /<canvas[^>]*aria-hidden="true"/)
    assert.match(html, new RegExp(`data-avoid-selector="${LINKS_AVOID_SELECTOR.replace(/[[\]]/g, '\\$&')}"`))
    assert.match(html, /data-links-avoid=""/)

    const anchors = parseAnchorTags(html)
    const backHome = anchors.find((a) => a['data-testid'] === 'links-back-home')
    assert.ok(backHome, 'Expected back-to-main-page navigation link on #/links')
    assert.equal(backHome.href, '/')
    assert.doesNotMatch(html, /portfolio/i)
    assert.doesNotMatch(html, /cobalt\s*lab/i)
    assert.doesNotMatch(html, /<footer\b/i)
    assert.doesNotMatch(html, /mailto:/i)
    assert.doesNotMatch(html, /@gmail|@edu\.|\bemail\b/i)
    assert.doesNotMatch(html, /\bpucrs\b/i)
    assert.doesNotMatch(html, /\blis\b/i)

    const cardAnchors = anchors.filter((a) => a['data-testid'] === 'links-card')
    assert.equal(cardAnchors.length, personalLinks.length)
  })

  it('dynamically reflects adding, removing, and editing link entries from data', () => {
    // 1. Adding a new entry
    const addedEntries: LinkEntry[] = [
      ...personalLinks,
      {
        label: 'Added Documentation Portal',
        href: 'https://example.org/',
        description: 'Added portal entry for testing.',
        isIdentityLink: false,
      },
    ]
    const addedHtml = renderAtRoute('/links', React.createElement(LinksPage, { entries: addedEntries }))
    const addedCards = parseAnchorTags(addedHtml).filter((a) => a['data-testid'] === 'links-card')
    assert.equal(addedCards.length, personalLinks.length + 1)
    assert.match(addedHtml, /Added Documentation Portal/)

    // 2. Removing entries (single remaining entry & empty array)
    const singleEntry: LinkEntry[] = [personalLinks[0]!]
    const singleHtml = renderAtRoute('/links', React.createElement(LinksPage, { entries: singleEntry }))
    const singleCards = parseAnchorTags(singleHtml).filter((a) => a['data-testid'] === 'links-card')
    assert.equal(singleCards.length, 1)
    assert.equal(singleCards[0]?.href, '/')

    const emptyHtml = renderAtRoute('/links', React.createElement(LinksPage, { entries: [] }))
    assert.equal(parseAnchorTags(emptyHtml).filter((a) => a['data-testid'] === 'links-card').length, 0)
    assert.match(emptyHtml, /data-testid="links-empty"/)

    // 3. Editing an entry (clickable link cards must not wrap abbreviations in <abbr>)
    const editedEntries: LinkEntry[] = [
      {
        label: 'Edited GitHub Handle',
        href: 'https://github.com/thenickfer',
        description: 'Updated description for AI, LLM, and CI/CD engineering.',
        isIdentityLink: true,
      },
    ]
    const editedHtml = renderAtRoute('/links', React.createElement(LinksPage, { entries: editedEntries }))
    assert.match(editedHtml, /Edited GitHub Handle/)
    assert.match(editedHtml, /Updated description for AI, LLM, and CI\/CD engineering\./)
    assert.equal(parseAbbrTags(editedHtml).length, 0)
  })

  it('includes rel="me" only when isIdentityLink is true and preserves noopener noreferrer on external links', () => {
    const testEntries: LinkEntry[] = [
      {
        label: 'Identity Profile',
        href: 'https://github.com/thenickfer',
        isIdentityLink: true,
      },
      {
        label: 'Non-Identity External',
        href: 'https://example.org/',
        isIdentityLink: false,
      },
      {
        label: 'Omitted Identity External',
        href: 'https://example.com/',
      },
      {
        label: 'Mailto Fixture',
        href: 'mailto:fixture@example.com',
        isIdentityLink: false,
      },
      {
        label: 'Internal Main Page',
        href: '#/',
        isIdentityLink: false,
      },
    ]

    const html = renderAtRoute('/links', React.createElement(LinksPage, { entries: testEntries }))
    const cards = parseAnchorTags(html).filter((a) => a['data-testid'] === 'links-card')
    assert.equal(cards.length, 5)

    // Identity external link -> target="_blank" and rel includes me, noopener, noreferrer
    const identityCard = cards[0]!
    assert.equal(identityCard.target, '_blank')
    const identityRelTokens = (identityCard.rel ?? '').split(/\s+/)
    assert.ok(identityRelTokens.includes('me'), 'Expected rel="me" when isIdentityLink is true')
    assert.ok(identityRelTokens.includes('noopener'))
    assert.ok(identityRelTokens.includes('noreferrer'))

    // Non-identity external links -> target="_blank", rel has noopener noreferrer, NO me
    for (const nonIdentityExternal of [cards[1]!, cards[2]!]) {
      assert.equal(nonIdentityExternal.target, '_blank')
      const relTokens = (nonIdentityExternal.rel ?? '').split(/\s+/)
      assert.equal(relTokens.includes('me'), false, 'rel="me" must not be present when isIdentityLink is false/omitted')
      assert.ok(relTokens.includes('noopener'))
      assert.ok(relTokens.includes('noreferrer'))
    }

    // Mailto & internal links -> no target="_blank", no rel="me"
    for (const localOrMail of [cards[3]!, cards[4]!]) {
      assert.equal(localOrMail.target, undefined)
      assert.equal(localOrMail.rel, undefined)
    }

    // Also verify buildRel({ external: true, identity: ... }) directly
    assert.equal(buildRel({ external: true, identity: true }), 'me noopener noreferrer')
    assert.equal(buildRel({ external: true, identity: false }), 'noopener noreferrer')
  })

  it('resets non-root pathnames when navigating to root hash routes and keeps Hero My Links CTA internal', () => {
    const originalWindow = globalThis.window
    let assignedUrl = ''
    let prevented = false

    try {
      Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: {
          location: {
            pathname: '/missing-direct-path',
            assign(url: string) {
              assignedUrl = url
            },
          },
        },
      })
      navigateFromNonRootPathname(
        {
          preventDefault() {
            prevented = true
          },
        },
        '#/',
      )
      assert.equal(prevented, true)
      assert.equal(assignedUrl, '/#/')

      assignedUrl = ''
      prevented = false
      Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: {
          location: {
            pathname: '/',
            assign(url: string) {
              assignedUrl = url
            },
          },
        },
      })
      navigateFromNonRootPathname(
        {
          preventDefault() {
            prevented = true
          },
        },
        '#/',
      )
      assert.equal(prevented, false)
      assert.equal(assignedUrl, '')
    } finally {
      Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: originalWindow,
      })
    }

    const homeHtml = renderAtRoute('/', React.createElement(HomePage))
    assert.doesNotMatch(homeHtml, /GitHub profile/)
    assert.doesNotMatch(homeHtml, /portfolio/i)
    assert.doesNotMatch(homeHtml, /cobalt\s*lab/i)

    const indexHtmlPath = resolvePath(dirname(fileURLToPath(import.meta.url)), '../../index.html')
    const indexHtml = readFileSync(indexHtmlPath, 'utf8')
    assert.doesNotMatch(indexHtml, /cobalt\s*lab/i)

    const originalDemoWindow = globalThis.window
    try {
      Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: {
          location: {
            search: '?loader=variants',
            hash: '',
          },
        },
      })
      const demoHtml = renderAtRoute('/labs/creatures-q7x2?loader=variants', React.createElement(CreatureFieldDemo))
      assert.match(demoHtml, /Pixel Loader Variants/)
      assert.doesNotMatch(demoHtml, /cobalt\s*lab/i)
    } finally {
      Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: originalDemoWindow,
      })
    }

    const anchors = parseAnchorTags(homeHtml)
    const heroLinksCta = anchors.find((a) => a['data-testid'] === 'hero-links-cta')
    assert.ok(heroLinksCta, 'Expected Hero My Links CTA on HomePage')
    assert.equal(heroLinksCta.href, '/links')
    assert.equal(heroLinksCta.target, undefined)
    assert.equal(heroLinksCta.rel, undefined)

    const identityAnchors = anchors.filter((a) => (a.rel ?? '').split(/\s+/).includes('me'))
    assert.ok(identityAnchors.length >= 2, 'Expected GitHub and LinkedIn identity links in profile/contact sections')
  })
})
