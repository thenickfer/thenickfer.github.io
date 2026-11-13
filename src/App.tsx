import { Navigate, Route, Routes } from 'react-router-dom'

import { HomePage } from './pages/HomePage'

function NotFoundPage() {
  return (
    <main className="page-grid flex min-h-dvh items-center justify-center px-6 text-center">
      <div>
        <p className="mb-4 font-mono text-xs uppercase tracking-[0.18em] text-accent">Route not implemented</p>
        <h1 className="text-5xl font-semibold text-text-primary">This page is still taking shape.</h1>
        <a className="mt-8 inline-block rounded-md bg-accent px-5 py-3 font-medium text-surface-sunk transition-transform duration-100 hover:-translate-y-0.5" href="#/">
          Return home
        </a>
      </div>
    </main>
  )
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/about" element={<NotFoundPage />} />
      <Route path="/research" element={<NotFoundPage />} />
      <Route path="/projects" element={<NotFoundPage />} />
      <Route path="/experience" element={<NotFoundPage />} />
      <Route path="/contact" element={<NotFoundPage />} />
      <Route path="/404" element={<NotFoundPage />} />
      <Route path="*" element={<Navigate to="/404" replace />} />
    </Routes>
  )
}

export default App
