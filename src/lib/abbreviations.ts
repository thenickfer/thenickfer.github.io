/**
 * Glossary of abbreviations with a known, verified expansion.
 * Only add a term when the expansion is stated on this site or confirmed by Nícolas.
 * Unknown or ambiguous terms (for example NSESD, HP) stay out of this list.
 */
export const abbreviations: Readonly<Record<string, string>> = {
  'CI/CD': 'Continuous Integration and Continuous Delivery',
  PUCRS: 'Pontifícia Universidade Católica do Rio Grande do Sul',
  LiS: 'Laboratório de Inovação em Software',
  ECC: 'Error Correction Codes',
  LLM: 'Large Language Model',
  AI: 'Artificial Intelligence',
  BSc: 'Bachelor of Science',
  GPA: 'Grade Point Average',
}

export type TextPart = string | { abbr: string; title: string }

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
}

export function abbreviationPattern(glossary: Readonly<Record<string, string>> = abbreviations): RegExp {
  const terms = Object.keys(glossary)
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp)
  return new RegExp(`(?<![\\p{L}\\p{N}_])(${terms.join('|')})(?![\\p{L}\\p{N}_])`, 'gu')
}

const pattern = abbreviationPattern()

/** Splits prose into plain text and glossary abbreviations, whole words only and case-sensitive. */
export function splitAbbreviations(
  text: string,
  glossary: Readonly<Record<string, string>> = abbreviations,
): TextPart[] {
  const matcher = glossary === abbreviations ? pattern : abbreviationPattern(glossary)
  const parts: TextPart[] = []
  let last = 0
  for (const match of text.matchAll(matcher)) {
    const abbr = match[1]!
    const index = match.index ?? 0
    if (index > last) parts.push(text.slice(last, index))
    parts.push({ abbr, title: glossary[abbr]! })
    last = index + abbr.length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}
