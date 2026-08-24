/**
 * Maia's identity mark: four overlapping petals around a warm center.
 * Reads as a soft bloom / aperture, no robots, sparkles, or bubbles.
 *
 * Rendered in flat tones. The incumbent drew the petals with a radial
 * gradient; this world has none, so the depth comes from overlap and
 * opacity instead of a ramp.
 */
export function MaiaMark({
  size = 24,
  thinking = false,
  className = '',
  /* Drop the intrinsic size and take whatever the caller's box is. The mark
     is drawn on a 32-unit grid, so it scales to any of them. */
  fill = false,
}: {
  size?: number
  thinking?: boolean
  className?: string
  fill?: boolean
}) {
  return (
    <span
      className={`maia-mark${thinking ? ' maia-mark--thinking' : ''} ${className}`}
      style={fill ? undefined : { width: size, height: size }}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 32 32"
        width={fill ? '100%' : size}
        height={fill ? '100%' : size}
      >
        <g className="maia-mark__petals" style={{ transformOrigin: '16px 16px' }}>
          <circle cx="16" cy="9.6" r="7" fill="var(--mark-mid)" opacity="0.55" />
          <circle cx="22.4" cy="16" r="7" fill="var(--mark-mid)" opacity="0.55" />
          <circle cx="16" cy="22.4" r="7" fill="var(--mark-mid)" opacity="0.55" />
          <circle cx="9.6" cy="16" r="7" fill="var(--mark-mid)" opacity="0.55" />
        </g>
        <circle
          className="maia-mark__core"
          cx="16"
          cy="16"
          r="2.6"
          fill="var(--mark-core)"
          style={{ transformOrigin: '16px 16px' }}
        />
      </svg>
    </span>
  )
}
