import { splitAbbreviations } from '../lib/abbreviations'

interface AbbrProps {
  title: string
  children: React.ReactNode
}

/** Native abbreviation element. The title carries the expansion and the native tooltip. */
export function Abbr({ title, children }: AbbrProps) {
  return <abbr title={title}>{children}</abbr>
}

/** Wraps every glossary abbreviation in the given prose with <abbr title="...">. */
export function Abbreviated({ children }: { children: string }) {
  return (
    <>
      {splitAbbreviations(children).map((part, index) =>
        typeof part === 'string' ? part : <Abbr key={index} title={part.title}>{part.abbr}</Abbr>,
      )}
    </>
  )
}
