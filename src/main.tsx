import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'

import App from './App.tsx'
import { SmoothScroll } from './components/SmoothScroll'
import './styles/global.css'
import 'lenis/dist/lenis.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SmoothScroll>
      <HashRouter>
        <App />
      </HashRouter>
    </SmoothScroll>
  </StrictMode>,
)
