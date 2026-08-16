import { useId } from 'react'

/**
 * Maia's identity mark: four overlapping petals around a warm center.
 * Reads as a soft bloom / aperture — no robots, sparkles, or bubbles.
 */
export function MaiaMark({
  size = 24,
  thinking = false,
  className = '',
}: {
  size?: number
  thinking?: boolean
  className?: string
}) {
  const id = useId()
  return (
    <span
      className={`maia-mark${thinking ? ' maia-mark--thinking' : ''} ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 32 32" width={size} height={size}>
        <defs>
          <radialGradient id={id} cx="50%" cy="36%" r="75%">
            <stop offset="0%" stopColor="var(--mark-light)" />
            <stop offset="55%" stopColor="var(--mark-mid)" />
            <stop offset="100%" stopColor="var(--mark-deep)" />
          </radialGradient>
        </defs>
        <g className="maia-mark__petals" style={{ transformOrigin: '16px 16px' }}>
          <circle cx="16" cy="9.6" r="7" fill={`url(#${id})`} opacity="0.62" />
          <circle cx="22.4" cy="16" r="7" fill={`url(#${id})`} opacity="0.62" />
          <circle cx="16" cy="22.4" r="7" fill={`url(#${id})`} opacity="0.62" />
          <circle cx="9.6" cy="16" r="7" fill={`url(#${id})`} opacity="0.62" />
        </g>
        <circle className="maia-mark__core" cx="16" cy="16" r="2.6" fill="var(--mark-core)" style={{ transformOrigin: '16px 16px' }} />
      </svg>
    </span>
  )
}
