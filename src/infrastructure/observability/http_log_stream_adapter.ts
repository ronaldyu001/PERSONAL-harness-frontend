import type { LogStreamPort } from '../../application/observability/log_stream_port'
import type {
  LogEvent,
  LogRecord,
  LogStream,
  LogStreamId,
  ReadLogStreamRequest,
} from '../../application/observability/schemas'

interface TraceRecordBody {
  id: string
  event: LogEvent
}

interface TraceStreamBody {
  stream: LogStreamId
  source: string
  records: TraceRecordBody[]
  captured_at: string | null
}

export class LogStreamApiError extends Error {
  readonly status?: number

  constructor(message: string, status?: number) {
    super(message)
    this.name = 'LogStreamApiError'
    this.status = status
  }
}

/**
 * The transport behind the trace port.
 *
 * `GET /api/traces` serves one stream at a time, most recent first, already
 * scoped to its owner and — when the reader asked for one — to a single
 * conversation. The events come back in the shape the agent recorded them, so
 * only the envelope is mapped here: the record is passed through untranslated
 * on purpose, the same reasoning `schemas.ts` is written on.
 */
export class HttpLogStreamAdapter implements LogStreamPort {
  private readonly baseUrl: string

  constructor(baseUrl = '') {
    this.baseUrl = baseUrl.replace(/\/$/, '')
  }

  async read(request: ReadLogStreamRequest): Promise<LogStream> {
    const params = new URLSearchParams({
      stream: request.stream,
      user_id: request.userId,
    })
    if (request.sessionId) params.set('session_id', request.sessionId)
    if (request.limit !== undefined) params.set('limit', String(request.limit))

    const payload = await this.fetchJson(`/api/traces?${params.toString()}`, request.signal)

    if (!this.isStream(payload)) {
      throw new LogStreamApiError('The trace service returned an invalid response.')
    }

    return {
      /* The stream the response says it answered, rather than the one that
         was asked for: a set of records should carry what it actually is. */
      id: payload.stream,
      source: payload.source,
      records: payload.records.reduce<LogRecord[]>((records, record, index) => {
        /* A line the surface cannot read is dropped rather than failing the
           whole stream: one unrecognized record should not cost the reader
           every other record in the file. */
        if (this.isRecord(record)) {
          records.push({ id: record.id || `${payload.stream}-${index}`, event: record.event })
        }
        return records
      }, []),
      capturedAt: payload.captured_at,
    }
  }

  private async fetchJson(path: string, signal?: AbortSignal): Promise<unknown> {
    let response: Response

    try {
      response = await fetch(`${this.baseUrl}${path}`, { signal })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw error
      }
      throw new LogStreamApiError('Unable to reach the trace service.')
    }

    const payload: unknown = await response.json().catch(() => undefined)

    if (!response.ok) {
      throw new LogStreamApiError(this.errorMessage(payload, response.status), response.status)
    }

    return payload
  }

  private isStream(payload: unknown): payload is TraceStreamBody {
    if (typeof payload !== 'object' || payload === null) return false
    const candidate = payload as Partial<TraceStreamBody>
    return (
      (candidate.stream === 'model-context' || candidate.stream === 'response-gate') &&
      typeof candidate.source === 'string' &&
      Array.isArray(candidate.records)
    )
  }

  private isRecord(record: unknown): record is TraceRecordBody {
    if (typeof record !== 'object' || record === null) return false
    const event = (record as { event?: unknown }).event
    if (typeof event !== 'object' || event === null) return false
    const candidate = event as Partial<LogEvent>
    return (
      (candidate.event === 'model_context' || candidate.event === 'response_gate') &&
      typeof candidate.timestamp === 'string' &&
      typeof candidate.invocation_id === 'string'
    )
  }

  private errorMessage(payload: unknown, status: number): string {
    if (typeof payload === 'object' && payload !== null && 'detail' in payload) {
      const detail = (payload as { detail?: unknown }).detail
      if (typeof detail === 'string') return detail
    }

    return `Trace request failed with status ${status}.`
  }
}
