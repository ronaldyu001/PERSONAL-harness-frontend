import { useCallback, useEffect, useState } from 'react'

export type BackendStartupPhase = 'checking' | 'delayed' | 'ready' | 'error'
export type StartupStep =
  | 'waiting-ui'
  | 'checking-docker'
  | 'starting-docker'
  | 'waiting-docker'
  | 'checking-gpu'
  | 'starting-stack'
  | 'waiting-backend'

interface OrchestratorPayload {
  step: StartupStep | 'error'
  message: string
  errorCode?: string
}

interface BackendReadinessOptions {
  healthUrl: string
  orchestratorStartUrl?: string
  orchestratorStatusUrl?: string
  orchestratorCancelUrl?: string
  orchestratorRetryUrl?: string
}

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

const isOrchestratorPayload = (payload: unknown): payload is OrchestratorPayload =>
  typeof payload === 'object' &&
  payload !== null &&
  'step' in payload &&
  typeof payload.step === 'string' &&
  'message' in payload &&
  typeof payload.message === 'string'

export function useBackendReadiness({
  healthUrl,
  orchestratorStartUrl,
  orchestratorStatusUrl,
  orchestratorCancelUrl,
  orchestratorRetryUrl,
}: BackendReadinessOptions) {
  const [phase, setPhase] = useState<BackendStartupPhase>('checking')
  const [step, setStep] = useState<StartupStep>(
    orchestratorStatusUrl ? 'waiting-ui' : 'waiting-backend',
  )
  const [statusMessage, setStatusMessage] = useState<string>()
  const [errorCode, setErrorCode] = useState<string>()
  const [attempt, setAttempt] = useState(0)

  const retry = useCallback(async () => {
    setPhase('checking')
    setStatusMessage(undefined)
    setErrorCode(undefined)
    if (orchestratorRetryUrl) {
      await fetch(orchestratorRetryUrl, { method: 'POST' }).catch(() => undefined)
    }
    setAttempt((current) => current + 1)
  }, [orchestratorRetryUrl])

  const cancel = useCallback(async () => {
    if (orchestratorCancelUrl) {
      await fetch(orchestratorCancelUrl, { method: 'POST' }).catch(() => undefined)
      return
    }
    window.close()
  }, [orchestratorCancelUrl])

  useEffect(() => {
    let stopped = false
    let pollTimer: number | undefined
    let requestController: AbortController | undefined
    const startedAt = Date.now()

    const requestJson = async (url: string) => {
      requestController = new AbortController()
      const requestTimer = window.setTimeout(
        () => requestController?.abort(),
        REQUEST_TIMEOUT_MS,
      )

      try {
        const response = await fetch(url, {
          cache: 'no-store',
          signal: requestController.signal,
        })
        const payload: unknown = await response.json().catch(() => undefined)
        return { payload, response }
      } finally {
        window.clearTimeout(requestTimer)
      }
    }

    const scheduleNextCheck = (check: () => Promise<void>) => {
      pollTimer = window.setTimeout(check, POLL_INTERVAL_MS)
    }

    const checkReadiness = async () => {
      try {
        if (orchestratorStatusUrl) {
          const { payload, response } = await requestJson(orchestratorStatusUrl)
          if (response.ok && isOrchestratorPayload(payload)) {
            if (payload.step === 'error') {
              if (!stopped) {
                setPhase('error')
                setStatusMessage(payload.message)
                setErrorCode(payload.errorCode ?? 'orchestration-failed')
              }
              return
            }

            if (!stopped) {
              setStep(payload.step)
              setStatusMessage(payload.message)
            }
            if (payload.step !== 'waiting-backend') {
              if (!stopped) scheduleNextCheck(checkReadiness)
              return
            }
          } else {
            if (!stopped) scheduleNextCheck(checkReadiness)
            return
          }
        }

        const { payload, response } = await requestJson(healthUrl)
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
        // Connection failures are expected while local services are starting.
      }

      if (stopped) return

      const elapsed = Date.now() - startedAt
      if (elapsed >= FAIL_AFTER_MS) {
        setPhase('error')
        setErrorCode('backend-timeout')
        setStatusMessage('Maia’s local API did not become ready in time.')
        return
      }
      if (elapsed >= DELAYED_AFTER_MS) {
        setPhase('delayed')
      }

      scheduleNextCheck(checkReadiness)
    }

    const start = async () => {
      if (orchestratorStartUrl) {
        await fetch(orchestratorStartUrl, { method: 'POST' }).catch(() => undefined)
      }
      await checkReadiness()
    }

    void start()

    return () => {
      stopped = true
      requestController?.abort()
      window.clearTimeout(pollTimer)
    }
  }, [attempt, healthUrl, orchestratorStartUrl, orchestratorStatusUrl])

  return { cancel, errorCode, phase, retry, statusMessage, step }
}
