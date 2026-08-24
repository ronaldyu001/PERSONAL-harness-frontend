import type { GateDecision, LogEvent, TokenUsage } from '../application/observability/schemas'

/**
 * Reading helpers for log records.
 *
 * A log is read at two speeds: scanned down a ledger and then read in full.
 * Everything here serves the first — short, aligned, and stable in width, so
 * a column of them reads as a column rather than as ragged prose.
 */

const CLOCK = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
})

const DAY = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' })

const STAMP = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'medium',
})

export const formatClock = (timestamp: string) => CLOCK.format(new Date(timestamp))

export const formatDay = (timestamp: string) => DAY.format(new Date(timestamp))

export const formatStamp = (timestamp: string) => STAMP.format(new Date(timestamp))

/** Enough of a UUID to tell two apart, which is all a ledger needs. */
export const shortId = (id: string | null) => (id ? id.slice(0, 8) : '—')

export const formatCount = (value: number) => value.toLocaleString()

/** Total tokens if the provider reported any; the log stores nothing else. */
export function totalTokens(usage: TokenUsage | null): number | null {
  if (!usage) return null
  if (typeof usage.total_tokens === 'number') return usage.total_tokens
  const input = usage.input_tokens ?? 0
  const output = usage.output_tokens ?? 0
  const total = input + output
  return total > 0 ? total : null
}

/**
 * How an outcome reads.
 *
 * Semantic colour stays on text and icons — no filled chips, no tinted rows —
 * so the tone here names a text colour and never a background. Every state
 * also carries its own word and its own icon: colour is never the only thing
 * saying what happened.
 */
export type OutcomeTone = 'pass' | 'work' | 'fail' | 'rest'

export interface Outcome {
  label: string
  tone: OutcomeTone
  /** What the decision meant for the turn, in one line, for the inspector. */
  meaning: string
}

const DECISIONS: Record<GateDecision, Outcome> = {
  allow: {
    label: 'Allow',
    tone: 'pass',
    meaning: 'The candidate passed and went to the reader unchanged.',
  },
  retry: {
    label: 'Retry',
    tone: 'work',
    meaning: 'The candidate was sent back with feedback for another attempt.',
  },
  fallback: {
    label: 'Fallback',
    tone: 'fail',
    meaning: 'Repair ran out of attempts, so the gate replaced the answer.',
  },
  allow_on_error: {
    label: 'Allow on error',
    tone: 'fail',
    meaning: 'The gate itself failed. The turn was let through unevaluated.',
  },
}

export const decisionOutcome = (decision: GateDecision): Outcome => DECISIONS[decision]

export function statusOutcome(status: 'success' | 'error' | null): Outcome {
  if (status === 'success') {
    return { label: 'Success', tone: 'pass', meaning: 'The model returned a response.' }
  }
  if (status === 'error') {
    return {
      label: 'Error',
      tone: 'fail',
      meaning: 'The request was logged and the call raised before completing.',
    }
  }
  return { label: 'Unrecorded', tone: 'rest', meaning: 'The call did not record an outcome.' }
}

export const outcomeOf = (event: LogEvent): Outcome =>
  event.event === 'response_gate' ? decisionOutcome(event.decision) : statusOutcome(event.status)

/** Message-type labels as the serializer writes them. */
const ROLES: Record<string, string> = {
  system: 'System',
  human: 'Human',
  ai: 'Assistant',
  tool: 'Tool',
}

export const roleLabel = (type: string) => ROLES[type] ?? type
