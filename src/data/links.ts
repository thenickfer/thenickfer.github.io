import { siteContent } from '../content/site.ts'

export const LINKS_AVOID_SELECTOR = '[data-links-avoid]'

export interface LinkEntry {
  /** Visible link title. */
  label: string
  /** Destination URL or route. */
  href: string
  /** Optional short supporting text. */
  description?: string
  /** Whether the destination represents Nícolas's identity on another website (renders rel="me"). */
  isIdentityLink?: boolean
}

const githubContact = siteContent.contacts.find((contact) => contact.label === 'GitHub')
const linkedinContact = siteContent.contacts.find((contact) => contact.label === 'LinkedIn')

export const personalLinks: readonly LinkEntry[] = [
  {
    label: 'Main page',
    href: '#/',
    description: 'My main page with current work and engineering background.',
    isIdentityLink: false,
  },
  {
    label: githubContact?.label ?? 'GitHub',
    href: githubContact?.href ?? 'https://github.com/thenickfer',
    description: 'Repositories and software engineering work (@thenickfer).',
    isIdentityLink: Boolean(githubContact?.identity ?? true),
  },
  {
    label: linkedinContact?.label ?? 'LinkedIn',
    href: linkedinContact?.href ?? 'https://www.linkedin.com/in/n%C3%ADcolas-ferreira-156116325/',
    description: 'Professional profile and academic background.',
    isIdentityLink: Boolean(linkedinContact?.identity ?? true),
  },
]

export default personalLinks
