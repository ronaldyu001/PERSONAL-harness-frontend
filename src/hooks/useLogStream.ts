import { useCallback, useEffect, useState } from 'react'
import type { ReadLogStream } from '../application/observability/read_log_stream'
import type { LogStream, LogStreamId } from '../application/observability/schemas'

const READ_FAILED = 'Could not read that log.'

const isAbortError = (error: unknown) =>
  error instanceof DOMException && error.name === 'AbortError'

/**
 * Reads one log stream and follows the reader between streams.
 *
 * The seeded adapter answers immediately, but the states are the ones a real
 * read needs — loading, error, and a retry — because the transport behind the
 * port is going to become an HTTP call and this hook should not have to change
 * when it does.
 */
export function useLogStream(reader: ReadLogStream, stream: LogStreamId) {
  const [data, setData] = useState<LogStream | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    let settled = false

    /* Reading remote data on mount sets state by definition, and switching
       streams has to clear the last one's outcome before the next read lands.
       Every write below is guarded by the abort signal — the same trade the
       conversation history read makes in App. */
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    setError(null)

    reader
      .execute({ stream, signal: controller.signal })
      .then((result) => {
        if (controller.signal.aborted) return
        settled = true
        setData(result)
      })
      .catch((cause: unknown) => {
        if (isAbortError(cause)) return
        settled = true
        setError(READ_FAILED)
      })
      .finally(() => {
        if (settled) setLoading(false)
      })

    return () => controller.abort()
  }, [attempt, reader, stream])

  const retry = useCallback(() => setAttempt((value) => value + 1), [])

  return { data, error, loading, retry }
}
