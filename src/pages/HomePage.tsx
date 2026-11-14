import { OrganizationLogo } from '../components/OrganizationLogo'
import { GrainGradientBackground } from '../components/GrainGradientBackground'
import { LiquidSigil } from '../components/LiquidSigil'
import { SectionHeading } from '../components/SectionHeading'
import { SiteNav } from '../components/SiteNav'
import { siteContent } from '../content/site'

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  const external = href.startsWith('http')
  return (
    <a href={href} target={external ? '_blank' : undefined} rel={external ? 'noreferrer' : undefined}>
      {children}
    </a>
  )
}

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

        <section id="profile" className="content-wrap border-t border-border py-20 sm:py-28">
          <SectionHeading eyebrow="01 / Profile" title="Profile" />
          <div className="grid gap-8 md:grid-cols-[minmax(12rem,18rem)_1fr] md:items-start">
            {siteContent.profile.photo ? (
              <div className="profile-photo-wrap">
                <img className="profile-photo" src={siteContent.profile.photo} alt={`Portrait of ${siteContent.profile.name}`} />
              </div>
            ) : null}
            <div>
              <p className="max-w-3xl text-lg leading-relaxed text-text-secondary">{siteContent.profile.biography}</p>
              <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 font-mono text-xs uppercase tracking-[0.12em] text-accent">
                {siteContent.contacts.map((contact) => (
                  <ExternalLink key={contact.href} href={contact.href}>{contact.label} <span aria-hidden="true">↗</span></ExternalLink>
                ))}
              </div>
            </div>
          </div>
        </section>

        {siteContent.researchInterests.length > 0 ? <section id="research" className="content-wrap border-t border-border py-20 sm:py-28">
          <SectionHeading eyebrow="02 / Research" title="Research interests" />
          <p className="max-w-4xl text-xl leading-relaxed text-text-secondary">
            {siteContent.researchInterests.join(' · ')}
          </p>
        </section> : null}

        {siteContent.education.length > 0 ? <section id="education" className="content-wrap border-t border-border py-20 sm:py-28">
          <SectionHeading eyebrow="03 / Education" title="Education" />
          <div className="grid gap-4">
            {siteContent.education.map((item) => (
              <article key={`${item.institution.name}-${item.degree}`} className="grid gap-6 rounded-lg border border-border bg-surface p-6 sm:grid-cols-[auto_1fr] sm:p-8">
                <OrganizationLogo src={item.institution.logo} alt={item.institution.name} size="large" />
                <div>
                  <h3 className="text-2xl font-semibold text-text-primary">{item.institution.website ? <ExternalLink href={item.institution.website}>{item.institution.name}</ExternalLink> : item.institution.name}</h3>
                  <p className="mt-3 text-lg text-text-primary">{item.degree}</p>
                  <p className="mt-2 text-text-secondary">{item.status} · {item.period}</p>
                  {item.gpa ? <p className="mt-2 font-mono text-sm uppercase tracking-[0.1em] text-accent">GPA {item.gpa}</p> : null}
                </div>
              </article>
            ))}
          </div>
        </section> : null}

        {siteContent.experienceResearch.length > 0 ? <section id="work" className="content-wrap border-t border-border py-20 sm:py-28">
          <SectionHeading eyebrow="04 / Experience & Research" title="Experience & Research" />
          <div className="grid gap-4">
            {siteContent.experienceResearch.map((item) => (
              <article key={`${item.organization.name}-${item.role ?? item.type}`} className="rounded-lg border border-border bg-surface p-6 sm:p-8">
                <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-mono text-xs uppercase tracking-[0.16em] text-accent">
                      {item.type === 'experience' ? 'Professional experience' : 'Research affiliation'}
                    </p>
                    <h3 className="mt-4 text-3xl font-semibold text-text-primary">
                      {item.organization.website ? <ExternalLink href={item.organization.website}>{item.organization.name} <span aria-hidden="true">↗</span></ExternalLink> : item.organization.name}
                    </h3>
                    {item.role ? <p className="mt-3 text-lg text-text-primary">{item.role}</p> : null}
                    {item.dates ? <p className="mt-2 text-text-secondary">{item.dates}</p> : null}
                  </div>
                  <OrganizationLogo src={item.organization.logo} alt={item.organization.name} size="small" />
                </div>
                {item.description ? <p className="mt-6 leading-relaxed text-text-secondary">{item.description}</p> : null}
                <div className="mt-8 grid gap-6 md:grid-cols-2">
                  {item.focusAreas.map((area) => (
                    <div key={area.title}>
                      <h4 className="font-mono text-xs uppercase tracking-[0.12em] text-accent">{area.title}</h4>
                      <p className="mt-3 leading-relaxed text-text-secondary">{area.description}</p>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section> : null}

        <section id="contact" className="content-wrap border-t border-border py-20 sm:py-28">
          <div className="rounded-lg bg-surface-sunk p-6 sm:p-10">
            <SectionHeading eyebrow="06 / Contact" title="Contact" />
            <p className="max-w-2xl leading-relaxed text-text-secondary">The best way to reach me is through my academic email.</p>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {siteContent.contacts.map((contact) => (
                <a key={contact.href} className={`contact-link font-mono text-sm uppercase tracking-[0.12em] underline decoration-accent/40 underline-offset-8 ${contact.priority === 'primary' ? 'text-accent' : 'text-text-primary'}`} href={contact.href}>
                  {contact.label} <span aria-hidden="true">↗</span>
                </a>
              ))}
            </div>
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
