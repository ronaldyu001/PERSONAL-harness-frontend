import { useCallback, useEffect, useState } from 'react'
import type { ReadLogStream } from '../application/observability/read_log_stream'
import type { LogStream, LogStreamId } from '../application/observability/schemas'

const READ_FAILED = 'Could not read that trace stream.'

const isAbortError = (error: unknown) =>
  error instanceof DOMException && error.name === 'AbortError'

/**
 * Reads one trace stream and follows the reader between streams.
 *
 * The session and the count are part of the request rather than filtered
 * afterwards: the backend scopes the read, so what arrives is what the ledger
 * shows. Records are held against the request they answered — a stream or a
 * session the reader has since changed is not data about what they are
 * looking at now, and reporting it as such would show one log's records under
 * another one's tab.
 */
export function useLogStream(
  reader: ReadLogStream,
  stream: LogStreamId,
  session: string | null,
  limit: number,
) {
  const [entry, setEntry] = useState<{ key: string; stream: LogStream } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  /* Everything the read is scoped by, in one value: what identifies a result
     is what was asked for, and the reader can change any of it mid-flight. */
  const key = `${stream}::${session ?? ''}::${limit}`

  useEffect(() => {
    const controller = new AbortController()
    let settled = false

    /* Reading remote data on mount sets state by definition, and re-reading
       has to clear the last outcome before the next read lands. Every write
       below is guarded by the abort signal — the same trade the conversation
       history read makes in App. */
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    setError(null)

    reader
      .execute({
        stream,
        sessionId: session ?? undefined,
        limit,
        signal: controller.signal,
      })
      .then((result) => {
        if (controller.signal.aborted) return
        settled = true
        setEntry({ key, stream: result })
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
  }, [attempt, key, limit, reader, session, stream])

  const reload = useCallback(() => setAttempt((value) => value + 1), [])

  /* Records outlive a re-read of the same request, so refreshing leaves the
     ledger where it is rather than emptying it for the length of a fetch. */
  const data = entry?.key === key ? entry.stream : null

  return { data, error, loading, reload }
}
