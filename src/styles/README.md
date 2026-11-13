# Styles and design tokens

- `tokens.css` is the canonical source of design-token values using CSS custom properties.
- `tokens.ts` exposes typed references to CSS custom properties for TypeScript usage.
- `global.css` imports Tailwind and tokens, maps Tailwind theme variables to canonical tokens, and defines global base styles.

Do not duplicate concrete token values across CSS and TypeScript.
