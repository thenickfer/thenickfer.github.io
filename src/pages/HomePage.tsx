import { GrainGradientBackground } from '../components/GrainGradientBackground'
import { LiquidSigil } from '../components/LiquidSigil'
import { SectionHeading } from '../components/SectionHeading'
import { SiteNav } from '../components/SiteNav'

function HomePage() {
  return (
    <div className="page-grid min-h-dvh">
      <main>
        <section className="hero-shell">
          <GrainGradientBackground />
          <div className="hero-dither" />
          <SiteNav />
          <div className="content-wrap hero-content">
            <LiquidSigil size={240} className="hero-sigil" />
            <div className="plate hero-copy max-w-4xl rounded-md p-5 sm:p-10">
              <p className="motion-enter mb-6 font-mono text-xs uppercase tracking-[0.18em] text-text-primary">Computer science · PUCRS</p>
              <h1 className="hero-title max-w-4xl text-text-primary">
                Nícolas da
                <br />
                Costa Ferreira
              </h1>
              <p className="motion-enter motion-enter-delay-1 mt-8 max-w-xl text-lg leading-relaxed text-text-primary/90 sm:text-xl">
                I build software and study reliable systems at PUCRS.
              </p>
              <div className="motion-enter motion-enter-delay-2 mt-6 flex flex-wrap gap-3 sm:mt-8">
                <a className="action-primary rounded-md bg-accent px-5 py-3 font-medium text-ink transition-transform duration-100 active:scale-[0.97]" href="#work">
                  Current work
                </a>
                <a className="action-secondary rounded-md border border-text-primary/30 px-5 py-3 font-medium text-text-primary transition-colors duration-100" href="https://github.com/thenickfer" target="_blank" rel="noreferrer">
                  GitHub profile <span aria-hidden="true">↗</span>
                </a>
              </div>
            </div>
          </div>
        </section>

        <section id="work" className="content-wrap border-t border-border py-20 sm:py-28">
          <SectionHeading title="Work" />
          <div className="grid gap-4 md:grid-cols-2">
            <article className="rounded-lg border border-border bg-surface p-6 sm:p-8">
              <p className="mb-8 font-mono text-xs uppercase tracking-[0.16em] text-accent">LiS · PUCRS / HP</p>
              <h3 className="text-3xl font-semibold text-text-primary">LiS</h3>
              <p className="mt-4 leading-relaxed text-text-secondary">I work on AI and software R&amp;D at LiS within PUCRS / HP.</p>
            </article>
            <article className="rounded-lg border border-border bg-surface p-6 sm:p-8">
              <p className="mb-8 font-mono text-xs uppercase tracking-[0.16em] text-accent">NSESD · PUCRS</p>
              <h3 className="text-3xl font-semibold text-text-primary">NSESD</h3>
              <p className="mt-4 leading-relaxed text-text-secondary">I research systems reliability, embedded systems, and error-correction codes at PUCRS.</p>
            </article>
          </div>
        </section>

        <section id="contact" className="content-wrap border-t border-border py-20 sm:py-28">
          <div className="rounded-lg bg-surface-sunk p-6 sm:p-10">
            <h2 className="max-w-2xl text-4xl font-semibold leading-tight text-text-primary sm:text-5xl">Contact</h2>
            <p className="mt-4 max-w-2xl leading-relaxed text-text-secondary">Contact me through GitHub about systems, software, or research.</p>
            <a className="contact-link mt-8 inline-flex items-center gap-2 font-mono text-sm uppercase tracking-[0.12em] text-accent underline decoration-accent/40 underline-offset-8" href="https://github.com/thenickfer" target="_blank" rel="noreferrer">
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
