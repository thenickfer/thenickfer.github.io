import { StarMark } from './StarMark'
import { useState } from 'react'

const futureRoutes = ['About', 'Research', 'Projects', 'Experience', 'Contact']

export function SiteNav() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <nav aria-label="Primary navigation" className="site-nav content-wrap">
      <a className="flex items-center gap-3 text-sm font-semibold tracking-wide text-text-primary" href="#/" aria-label="Home">
        <StarMark className="h-4 w-4 text-accent" />
        <span>NCF / portfolio</span>
      </a>
      <div className="site-nav-links">
        <a className="font-mono text-xs uppercase tracking-[0.14em] text-accent" href="#/">Home</a>
        {futureRoutes.map((route) => (
          <span key={route} aria-disabled="true" className="font-mono text-xs uppercase tracking-[0.14em] text-text-secondary/60">
            {route}
          </span>
        ))}
      </div>
      <button
        className="site-nav-menu-button"
        type="button"
        aria-expanded={menuOpen}
        aria-controls="mobile-navigation"
        onClick={() => setMenuOpen((open) => !open)}
      >
        <span className="sr-only">{menuOpen ? 'Close menu' : 'Open menu'}</span>
        <span aria-hidden="true">{menuOpen ? '×' : 'Menu'}</span>
      </button>
      {menuOpen ? (
        <div id="mobile-navigation" className="site-nav-sheet">
          <a href="#/" onClick={() => setMenuOpen(false)}>Home</a>
          {futureRoutes.map((route) => (
            <a key={route} href={`#/${route.toLowerCase()}`} onClick={() => setMenuOpen(false)}>{route}</a>
          ))}
        </div>
      ) : null}
    </nav>
  )
}
