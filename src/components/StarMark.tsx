type StarMarkProps = {
  className?: string
}

export function StarMark({ className = '' }: StarMarkProps) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none">
      <path d="M12 1.5 14.5 9.5 22.5 12l-8 2.5-2.5 8-2.5-8-8-2.5 8-2.5L12 1.5Z" fill="currentColor" />
    </svg>
  )
}
