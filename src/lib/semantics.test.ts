import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { dirname, resolve as resolvePath } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { transformSync } from 'rolldown/utils'

import { siteContent } from '../content/site.ts'
import { abbreviations, splitAbbreviations } from './abbreviations.ts'
import { buildRel } from './links.ts'

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

const { HomePage } = await import('../pages/HomePage.tsx')
const { LinksPage } = await import('../pages/LinksPage.tsx')
const { NotFoundPage } = await import('../pages/NotFoundPage.tsx')

describe('abbreviation markup', () => {
  it('splits only known whole-word abbreviations and keeps the text intact', () => {
    const text = 'I work at LiS, in the HP/PUCRS partnership, on AI and CI/CD. MAIN, said, LiSt stay plain.'
    const parts = splitAbbreviations(text)
    const abbrs = parts.filter((part) => typeof part !== 'string').map((part) => part.abbr)
    assert.deepEqual(abbrs, ['LiS', 'PUCRS', 'AI', 'CI/CD'])
    assert.equal(parts.map((part) => (typeof part === 'string' ? part : part.abbr)).join(''), text)
  })

  it('does not invent expansions for unknown terms', () => {
    for (const term of ['NSESD', 'HP', 'DevOps']) {
      assert.equal(term in abbreviations, false)
      assert.deepEqual(splitAbbreviations(term), [term])
    }
  })

  it('gives every glossary entry a real expansion', () => {
    for (const [term, expansion] of Object.entries(abbreviations)) {
      assert.ok(expansion.trim() === expansion && expansion.length > term.length, term)
    }
  })

  it('marks every glossary term that appears in prose site content', () => {
    const strings: string[] = []
    const walk = (value: unknown) => {
      if (typeof value === 'string') strings.push(value)
      else if (Array.isArray(value)) value.forEach(walk)
      else if (value && typeof value === 'object') Object.values(value).forEach(walk)
    }
    walk(siteContent.profile.biography)
    walk(siteContent.researchInterests)
    walk(siteContent.education.map((entry) => entry.degree))
    walk(siteContent.experienceResearch.map((entry) => [entry.description, entry.focusAreas.map((area) => area.description)]))
    const found = strings.flatMap((text) => splitAbbreviations(text).filter((part) => typeof part !== 'string'))
    assert.ok(found.length > 0)
    for (const part of found) assert.ok(typeof part !== 'string' && part.title.length > 0)
  })

  it('renders <abbr> only in pure body text and never in hero, header/nav, footer, headings, buttons, or links', () => {
    const homeHtml = renderToStaticMarkup(
      React.createElement(MemoryRouter, { initialEntries: ['/'] }, React.createElement(HomePage)),
    )

    // Hero, nav, header, footer, headings, buttons, links must not contain <abbr>
    const heroMatch = homeHtml.match(/<section id="home"[\s\S]*?<\/section>/)
    assert.ok(heroMatch?.[0], 'Expected hero section on HomePage')
    assert.doesNotMatch(heroMatch[0], /<abbr\b/i, 'Hero must not contain <abbr> tags')
    assert.doesNotMatch(homeHtml, /<(?:nav|header|footer|h[1-6]|button|a)\b[^>]*>(?:(?!<\/(?:nav|header|footer|h[1-6]|button|a)>).)*<abbr\b/is, 'Headers, nav, footers, headings, buttons, and links must not contain <abbr> tags')
    assert.doesNotMatch(homeHtml, /<abbr[^>]*>GPA<\/abbr>/, 'GPA metadata label must not use <abbr>')
    assert.doesNotMatch(homeHtml, /<abbr[^>]*>NCF<\/abbr>/, 'Nav brand mark NCF must not use <abbr>')

    // Pure body text retains expected <abbr title="..."> expansions
    for (const term of ['PUCRS', 'LiS', 'AI', 'ECC', 'BSc', 'LLM', 'CI/CD']) {
      const expansion = abbreviations[term]
      assert.ok(expansion, `Missing glossary entry for ${term}`)
      assert.match(homeHtml, new RegExp(`<abbr title="${expansion.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}">${term}<\\/abbr>`))
    }

    // LinksPage and NotFoundPage have no pure-prose abbreviations and zero <abbr> tags
    const linksHtml = renderToStaticMarkup(
      React.createElement(MemoryRouter, { initialEntries: ['/links'] }, React.createElement(LinksPage)),
    )
    const notFoundHtml = renderToStaticMarkup(
      React.createElement(MemoryRouter, { initialEntries: ['/404'] }, React.createElement(NotFoundPage)),
    )
    assert.doesNotMatch(linksHtml, /<abbr\b/i)
    assert.doesNotMatch(notFoundHtml, /<abbr\b/i)
  })
})

describe('identity links and rel tokens', () => {
  it('adds me and keeps security tokens, existing tokens and order', () => {
    assert.equal(buildRel({ identity: true, newTab: true }), 'me noopener noreferrer')
    assert.equal(buildRel({ existing: 'noreferrer', identity: true, newTab: true }), 'noreferrer me noopener')
    assert.equal(buildRel({ existing: 'me nofollow', identity: true }), 'me nofollow')
    assert.equal(buildRel({ newTab: true }), 'noopener noreferrer')
    assert.equal(buildRel({}), undefined)
  })

  it('flags the real GitHub and LinkedIn profile links as identity links', () => {
    const identity = siteContent.contacts.filter((contact) => contact.identity)
    assert.deepEqual(identity.map((contact) => contact.label).sort(), ['GitHub', 'LinkedIn'])
    for (const contact of identity) {
      assert.match(new URL(contact.href).hostname, /(^|\.)(github|linkedin)\.com$/)
      assert.match(buildRel({ identity: contact.identity, newTab: true }) ?? '', /\bme\b/)
    }
    for (const contact of siteContent.contacts.filter((item) => item.href.startsWith('mailto:'))) {
      assert.equal(contact.identity, undefined)
    }
  })
})
