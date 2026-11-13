import { StarMark } from './StarMark'

const futureRoutes = ['About', 'Research', 'Projects', 'Experience', 'Contact']

export function SiteNav() {
  return (
    <nav aria-label="Primary navigation" className="content-wrap flex items-center justify-between py-6">
      <a className="flex items-center gap-3 text-sm font-semibold tracking-wide text-text-primary" href="#/" aria-label="Home">
        <StarMark className="h-4 w-4 text-accent" />
        <span>NCF / portfolio</span>
      </a>
      <div className="hidden items-center gap-6 sm:flex">
        <a className="font-mono text-xs uppercase tracking-[0.14em] text-accent" href="#/">Home</a>
        {futureRoutes.map((route) => (
          <span key={route} aria-disabled="true" className="font-mono text-xs uppercase tracking-[0.14em] text-text-secondary/60">
            {route}
          </span>
        ))}
      </div>
    </nav>
  )
}
