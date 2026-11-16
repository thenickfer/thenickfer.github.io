import { readdir, readFile, stat } from 'node:fs/promises'
import { join, relative } from 'node:path'

const root = new URL('..', import.meta.url).pathname
const scanRoots = ['src', 'index.html', 'public']
const hexPattern = /#[0-9a-f]{3,8}\b/i
const failures = []

async function files(path) {
  if ((await stat(join(root, path))).isFile()) return [path]
  const entries = await readdir(join(root, path), { withFileTypes: true })
  const nested = entries.map((entry) => {
    const child = join(path, entry.name)
    return entry.isDirectory() ? files(child) : [child]
  })
  return (await Promise.all(nested)).flat()
}

for (const path of (await Promise.all(scanRoots.map(files))).flat()) {
  if (/\.(gif|jpe?g|png|webp|woff2)$/i.test(path)) continue
  const content = await readFile(join(root, path), 'utf8')
  if (hexPattern.test(content) && !path.endsWith('tokens.css') && !path.endsWith('ascii-background/tokens.ts') && !path.startsWith('src/assets/') && !path.startsWith('public/logos/')) failures.push(`${path}: raw hex color`)
  if (/transition\s*:\s*all\b/i.test(content)) failures.push(`${path}: transition: all`)
  if (!path.endsWith('.test.ts') && /\b(?:animate-spin|fa-spinner)\b|<Spinner\b/i.test(content)) {
    failures.push(`${path}: rogue generic spinner detected; use canonical PixelLoader`)
  }
}

const css = await readFile(join(root, 'src/styles/global.css'), 'utf8')
if (/@keyframes/.test(css) && !/@media\s*\(prefers-reduced-motion:\s*reduce\)/.test(css)) {
  failures.push('src/styles/global.css: animation lacks reduced-motion branch')
}

