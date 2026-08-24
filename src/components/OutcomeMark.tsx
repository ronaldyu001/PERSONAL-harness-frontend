import { Check, CircleAlert, CircleSlash, RefreshCw } from 'lucide-react'
import type { Outcome, OutcomeTone } from '../lib/log_format'

const ICONS = {
  pass: Check,
  work: RefreshCw,
  fail: CircleAlert,
  rest: CircleSlash,
} as const satisfies Record<OutcomeTone, typeof Check>

/**
 * What happened, said twice.
 *
 * Semantic colour is demoted throughout Maia — text and icon only, never a
 * filled chip or a tinted row — so an outcome is a word and a mark in one
 * tone. Both carry the meaning, which is what keeps the state legible when
 * colour is not available to the reader.
 */
export function OutcomeMark({
  outcome,
  size = 13,
  className,
}: {
  outcome: Outcome
  size?: number
  className?: string
}) {
  const Icon = ICONS[outcome.tone]
  return (
    <span className={`outcome outcome--${outcome.tone}${className ? ` ${className}` : ''}`}>
      <Icon size={size} strokeWidth={1.8} aria-hidden="true" />
      {outcome.label}
    </span>
  )
}
