import type { TurnUsage } from '../types'

/**
 * What a turn cost, read from whatever the provider reported.
 *
 * The backend hands back `usage_metadata` when LangChain has it and falls back
 * to the provider's own `token_usage`, so two key styles reach the frontend
 * and neither is guaranteed. Reading is tolerant and never invents: a count
 * that is not in the payload is absent, not zero, because zero is a reading
 * and absent is the truth.
 */

const number = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined

const first = (source: Record<string, unknown>, keys: string[]): number | undefined => {
  for (const key of keys) {
    const value = number(source[key])
    if (value !== undefined) return value
  }
  return undefined
}

export function readUsage(raw: Record<string, unknown> | undefined): TurnUsage | undefined {
  if (!raw) return undefined

  const input = first(raw, ['input_tokens', 'prompt_tokens'])
  const output = first(raw, ['output_tokens', 'completion_tokens'])
  const reported = first(raw, ['total_tokens'])
  const total = reported ?? (input !== undefined || output !== undefined
    ? (input ?? 0) + (output ?? 0)
    : undefined)

  if (input === undefined && output === undefined && total === undefined) return undefined
  return { input, output, total }
}

/** Adds the turns that reported anything; conversations mix old turns and new. */
export function sumUsage(turns: (TurnUsage | undefined)[]): TurnUsage & { counted: number } {
  let input = 0
  let output = 0
  let total = 0
  let counted = 0

  for (const usage of turns) {
    if (!usage) continue
    counted += 1
    input += usage.input ?? 0
    output += usage.output ?? 0
    total += usage.total ?? (usage.input ?? 0) + (usage.output ?? 0)
  }

  return { input, output, total, counted }
}

/** A turn's wall clock, in the same voice the elapsed readout uses. */
export function formatDuration(ms: number): string {
  const seconds = ms / 1000
  if (seconds < 10) return `${seconds.toFixed(1)}s`
  if (seconds < 60) return `${Math.round(seconds)}s`
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${String(Math.round(seconds - minutes * 60)).padStart(2, '0')}`
}
