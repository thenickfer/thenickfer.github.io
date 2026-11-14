import { StarMark } from './StarMark'
import { useEffect, useState } from 'react'
import { useLenis } from 'lenis/react'

const navigation = [
  { label: 'Home', href: '#/', target: 'home' },
  { label: 'About', href: '#profile', target: 'profile' },
  { label: 'Research', href: '#research', target: 'research' },
  { label: 'Education', href: '#education', target: 'education' },
  { label: 'Experience', href: '#work', target: 'work' },
  { label: 'Contact', href: '#contact', target: 'contact' },
]

export function SiteNav() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [activeSection, setActiveSection] = useState('home')
  const lenis = useLenis()

  useEffect(() => {
    if (!lenis) return
    if (menuOpen) lenis.stop()
    else lenis.start()
    return () => lenis.start()
  }, [lenis, menuOpen])

  useEffect(() => {
    const sections = navigation
      .map((item) => document.getElementById(item.target))
      .filter((section): section is HTMLElement => section !== null)

    if (sections.length === 0) return

    const updateActiveSection = () => {
      const current = sections
        .filter((section) => section.getBoundingClientRect().top <= window.innerHeight * 0.4 && section.getBoundingClientRect().bottom > 0)
        .at(-1)
      setActiveSection(current?.id ?? 'home')
    }

    const observer = new IntersectionObserver(updateActiveSection, {
      rootMargin: '-68px 0px -55% 0px',
      threshold: [0, 0.1, 0.5],
    })

    sections.forEach((section) => observer.observe(section))
    updateActiveSection()

    return () => observer.disconnect()
  }, [])

  const handleNavigation = (event: React.MouseEvent<HTMLAnchorElement>, item: typeof navigation[number]) => {
    event.preventDefault()
    const target = document.getElementById(item.target)
    if (!target) return

    if (lenis) {
      lenis.scrollTo(target)
    } else {
      target.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
    }

    setMenuOpen(false)
  }

  const navigationLink = (item: typeof navigation[number]) => (
    <a
      key={item.label}
      className={`site-nav-link font-mono text-xs uppercase tracking-[0.14em] ${activeSection === item.target ? 'site-nav-link-active' : ''}`}
      href={item.href}
      aria-current={activeSection === item.target ? 'location' : undefined}
      onClick={(event) => handleNavigation(event, item)}
    >
      {item.label}
    </a>
  )

  return (
    <nav aria-label="Primary navigation" className="site-nav content-wrap">
      <a className="flex items-center gap-3 text-sm font-semibold tracking-wide text-text-primary" href="#/" aria-label="Home">
        <StarMark className="h-4 w-4 text-accent" />
        <span>NCF / portfolio</span>
      </a>
      <div className="site-nav-links">
        {navigation.map(navigationLink)}
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
          {navigation.map(navigationLink)}
        </div>
      ) : null}
    </nav>
  )
}
