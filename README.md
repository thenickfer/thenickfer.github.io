# thenickfer.github.io

Production-ready foundation for a personal academic and professional portfolio, built with React, TypeScript, Vite, Tailwind CSS v4, and GitHub Pages.

This repository intentionally includes infrastructure and conventions only. It does **not** implement portfolio pages, sections, or final visual design.

## Stack

- React
- TypeScript (strict)
- Vite
- Tailwind CSS v4 (official Vite plugin)
- ESLint
- GitHub Actions + GitHub Pages

## Repository structure

```text
.
├── .github/workflows/deploy.yml
├── public/
├── src/
│   ├── assets/
│   ├── components/
│   ├── hooks/
│   ├── lib/
│   ├── styles/
│   │   ├── global.css
│   │   ├── tokens.css
│   │   ├── tokens.ts
│   │   └── README.md
│   ├── types/
│   ├── App.tsx
│   └── main.tsx
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## Local development

```bash
npm install
npm run dev
```

## Updating portfolio content

All landing-page content is defined in `src/content/site.ts`. React components render the arrays there, so adding an entry does not require editing the page layout.

```ts
education: [
  {
    institution: { name: 'University name', logo: '/logos/university.svg', website: 'https://example.edu' },
    degree: 'Degree name',
    status: 'In progress',
    period: 'Expected graduation: June 2028',
    gpa: '9.0/10',
  },
]
```

Add professional roles and research affiliations to the `experienceResearch` array. Set `type` to `experience` or `research`, then provide the organization, optional role and dates, and one or more `focusAreas` with a title and concise description. Add official organization artwork under `public/logos/`, then reference it with a root-relative path such as `/logos/laboratory.svg`. The optional profile photograph belongs at `public/images/profile.jpg`; no component change is needed when it is added.

## Available scripts

- `npm run dev` — run local Vite dev server
- `npm run build` — type-check then build production bundle
- `npm run preview` — preview production build locally
- `npm run lint` — run ESLint
- `npm run typecheck` — run TypeScript project references check

## Design-token architecture

- **Canonical source:** `src/styles/tokens.css`
  - Holds design-token values as CSS custom properties.
  - All values are explicit placeholders marked with `TODO` plus valid fallback values.
- **TypeScript reference layer:** `src/styles/tokens.ts`
  - Exposes typed `var(--...)` references for React inline styles and TS utilities.
  - Does not duplicate raw token values.
- **Global integration:** `src/styles/global.css`
  - Imports Tailwind and canonical tokens.
  - Maps Tailwind theme variables to canonical token properties.
  - Defines global base/reset rules.

## Tailwind + token relationship

Tailwind semantic utilities map directly to canonical tokens via `@theme` in `global.css`.

Example future usage:

- `bg-background` → `--ds-color-background`
- `text-text-primary` → `--ds-color-text-primary`
- `border-border` → `--ds-color-border`

Token changes in `tokens.css` propagate to both CSS and Tailwind utilities automatically.

## Component styling conventions

- Build reusable components in `src/components` with explicit typed props.
- Prefer Tailwind utilities for styling.
- Use CSS Modules only when component-level complexity requires them.

## CI/CD (GitHub Pages)

Workflow: `.github/workflows/deploy.yml`

- **Build job**
  - Checkout repository
  - Setup latest LTS Node.js with npm cache
  - `npm ci`
  - `npm run lint`
  - `npm run typecheck`
  - `npm run build`
  - Upload `dist/` with `actions/upload-pages-artifact`
- **Deploy job**
  - Runs after successful build
  - Uses `actions/deploy-pages`
  - Publishes to `github-pages` environment with deployment URL

Workflow triggers:

- Push to `main`
- Manual `workflow_dispatch`

## Required GitHub repository setting

In repository settings, configure **Pages** deployment source to **GitHub Actions**.
