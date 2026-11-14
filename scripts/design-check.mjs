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
  const content = await readFile(join(root, path), 'utf8')
  if (hexPattern.test(content) && !path.endsWith('tokens.css') && !path.startsWith('src/assets/') && !path.startsWith('public/logos/')) failures.push(`${path}: raw hex color`)
  if (/transition\s*:\s*all\b/i.test(content)) failures.push(`${path}: transition: all`)
}

const css = await readFile(join(root, 'src/styles/global.css'), 'utf8')
if (/@keyframes/.test(css) && !/@media\s*\(prefers-reduced-motion:\s*reduce\)/.test(css)) {
  failures.push('src/styles/global.css: animation lacks reduced-motion branch')
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

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log(`Design check passed (${relative(root, root) || '.'})`)
