import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'

const root = process.cwd()
const tokensCss = readFileSync(join(root, 'src/styles/tokens.css'), 'utf8')
const globalCss = readFileSync(join(root, 'src/styles/global.css'), 'utf8')
const dotGothicCss = readFileSync(join(root, 'src/styles/fonts-dotgothic16.css'), 'utf8')

function extractToken(name: string): string {
  const match = tokensCss.match(new RegExp(`${name}:\\s*([^;]+);`))
  const value = match?.[1]
  assert.ok(value !== undefined, `Missing token ${name}`)
  return value.replace(/\s+/g, ' ').trim()
}

function parseUnicodeRanges(css: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = []
  for (const match of css.matchAll(/unicode-range:\s*([^;]+);/g)) {
    const raw = match[1]
    if (!raw) continue
    for (const part of raw.split(',')) {
      const token = part.trim().replace(/^U\+/i, '')
      if (token.includes('-')) {
        const [startHex = '', endHex = ''] = token.split('-')
        ranges.push([parseInt(startHex, 16), parseInt(endHex, 16)])
      } else if (token.includes('?')) {
        const startHex = token.replace(/\?/g, '0')
        const endHex = token.replace(/\?/g, 'F')
        ranges.push([parseInt(startHex, 16), parseInt(endHex, 16)])
      } else {
        const cp = parseInt(token, 16)
        ranges.push([cp, cp])
      }
    }
  }
  return ranges
}

function coversString(ranges: Array<[number, number]>, text: string): boolean {
  for (const ch of text) {
    const cp = ch.codePointAt(0)!
    if (!ranges.some(([start, end]) => cp >= start && cp <= end)) {
      return false
    }
  }
  return true
}

describe('Cobalt Lab typography tokens and font loading', () => {
  it('defines the exact required font-family token stacks', () => {
    assert.equal(
      extractToken('--ds-font-family-primary'),
      '"Founders Grotesk Text", "Founders Grotesk", "IBM Plex Sans", Arial, sans-serif',
    )
    assert.equal(
      extractToken('--ds-font-family-mono'),
      '"Paper Mono", "Berkeley Mono", "IBM Plex Mono", ui-monospace, monospace',
    )
    assert.equal(
      extractToken('--ds-font-family-display'),
      '"ABC Arizona", Canela, "Instrument Serif", Georgia, serif',
    )
    assert.equal(
      extractToken('--ds-font-family-editorial'),
      'Newsreader, Georgia, serif',
    )
    assert.equal(
      extractToken('--ds-font-family-pixel'),
      'Silkscreen, "Press Start 2P", monospace',
    )
    assert.equal(
      extractToken('--ds-font-family-pixel-ja'),
      '"DotGothic16", "Noto Sans JP", sans-serif',
    )
  })

  it('self-hosts IBM Plex Sans, IBM Plex Mono, and DotGothic16 WOFF2 files with OFL licenses', () => {
    for (const dir of ['paper-mono', 'ibm-plex-sans', 'ibm-plex-mono', 'dotgothic16']) {
      assert.ok(existsSync(join(root, 'public/fonts', dir, 'OFL.txt')), `Missing OFL.txt in ${dir}`)
    }

    const combinedCss = `${globalCss}\n${dotGothicCss}`
    const urls = [...combinedCss.matchAll(/url\(['"](\/fonts\/[^'"]+\.woff2)['"]\)/g)]
      .map((m) => m[1])
      .filter((u): u is string => Boolean(u))
    assert.ok(urls.length > 0, 'Expected self-hosted WOFF2 @font-face declarations')
    for (const urlPath of urls) {
      assert.ok(existsSync(join(root, 'public', urlPath)), `Missing font asset ${urlPath}`)
    }
  })

  it('configures DotGothic16 as Regular 400 only with font-synthesis: none utility', () => {
    assert.match(globalCss, /\.ds-font-pixel-ja\s*\{[^}]*font-family:\s*var\(--ds-font-family-pixel-ja\);[^}]*font-weight:\s*400;[^}]*font-synthesis:\s*none;/s)
    const weights = [...dotGothicCss.matchAll(/font-weight:\s*([^;]+);/g)]
      .map((m) => m[1]?.trim())
      .filter((w): w is string => Boolean(w))
    assert.ok(weights.length > 0)
    assert.ok(weights.every((w) => w === '400'), 'DotGothic16 must only declare font-weight: 400')
  })

  it('covers Hiragana, Katakana, common Kanji, Japanese punctuation, and mixed Latin strings in DotGothic16', () => {
    const ranges = parseUnicodeRanges(dotGothicCss)
    assert.ok(coversString(ranges, 'あいうえお'), 'Hiragana coverage')
    assert.ok(coversString(ranges, 'ソフトウェア'), 'Katakana coverage')
    assert.ok(coversString(ranges, '研究とソフトウェア'), 'Mixed Kanji/Hiragana/Katakana coverage')
    assert.ok(coversString(ranges, '。、「」'), 'Japanese punctuation coverage')
    assert.ok(coversString(ranges, 'Cobalt Lab 2026 研究'), 'Mixed Japanese and Latin coverage')
  })
})
