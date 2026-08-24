import type { LogStreamPort } from '../../application/observability/log_stream_port'
import type {
  LogEvent,
  LogRecord,
  LogStream,
  LogStreamId,
  ReadLogStreamRequest,
} from '../../application/observability/schemas'
import {
  MODEL_CONTEXT_SNAPSHOT,
  RESPONSE_GATE_SNAPSHOT,
} from './fixtures/snapshot_records'
import {
  MODEL_CONTEXT_SYNTHESIZED,
  RESPONSE_GATE_SYNTHESIZED,
} from './fixtures/synthesized_records'

/** The file each stream is written to inside the backend container. */
const STREAM_FILES: Record<LogStreamId, string> = {
  'model-context': 'agent-context.jsonl',
  'response-gate': 'response-gate.jsonl',
}

const SOURCES: Record<LogStreamId, { captured: LogEvent[]; synthesized: LogEvent[] }> = {
  'model-context': {
    captured: MODEL_CONTEXT_SNAPSHOT,
    synthesized: MODEL_CONTEXT_SYNTHESIZED,
  },
  'response-gate': {
    captured: RESPONSE_GATE_SNAPSHOT,
    synthesized: RESPONSE_GATE_SYNTHESIZED,
  },
}

/**
 * The seed source behind the log port.
 *
 * The backend writes both files to a volume it does not serve, so until
 * `GET /api/logs/{stream}` exists this adapter stands in for the transport.
 * Captured records come from the container by way of `scripts/snapshot-logs.mjs`;
 * synthesized ones cover the branches that traffic has not taken. The origin
 * rides on the envelope so the surface can say which is which per record
 * rather than disclaiming the whole view.
 */
export class SeedLogStreamAdapter implements LogStreamPort {
  async read(request: ReadLogStreamRequest): Promise<LogStream> {
    /* A microtask, not a fake latency: the port is async because a real one
       will be, and a seeded read should not pretend to be slow. */
    await Promise.resolve()
    if (request.signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError')
    }

    const source = SOURCES[request.stream]
    const records: LogRecord[] = [
      ...source.captured.map((event, index) =>
        toRecord(request.stream, 'captured', index, event),
      ),
      ...source.synthesized.map((event, index) =>
        toRecord(request.stream, 'synthesized', index, event),
      ),
    ]

    /* Newest first, the way the file is read: `tail` is what anyone opening a
       log actually wants. Ties keep their order within an invocation. */
    records.sort((a, b) => b.event.timestamp.localeCompare(a.event.timestamp))

    return {
      id: request.stream,
      file: STREAM_FILES[request.stream],
      records,
      capturedAt: null,
    }
  }
}

function toRecord(
  stream: LogStreamId,
  origin: 'captured' | 'synthesized',
  index: number,
  event: LogEvent,
): LogRecord {
  return { id: `${stream}-${origin}-${index}`, origin, event }
}
