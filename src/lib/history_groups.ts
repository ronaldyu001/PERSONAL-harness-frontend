import type { HistoryGroup } from '../types'

const DAY_MS = 24 * 60 * 60 * 1000

/** Midnight of the given instant, in the reader's own timezone. */
function startOfLocalDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

/**
 * Bucket a conversation by when it was last active. Bucketing is presentation:
 * the backend sends instants, and the reader's calendar decides the label.
 */
export function historyGroup(lastUpdated: string | undefined, now = new Date()): HistoryGroup {
  if (!lastUpdated) return 'today'

  const updated = new Date(lastUpdated)
  if (Number.isNaN(updated.getTime())) return 'today'

  const daysApart = Math.round((startOfLocalDay(now) - startOfLocalDay(updated)) / DAY_MS)

  /* A clock skew that puts a conversation in the future still reads as today
     rather than falling through to the oldest bucket. */
  if (daysApart <= 0) return 'today'
  if (daysApart === 1) return 'yesterday'
  if (daysApart < 7) return 'week'
  return 'older'
}
