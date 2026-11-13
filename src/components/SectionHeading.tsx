type SectionHeadingProps = {
  eyebrow?: string
  title: string
  id?: string
}

export function SectionHeading({ eyebrow, title, id }: SectionHeadingProps) {
  return (
    <header id={id} className="mb-8 max-w-2xl">
      {eyebrow ? <p className="mb-3 font-mono text-xs uppercase tracking-[0.18em] text-accent">{eyebrow}</p> : null}
      <h2 className="text-4xl font-semibold leading-tight text-text-primary sm:text-5xl">{title}</h2>
    </header>
  )
}
