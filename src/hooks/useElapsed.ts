import { useEffect, useState } from 'react'

/**
 * Seconds elapsed since `startedAt`, ticking while `running`.
 *
 * The thinking state shows elapsed rather than progress: the backend returns a
 * single complete response, so there is no position to report and any bar
 * would be fiction. An instrument reports real values.
 */
export function useElapsed(startedAt: number | undefined, running: boolean): number {
  const [seconds, setSeconds] = useState(() =>
    startedAt ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000)) : 0,
  )

  useEffect(() => {
    if (!running || !startedAt) return
    const tick = () => setSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)))
    tick()
    const timer = window.setInterval(tick, 1000)
    return () => window.clearInterval(timer)
  }, [running, startedAt])

  return seconds
}

export function formatElapsed(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return `${minutes}:${String(rest).padStart(2, '0')}`
}
