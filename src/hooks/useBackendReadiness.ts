import { useCallback, useEffect, useState } from 'react'

export type BackendStartupPhase = 'checking' | 'delayed' | 'ready' | 'error'

const POLL_INTERVAL_MS = 1_000
const REQUEST_TIMEOUT_MS = 3_000
const MINIMUM_DISPLAY_MS = 900
const DELAYED_AFTER_MS = 20_000
const FAIL_AFTER_MS = 15 * 60 * 1_000

const isHealthyPayload = (payload: unknown): payload is { status: 'ok' } =>
  typeof payload === 'object' &&
  payload !== null &&
  'status' in payload &&
  payload.status === 'ok'

export function useBackendReadiness(healthUrl: string) {
  const [phase, setPhase] = useState<BackendStartupPhase>('checking')
  const [attempt, setAttempt] = useState(0)

  const retry = useCallback(() => {
    setPhase('checking')
    setAttempt((current) => current + 1)
  }, [])

  useEffect(() => {
    let stopped = false
    let pollTimer: number | undefined
    let requestController: AbortController | undefined
    const startedAt = Date.now()

    const checkHealth = async () => {
      requestController = new AbortController()
      const requestTimer = window.setTimeout(
        () => requestController?.abort(),
        REQUEST_TIMEOUT_MS,
      )

      try {
        const response = await fetch(healthUrl, {
          cache: 'no-store',
          signal: requestController.signal,
        })
        const payload: unknown = await response.json().catch(() => undefined)

        if (!stopped && response.ok && isHealthyPayload(payload)) {
          const remainingDisplayTime = Math.max(
            0,
            MINIMUM_DISPLAY_MS - (Date.now() - startedAt),
          )
          pollTimer = window.setTimeout(() => {
            if (!stopped) setPhase('ready')
          }, remainingDisplayTime)
          return
        }
      } catch {
        // Connection failures are expected while the local stack is starting.
      } finally {
        window.clearTimeout(requestTimer)
      }

      if (stopped) return

      const elapsed = Date.now() - startedAt
      if (elapsed >= FAIL_AFTER_MS) {
        setPhase('error')
        return
      }
      if (elapsed >= DELAYED_AFTER_MS) {
        setPhase('delayed')
      }

      pollTimer = window.setTimeout(checkHealth, POLL_INTERVAL_MS)
    }

    void checkHealth()

    return () => {
      stopped = true
      requestController?.abort()
      window.clearTimeout(pollTimer)
    }
  }, [attempt, healthUrl])

  return { phase, retry }
}
