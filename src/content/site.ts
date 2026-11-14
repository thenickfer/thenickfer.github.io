export type ContactLink = {
  label: string
  href: string
  priority?: 'primary' | 'default'
}

export type Organization = {
  name: string
  logo?: string
  website?: string
}

export type Education = {
  institution: Organization
  degree: string
  status: string
  period: string
  gpa?: string
}

export type FocusArea = {
  title: string
  description: string
}

export type ExperienceResearchEntry = {
  type: 'experience' | 'research'
  organization: Organization
  role?: string
  dates?: string
  focusAreas: FocusArea[]
  description?: string
}

export type SiteContent = {
  profile: {
    name: string
    biography: string
    photo?: string
  }
  contacts: ContactLink[]
  researchInterests: string[]
  education: Education[]
  experienceResearch: ExperienceResearchEntry[]
  publications: unknown[]
  projects: unknown[]
}

export const siteContent: SiteContent = {
  profile: {
    name: 'Nícolas da Costa Ferreira',
    photo: '/images/profile.png',
    biography:
      'I am a Computer Science undergraduate at PUCRS. I work as a Researcher and Software Engineering Intern at the Laboratório de Inovação em Software (LiS), in the HP/PUCRS partnership, and research systems reliability, embedded systems, and error correction codes with NSESD. My technical interests include reliable systems, distributed computing, software engineering, AI, DevOps, infrastructure, and developer tooling.',
  },
  contacts: [
    { label: 'Academic email', href: 'mailto:nicolas.ferreira002@edu.pucrs.br', priority: 'primary' },
    { label: 'Professional email', href: 'mailto:nicolas.dcferreira@gmail.com' },
    { label: 'GitHub', href: 'https://github.com/thenickfer' },
    { label: 'LinkedIn', href: 'https://www.linkedin.com/in/n%C3%ADcolas-ferreira-156116325/' },
  ],
  researchInterests: [
    'Systems',
    'Distributed Computing',
    'Software Engineering',
    'AI',
    'DevOps',
    'Infrastructure',
    'Systems Reliability',
    'Embedded Systems',
    'Error Correction Codes (ECC)',
  ],
  education: [
    {
      institution: {
        name: 'PUCRS — Pontifícia Universidade Católica do Rio Grande do Sul',
        logo: '/logos/pucrs.svg',
        website: 'https://www.pucrs.br/',
      },
      degree: 'BSc in Computer Science',
      status: 'In progress',
      period: 'Expected graduation: December 2027',
      gpa: '9.1/10',
    },
  ],
  experienceResearch: [
    {
      type: 'experience',
      organization: {
        name: 'LiS · HP/PUCRS — Laboratório de Inovação em Software',
        website: 'https://www.politecnica.pucrs.br/laboratorios/lis/',
      },
      role: 'Researcher & Software Engineering Intern',
      focusAreas: [
        {
          title: 'AI Research & Development',
          description: 'I work with natural language processing, semantic text classification, text embeddings, similarity-based approaches, LLM applications and workflows, computer vision, and AI datasets.',
        },
        {
          title: 'Software Engineering & Infrastructure',
          description: 'I work with cloud and infrastructure engineering, developer tooling and CI/CD, distributed software systems, and backend and full-stack development.',
        },
      ],
    },
    {
      type: 'research',
      organization: {
        name: 'NSESD · PUCRS',
        website: 'https://nsesd.pucrs.br/en/',
      },
      role: 'Research affiliation',
      focusAreas: [
        {
          title: 'Research areas',
          description: 'I research systems reliability, embedded systems, and error correction codes (ECC).',
        },
      ],
    },
  ],
  publications: [],
  projects: [],
}
