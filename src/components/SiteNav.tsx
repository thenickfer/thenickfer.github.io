import { StarMark } from './StarMark'
import { useEffect, useState } from 'react'
import { useLenis } from 'lenis/react'

const navigation = [
  { label: 'Home', href: '#/' },
  { label: 'Work', href: '#work' },
  { label: 'Contact', href: '#contact' },
]

export function SiteNav() {
  const [menuOpen, setMenuOpen] = useState(false)
  const lenis = useLenis()

  useEffect(() => {
    if (!lenis) return
    if (menuOpen) lenis.stop()
    else lenis.start()
    return () => lenis.start()
  }, [lenis, menuOpen])

  return (
    <nav aria-label="Primary navigation" className="site-nav content-wrap">
      <a className="flex items-center gap-3 text-sm font-semibold tracking-wide text-text-primary" href="#/" aria-label="Home">
        <StarMark className="h-4 w-4 text-accent" />
        <span>NCF / portfolio</span>
      </a>
      <div className="site-nav-links">
        {navigation.map((item) => (
          <a key={item.label} className="font-mono text-xs uppercase tracking-[0.14em] text-accent" href={item.href}>{item.label}</a>
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
        <div id="mobile-navigation" className="site-nav-sheet" data-lenis-prevent>
          {navigation.map((item) => (
            <a key={item.label} href={item.href} onClick={() => setMenuOpen(false)}>{item.label}</a>
          ))}
        </div>
      ) : null}
    </nav>
  )
}
