import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import {
  MAX_PIXEL_LABEL_LENGTH,
  PIXEL_BUTTON_3X1,
  PIXEL_STAR_5X5,
  PIXEL_STAR_7X7,
  PixelLoader,
  formatPixelLoaderLabel,
  normalizePixelLoaderVariant,
  resolvePixelLoaderSize,
  resolveShowLabel,
  shouldRenderDelayedLoader,
} from './pixel-loader-model.ts'

const repoRoot = new URL('../..', import.meta.url).pathname

describe('PixelLoader canonical component', () => {
  describe('variants and pixel-star geometry', () => {
    it('supports page/full-page, section/component, inline, and button variants', () => {
      assert.equal(normalizePixelLoaderVariant('page'), 'page')
      assert.equal(normalizePixelLoaderVariant('full-page'), 'page')
      assert.equal(normalizePixelLoaderVariant('section'), 'section')
      assert.equal(normalizePixelLoaderVariant('component'), 'section')
      assert.equal(normalizePixelLoaderVariant('inline'), 'inline')
      assert.equal(normalizePixelLoaderVariant('button'), 'button')

      assert.equal(resolvePixelLoaderSize('page'), 'lg')
      assert.equal(resolvePixelLoaderSize('section'), 'md')
      assert.equal(resolvePixelLoaderSize('inline'), 'sm')
      assert.equal(resolvePixelLoaderSize('button'), 'sm')
      assert.equal(resolvePixelLoaderSize('section', 'lg'), 'lg')

      assert.equal(resolveShowLabel('page'), true)
      assert.equal(resolveShowLabel('section'), true)
      assert.equal(resolveShowLabel('inline'), false)
      assert.equal(resolveShowLabel('button'), false)
      assert.equal(resolveShowLabel('inline', true), true)
    })

    it('renders 7x7 pixel-star grid for page and section variants', () => {
      const activeCount7x7 = PIXEL_STAR_7X7.flat().filter((tier) => tier !== null).length
      assert.equal(PIXEL_STAR_7X7.length, 7)
      assert.equal(PIXEL_STAR_7X7.flat().length, 49)
      assert.equal(activeCount7x7, 17)

      for (const variant of ['page', 'full-page', 'section', 'component'] as const) {
        const html = renderToStaticMarkup(
          createElement(PixelLoader, { variant, label: 'Loading portfolio section' }),
        )
        assert.match(html, /class="[^"]*\bpixel-loader\b/)
        assert.match(html, /class="[^"]*\bpixel-loader__plate\b/)
        assert.match(html, /class="[^"]*\bpixel-loader__grid--7\b/)
        const totalCells = (html.match(/class="pixel-loader__cell/g) ?? []).length
        const activeCells = (html.match(/pixel-loader__cell--active/g) ?? []).length
        assert.equal(totalCells, 49)
        assert.equal(activeCells, 17)
      }
    })

    it('renders 5x5 pixel-star grid for inline variant and 3-cell loader for button variant', () => {
      const activeCount5x5 = PIXEL_STAR_5X5.flat().filter((tier) => tier !== null).length
      assert.equal(PIXEL_STAR_5X5.length, 5)
      assert.equal(PIXEL_STAR_5X5.flat().length, 25)
      assert.equal(activeCount5x5, 13)
      assert.equal(PIXEL_BUTTON_3X1.length, 3)

      const inlineHtml = renderToStaticMarkup(
        createElement(PixelLoader, { variant: 'inline', label: 'Loading status' }),
      )
      assert.match(inlineHtml, /data-variant="inline"/)
      assert.match(inlineHtml, /pixel-loader__grid--5/)
      assert.equal((inlineHtml.match(/class="pixel-loader__cell/g) ?? []).length, 25)
      assert.equal((inlineHtml.match(/pixel-loader__cell--active/g) ?? []).length, 13)
      assert.doesNotMatch(inlineHtml, /pixel-loader__label/)

      const buttonHtml = renderToStaticMarkup(
        createElement(PixelLoader, { variant: 'button', label: 'Submitting form' }),
      )
      assert.match(buttonHtml, /data-variant="button"/)
      assert.match(buttonHtml, /pixel-loader__grid--button/)
      assert.equal((buttonHtml.match(/pixel-loader__cell--active/g) ?? []).length, 3)
      assert.match(buttonHtml, /pixel-loader__cell--step-0/)
      assert.match(buttonHtml, /pixel-loader__cell--step-1/)
      assert.match(buttonHtml, /pixel-loader__cell--step-2/)
    })

    it('clamps visible pixel-font labels to uppercase <= 24 chars while keeping full sr-only label', () => {
      const longLabel = 'Synchronizing telemetry across distributed cluster nodes'
      const formatted = formatPixelLoaderLabel(longLabel)
      assert.ok(formatted.length <= MAX_PIXEL_LABEL_LENGTH)
      assert.equal(formatted, formatted.toUpperCase())
      assert.equal(formatted, 'SYNCHRONIZING TELEMETRY ')

      const html = renderToStaticMarkup(
        createElement(PixelLoader, { variant: 'page', label: longLabel }),
      )
      assert.ok(html.includes(`<span class="sr-only">${longLabel}</span>`))
      assert.ok(html.includes(`<span aria-hidden="true" class="pixel-loader__label">${formatted}</span>`))
    })
  })

  describe('accessibility, reduced motion, and display delay / cleanup', () => {
    it('sets role="status", aria-live="polite", aria-busy, sr-only label, and aria-hidden on all decorative cells', () => {
      const html = renderToStaticMarkup(
        createElement(PixelLoader, { variant: 'section', label: 'Loading research data' }),
      )
      assert.match(html, /\brole="status"/)
      assert.match(html, /\baria-live="polite"/)
      assert.match(html, /\baria-busy="true"/)
      assert.match(html, /<span class="sr-only">Loading research data<\/span>/)

      // Every grid and cell span must carry aria-hidden="true"
      const cellTags = html.match(/<span[^>]*class="pixel-loader__(?:grid|cell)[^"]*"[^>]*>/g) ?? []
      assert.ok(cellTags.length > 0)
      for (const tag of cellTags) {
        assert.match(tag, /\baria-hidden="true"/, `Decorative element missing aria-hidden: ${tag}`)
      }
    })

    it('supports reduced-motion and finished static thermal star states', () => {
      const reducedHtml = renderToStaticMarkup(
        createElement(PixelLoader, {
          variant: 'page',
          label: 'Loading page',
          reducedMotion: true,
        }),
      )
      assert.match(reducedHtml, /\bdata-reduced-motion="true"/)

      const finishedHtml = renderToStaticMarkup(
        createElement(PixelLoader, {
          variant: 'section',
          label: 'Loaded',
          state: 'finished',
        }),
      )
      assert.match(finishedHtml, /\bdata-state="finished"/)
      assert.match(finishedHtml, /\baria-busy="false"/)
      assert.match(finishedHtml, /\bpixel-loader--finished\b/)
    })

    it('unmounts cleanly when active is false and suppresses initial render when delayMs > 0', () => {
      const inactiveHtml = renderToStaticMarkup(
        createElement(PixelLoader, { variant: 'page', active: false }),
      )
      assert.equal(inactiveHtml, '')

      const delayedInitialHtml = renderToStaticMarkup(
        createElement(PixelLoader, { variant: 'section', delayMs: 150, active: true }),
      )
      assert.equal(delayedInitialHtml, '')

      assert.equal(shouldRenderDelayedLoader(true, 0, 0), true)
      assert.equal(shouldRenderDelayedLoader(true, 150, 80), false)
      assert.equal(shouldRenderDelayedLoader(true, 150, 150), true)
      assert.equal(shouldRenderDelayedLoader(false, 150, 300), false)
    })
  })

  describe('repository-wide loading boundaries and style rules', () => {
    it('uses canonical PixelLoader in index.html, App.tsx Suspense boundaries, HomePage, OrganizationLogo, and CreatureFieldDemo', async () => {
      const indexHtml = await readFile(join(repoRoot, 'index.html'), 'utf8')
      assert.match(indexHtml, /data-pixel-loader="true"/)
      assert.match(indexHtml, /role="status"/)
      assert.match(indexHtml, /aria-live="polite"/)

      const appTsx = await readFile(join(repoRoot, 'src/App.tsx'), 'utf8')
      assert.match(appTsx, /import\s+\{\s*PixelLoader\s*\}\s+from\s+['"]\.\/components\/PixelLoader['"]/)
      assert.doesNotMatch(appTsx, /fallback=\{null\}/)
      const suspenseTags = appTsx.match(/<Suspense\b[\s\S]*?>/g) ?? []
      assert.ok(suspenseTags.length >= 2)
      for (const tag of suspenseTags) {
        assert.match(tag, /PixelLoader/)
      }

      const homeTsx = await readFile(join(repoRoot, 'src/pages/HomePage.tsx'), 'utf8')
      assert.match(homeTsx, /PixelLoader/)
      assert.match(homeTsx, /aria-busy=\{!photoLoaded\}/)

      const logoTsx = await readFile(join(repoRoot, 'src/components/OrganizationLogo.tsx'), 'utf8')
      assert.match(logoTsx, /PixelLoader/)
      assert.match(logoTsx, /aria-busy=\{!loaded\}/)

      const demoTsx = await readFile(join(repoRoot, 'src/pages/CreatureFieldDemo.tsx'), 'utf8')
      assert.match(demoTsx, /PixelLoader/)
      assert.match(demoTsx, /variant="button"/)
    })

    it('enforces stepped timing, token-only colors, and reduced-motion branch in pixel-loader.css', async () => {
      const css = await readFile(join(repoRoot, 'src/styles/pixel-loader.css'), 'utf8')
      assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b/i)
      assert.match(css, /steps\(\d+,\s*end\)/)
      assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/)
      assert.match(css, /var\(--ds-font-family-pixel\)/)
      assert.match(css, /var\(--ds-color-thermal-hot\)/)
    })
  })
})
