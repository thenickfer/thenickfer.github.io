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
  if (hexPattern.test(content) && !path.endsWith('tokens.css')) failures.push(`${path}: raw hex color`)
  if (/transition\s*:\s*all\b/i.test(content)) failures.push(`${path}: transition: all`)
}

const css = await readFile(join(root, 'src/styles/global.css'), 'utf8')
if (/@keyframes/.test(css) && !/@media\s*\(prefers-reduced-motion:\s*reduce\)/.test(css)) {
  failures.push('src/styles/global.css: animation lacks reduced-motion branch')
}

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log(`Design check passed (${relative(root, root) || '.'})`)
