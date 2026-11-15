import { lazy, Suspense } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'

import { PixelLoader } from './components/PixelLoader'
import { HomePage } from './pages/HomePage'
import { LinksPage } from './pages/LinksPage'
import { NotFoundPage } from './pages/NotFoundPage'

const CreatureFieldDemo = lazy(() => import('./pages/CreatureFieldDemo'))

const SECRET_CREATURES_PATH = '/labs/creatures-q7x2'
const CREATURE_FIELD_DEMO_PATH = '/__creature-field-demo'

function isDirectSecretCreaturesPathname(): boolean {
  if (typeof window === 'undefined') return false
  const normalized = window.location.pathname.replace(/\/+$/, '')
  return normalized === SECRET_CREATURES_PATH
}

function getDirectUnknownPathname(routerPathname: string, routerSearch: string): string | null {
  if (typeof window === 'undefined') return null
  const normalized = window.location.pathname.replace(/\/+$/, '') || '/'
  if (normalized === '/' || normalized === '/index.html' || normalized === '/404.html') return null
  if (normalized === SECRET_CREATURES_PATH) return null
  const hash = window.location.hash
  if (hash && hash !== '#' && !hash.startsWith('#/404')) {
    return null
  }
  if (routerPathname !== '/' && routerPathname !== '/404') {
    return null
  }
  return normalized + (routerSearch || window.location.search || '')
}

function App() {
  const location = useLocation()

  if (isDirectSecretCreaturesPathname()) {
    return (
      <Suspense fallback={<PixelLoader variant="page" label="Loading page" />}>
        <CreatureFieldDemo />
      </Suspense>
    )
  }

  const directUnknownPath = getDirectUnknownPathname(location.pathname, location.search)
  if (directUnknownPath) {
    return <NotFoundPage requestedPath={directUnknownPath} />
  }

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/links" element={<LinksPage />} />
      <Route path="/about" element={<NotFoundPage />} />
      <Route path="/research" element={<NotFoundPage />} />
      <Route path="/projects" element={<NotFoundPage />} />
      <Route path="/experience" element={<NotFoundPage />} />
      <Route path="/contact" element={<NotFoundPage />} />
      <Route
        path={SECRET_CREATURES_PATH}
        element={
          <Suspense fallback={<PixelLoader variant="page" label="Loading page" />}>
            <CreatureFieldDemo />
          </Suspense>
        }
      />
      <Route
        path={CREATURE_FIELD_DEMO_PATH}
        element={
          <Suspense fallback={<PixelLoader variant="page" label="Loading page" />}>
            <CreatureFieldDemo />
          </Suspense>
        }
      />
      <Route path="/404" element={<NotFoundPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export default App
