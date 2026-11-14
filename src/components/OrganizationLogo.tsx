type OrganizationLogoProps = {
  src?: string
  alt: string
  size?: 'small' | 'large'
}

export function OrganizationLogo({ src, alt, size = 'small' }: OrganizationLogoProps) {
  if (!src) return null

  return (
    <div className={`logo-frame logo-frame-${size}`}>
      <img src={src} alt={`${alt} logo`} />
    </div>
  )
}