const pixelLoaderCss = await readFile(join(root, 'src/styles/pixel-loader.css'), 'utf8')
if (/@keyframes/.test(pixelLoaderCss) && !/@media\s*\(prefers-reduced-motion:\s*reduce\)/.test(pixelLoaderCss)) {
  failures.push('src/styles/pixel-loader.css: animation lacks reduced-motion branch')
}
if (!/steps\(\d+/.test(pixelLoaderCss)) {
  failures.push('src/styles/pixel-loader.css: pixel loader animation must use stepped timing (steps(...))')
}

const appTsx = await readFile(join(root, 'src/App.tsx'), 'utf8')
for (const suspenseTag of appTsx.match(/<Suspense\b[\s\S]*?>/g) ?? []) {
  if (!suspenseTag.includes('PixelLoader')) {
    failures.push(`src/App.tsx: <Suspense> boundary must use canonical <PixelLoader /> fallback (${suspenseTag.slice(0, 80)})`)
  }
}

const indexHtml = await readFile(join(root, 'index.html'), 'utf8')
if (!indexHtml.includes('pixel-loader') || !indexHtml.includes('role="status"')) {
  failures.push('index.html: pre-hydration root must include canonical pixel-loader with role="status"')
}

const home = await readFile(join(root, 'src/pages/HomePage.tsx'), 'utf8')
for (const phrase of ['Engineering with a researcher', 'Two places to study', 'A small record', 'Portfolio foundation', 'For systems, software', 'at the boundary between', 'living space', 'built carefully']) {
  if (home.includes(phrase)) failures.push(`src/pages/HomePage.tsx: generated or filler copy: ${phrase}`)
}
if (home.includes('id="overview"') || home.includes('id="projects"')) {
  failures.push('src/pages/HomePage.tsx: filler sections remain')
}
if (!/title="Experience & Research"/.test(home) || !/title="Contact"/.test(home)) {
  failures.push('src/pages/HomePage.tsx: plain Experience & Research and Contact headings required')
}

// Semantics: abbreviations and identity links (docs/design/COBALT_LAB.md, "Semantics")
const { abbreviations, abbreviationPattern } = await import('../src/lib/abbreviations.ts')
const { siteContent } = await import('../src/content/site.ts')
const { personalLinks } = await import('../src/data/links.ts')

function stripComments(source) {
  return source
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
}

for (const entry of personalLinks) {
  if (/^mailto:/i.test(entry.href)) {
    failures.push(`src/data/links.ts: email/mailto link not allowed on #/links (${entry.href})`)
  }
  const combined = `${entry.label} ${entry.href} ${entry.description ?? ''}`
  if (/\b(?:pucrs|lis)\b/i.test(combined) || /cobalt\s*lab/i.test(combined)) {
    failures.push(`src/data/links.ts: disallowed PUCRS, LiS, or Cobalt Lab mention (${entry.label})`)
  }
}

const linksPageSource = stripComments(await readFile(join(root, 'src/pages/LinksPage.tsx'), 'utf8'))
if (/\b(?:pucrs|lis)\b/i.test(linksPageSource) || /<footer\b/i.test(linksPageSource)) {
  failures.push('src/pages/LinksPage.tsx: #/links must not contain footer, PUCRS, or LiS mentions')
}

const html404 = stripComments(await readFile(join(root, 'public/404.html'), 'utf8'))
if (/cobalt\s*lab/i.test(html404)) {
  failures.push('public/404.html: user-facing "Cobalt Lab" mention not allowed')
}

function findTagEnd(source, startIndex) {
  let quote = null
  let braceDepth = 0
  for (let i = startIndex; i < source.length; i++) {
    const ch = source[i]
    if (quote) {
      if (ch === '\\') {
        i++
        continue
      }
      if (ch === quote) quote = null
      continue
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch
      continue
    }
    if (ch === '{') {
      braceDepth++
      continue
    }
    if (ch === '}') {
      if (braceDepth > 0) braceDepth--
      continue
    }
    if (braceDepth === 0 && ch === '>') {
      return i
    }
  }
  return -1
}

const trackedElementPattern = /^<\/?(header|nav|footer|h[1-6]|section|div|main|article|aside|p|span|a|button|ul|ol|li|code|strong|em|abbr|Abbr|Abbreviated|Link|ExternalLink|SectionHeading)\b/
const alwaysForbiddenTags = new Set(['header', 'nav', 'footer', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'button', 'a', 'Link', 'ExternalLink', 'SectionHeading'])

function isForbiddenAbbrContainer(tagName, attrs) {
  if (alwaysForbiddenTags.has(tagName)) return tagName
  if (/\bid=["']home["']/.test(attrs) || /\bhero-(?:shell|copy)\b/.test(attrs)) return `${tagName}#home`
  if (/\b(?:eyebrow|stamp|badge)\b/.test(attrs)) return `${tagName}[label]`
  if (/\bfont-mono\b/.test(attrs) && /\buppercase\b/.test(attrs)) return `${tagName}.font-mono.uppercase`
  return null
}

function scanAbbreviationsInSource(path, source, glossaryPattern, checkUnmarkedProse) {
  const issues = []
  const stack = []
  let i = 0

  const getForbiddenAncestor = () => stack.find((entry) => entry.forbiddenReason)
  const insideAbbr = () => stack.some((entry) => entry.tagName === 'abbr' || entry.tagName === 'Abbr' || entry.tagName === 'Abbreviated')

  while (i < source.length) {
    if (source[i] !== '<') {
      i++
      continue
    }

    const slice = source.slice(i)
    const match = slice.match(trackedElementPattern)
    if (!match) {
      i++
      continue
    }

    const isClosing = slice.startsWith('</')
    const tagName = match[1]
    const tagEnd = findTagEnd(source, i + match[0].length)
    if (tagEnd === -1) break

    const rawTag = source.slice(i, tagEnd + 1)
    const selfClosing = !isClosing && rawTag.endsWith('/>')
    const attrs = isClosing ? '' : rawTag.slice(match[0].length, selfClosing ? -2 : -1)

    if (isClosing) {
      for (let s = stack.length - 1; s >= 0; s--) {
        if (stack[s].tagName === tagName) {
          stack.length = s
          break
        }
      }
    } else {
      if (tagName === 'abbr' || tagName === 'Abbr' || tagName === 'Abbreviated') {
        const forbidden = getForbiddenAncestor()
        if (forbidden) {
          issues.push(`${path}: <${tagName}> must only be used in pure body text (found inside ${forbidden.forbiddenReason})`)
        }
      }
      if (!selfClosing) {
        stack.push({ tagName, forbiddenReason: isForbiddenAbbrContainer(tagName, attrs) })
      }
    }

    // Check literal JSX text immediately following a tag close when inside pure prose.
    i = tagEnd + 1
    if (checkUnmarkedProse && !getForbiddenAncestor() && !insideAbbr()) {
      let textEnd = i
      while (textEnd < source.length && source[textEnd] !== '<' && source[textEnd] !== '{') {
        textEnd++
      }
      const literalText = source.slice(i, textEnd)
      for (const termMatch of literalText.matchAll(glossaryPattern)) {
        issues.push(`${path}: "${termMatch[1]}" in pure prose JSX should use <Abbreviated> or <abbr title>`)
      }
    }
  }

  return issues
}

for (const [term, expansion] of Object.entries(abbreviations)) {
  if (!expansion || expansion.trim() !== expansion) failures.push(`abbreviation glossary: "${term}" has an empty or untrimmed expansion`)
  else if (expansion === term || expansion.length <= term.length) failures.push(`abbreviation glossary: "${term}" expansion does not expand the term`)
}

const sourceFiles = (await Promise.all(['src', 'index.html'].map(files)))
  .flat()
  .filter((path) => /\.(tsx?|html)$/.test(path) && !path.endsWith('.test.ts'))
const glossaryPattern = abbreviationPattern()
for (const path of sourceFiles) {
  const content = await readFile(join(root, path), 'utf8')
  if (!path.endsWith('.test.ts') && /cobalt\s*lab/i.test(stripComments(content))) {
    failures.push(`${path}: user-facing "Cobalt Lab" mention not allowed`)
  }

  for (const tag of content.match(/<abbr\b[^>]*>/g) ?? []) {
    const literal = tag.match(/\btitle="([^"]*)"/)
    const dynamic = /\btitle=\{[^}]+\}/.test(tag)
    if (!dynamic && (!literal || literal[1].trim() === '')) failures.push(`${path}: <abbr> needs a non-empty title (${tag})`)
  }
  for (const [, title, text] of content.matchAll(/<abbr\b[^>]*\btitle="([^"]*)"[^>]*>([^<]*)<\/abbr>/g)) {
    const abbr = text.trim()
    if (title.trim() && (title.trim() === abbr || title.trim().length <= abbr.length)) failures.push(`${path}: <abbr> title "${title}" does not expand "${abbr}"`)
    if (abbr in abbreviations && abbreviations[abbr] !== title) failures.push(`${path}: <abbr> title for "${abbr}" differs from the glossary`)
  }

  // Enforce <abbr>/<Abbreviated> only in pure body text (never in heroes, headers, nav, footers, headings, buttons, links, or UI labels).
  if ((path.endsWith('.tsx') || path.endsWith('.html')) && !path.endsWith('Abbr.tsx')) {
    const checkUnmarkedProse =
      /^src\/(pages|components)\//.test(path) &&
      path.endsWith('.tsx') &&
      !path.startsWith('src/components/creature-field/') &&
      !path.endsWith('CreatureFieldDemo.tsx')
    failures.push(...scanAbbreviationsInSource(path, stripComments(content), glossaryPattern, checkUnmarkedProse))
  }

  // Identity links: every anchor to one of my profiles carries rel="me" (directly or through the identity prop).
  const identityUrls = siteContent.contacts.filter((contact) => contact.identity).map((contact) => contact.href)
  for (const tag of content.match(/<(?:a|ExternalLink)\b[^>]*>/g) ?? []) {
    const literalIdentity = identityUrls.some((url) => tag.includes(url))
    const fromContacts = tag.includes('contact.href')
    const marked = /\bidentity\b/.test(tag) || /rel="[^"]*\bme\b[^"]*"/.test(tag)
    if (literalIdentity && !marked) failures.push(`${path}: link to my profile lacks rel="me" or identity (${tag.slice(0, 80)}...)`)
    if (fromContacts && !tag.includes('contact.identity')) failures.push(`${path}: contact link must pass contact.identity to rel (${tag.slice(0, 80)}...)`)
  }
}

const identityHosts = ['github.com', 'linkedin.com']
for (const contact of siteContent.contacts) {
  if (!/^https?:/.test(contact.href)) continue
  const host = new URL(contact.href).hostname.replace(/^www\./, '')
  if (identityHosts.includes(host) && !contact.identity) failures.push(`src/content/site.ts: ${contact.label} is a profile link and needs identity: true`)
}
if (!siteContent.contacts.some((contact) => contact.identity)) failures.push('src/content/site.ts: no identity links found')

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log(`Design check passed (${relative(root, root) || '.'})`)
