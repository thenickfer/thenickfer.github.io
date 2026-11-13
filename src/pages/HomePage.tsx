import type { MouseEvent } from 'react'

import { GrainGradientBackground } from '../components/GrainGradientBackground'
import { LiquidSigil } from '../components/LiquidSigil'
import { SectionHeading } from '../components/SectionHeading'
import { SiteNav } from '../components/SiteNav'

function HomePage() {
  const scrollToWork = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()
    document.getElementById('work')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="page-grid min-h-dvh">
      <SiteNav />
      <main>
        <section className="hero-shell pb-20 pt-12 sm:pb-28 sm:pt-20">
          <GrainGradientBackground />
          <div className="hero-dither" />
          <div className="content-wrap hero-content">
            <LiquidSigil size={240} className="hero-sigil" />
            <div className="plate max-w-4xl rounded-md p-6 sm:p-10">
              <p className="motion-enter mb-6 font-mono text-xs uppercase tracking-[0.18em] text-text-primary">Computer science · PUCRS</p>
              <h1 className="hero-title max-w-4xl text-display text-text-primary">
                Nícolas da
                <br />
                Costa Ferreira
              </h1>
              <p className="motion-enter motion-enter-delay-1 mt-8 max-w-xl text-lg leading-relaxed text-text-primary/90 sm:text-xl">
                I work between software engineering, dependable systems, and research — building a clearer understanding of how technical systems behave.
              </p>
              <div className="motion-enter motion-enter-delay-2 mt-8 flex flex-wrap gap-3">
                <a className="rounded-md bg-accent px-5 py-3 font-medium text-surface-sunk transition-transform duration-100 hover:-translate-y-0.5 active:scale-[0.97]" href="#/" onClick={scrollToWork}>
                  Current work
                </a>
                <a className="rounded-md border border-text-primary/30 px-5 py-3 font-medium text-text-primary transition-colors duration-100 hover:border-accent hover:text-accent" href="https://github.com/thenickfer" target="_blank" rel="noreferrer">
                  GitHub profile <span aria-hidden="true">↗</span>
                </a>
              </div>
            </div>
          </div>
        </section>

        <section id="overview" className="content-wrap grid gap-8 border-t border-border py-20 sm:grid-cols-[0.8fr_1.2fr] sm:py-28">
          <SectionHeading eyebrow="01 / overview" title="Engineering with a researcher's attention to failure." />
          <div className="space-y-5 text-lg leading-relaxed text-text-secondary">
            <p>I am a Computer Science undergraduate interested in the boundary between software and the systems that make it dependable.</p>
            <p>That means moving from implementation details to infrastructure, embedded behavior, and the methods we use to understand errors before they become incidents.</p>
          </div>
        </section>

        <section id="work" className="content-wrap border-t border-border py-20 sm:py-28">
          <SectionHeading eyebrow="02 / work" title="Two places to study systems from different angles." />
          <div className="grid gap-4 md:grid-cols-2">
            <article className="rounded-lg border border-border bg-surface p-6 sm:p-8">
              <p className="mb-8 font-mono text-xs uppercase tracking-[0.16em] text-accent">Professional · current</p>
              <h3 className="text-3xl font-semibold text-text-primary">LiS</h3>
              <p className="mt-4 leading-relaxed text-text-secondary">AI and software R&amp;D at LiS, within the PUCRS / HP context.</p>
            </article>
            <article className="rounded-lg border border-border bg-surface p-6 sm:p-8">
              <p className="mb-8 font-mono text-xs uppercase tracking-[0.16em] text-accent">Research · current</p>
              <h3 className="text-3xl font-semibold text-text-primary">NSESD</h3>
              <p className="mt-4 leading-relaxed text-text-secondary">Research at PUCRS in systems reliability, embedded systems, and error-correction codes.</p>
            </article>
          </div>
        </section>

        <section id="projects" className="content-wrap border-t border-border py-20 sm:py-28">
          <SectionHeading eyebrow="03 / selected work" title="A small record, built carefully." />
          <article className="max-w-3xl border-l-2 border-accent pl-5 sm:pl-8">
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-text-secondary">In progress · this site</p>
            <h3 className="mt-3 text-3xl font-semibold text-text-primary">Portfolio foundation</h3>
            <p className="mt-4 max-w-2xl leading-relaxed text-text-secondary">A living space for the technical work, research context, and writing that will be added here over time.</p>
          </article>
        </section>

        <section id="contact" className="content-wrap border-t border-border py-20 sm:py-28">
          <div className="rounded-lg bg-surface-sunk p-6 sm:p-10">
            <p className="mb-3 font-mono text-xs uppercase tracking-[0.18em] text-accent">04 / contact</p>
            <h2 className="max-w-2xl text-4xl font-semibold leading-tight text-text-primary sm:text-5xl">For systems, software, and research conversations.</h2>
            <a className="mt-8 inline-flex items-center gap-2 font-mono text-sm uppercase tracking-[0.12em] text-accent underline decoration-accent/40 underline-offset-8 hover:decoration-accent" href="https://github.com/thenickfer" target="_blank" rel="noreferrer">
              GitHub / thenickfer <span aria-hidden="true">↗</span>
            </a>
          </div>
        </section>
      </main>
      <footer className="content-wrap flex flex-col gap-3 border-t border-border py-8 text-sm text-text-secondary sm:flex-row sm:items-center sm:justify-between">
        <p>© {new Date().getFullYear()} Nícolas da Costa Ferreira</p>
        <p className="font-mono text-xs uppercase tracking-[0.14em]">Research lab × engineering × editorial</p>
      </footer>
    </div>
  )
}

export { HomePage }
