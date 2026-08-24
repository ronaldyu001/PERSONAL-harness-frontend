/**
 * The shapes Maia's local JSONL logs are written in.
 *
 * These mirror `infrastructure/agent/logging/schemas.py` on the backend field
 * for field, snake_case included: a log line is the wire, and the wire is not
 * translated here the way the chat contract is. Investigate reads records, and
 * a record that has been renamed on the way in is no longer the thing that was
 * written to disk.
 */

export type LogMode = 'structure' | 'full'

export type LogStreamId = 'model-context' | 'response-gate'

/** One message as the context logger serializes it. `content` is full mode only. */
export interface ContextMessage {
  type: string
  id: string | null
  name: string | null
  content_characters: number
  content?: unknown
  tool_calls?: { name: string | null; id: string | null; args?: unknown }[]
  tool_call_id?: string
  status?: string
  artifact_excluded?: boolean
}

export interface ContextTool {
  name: string | null
  description?: string | null
  args?: unknown
  schema?: unknown
}

export interface TokenUsage {
  input_tokens?: number
  output_tokens?: number
  total_tokens?: number
  input_token_details?: Record<string, unknown>
  output_token_details?: Record<string, unknown>
}

/** One effective model request and its completion metadata. */
export interface ModelContextEvent {
  event: 'model_context'
  timestamp: string
  invocation_id: string
  session_id: string | null
  model: string
  mode: LogMode
  model_call: number
  system_message: ContextMessage | null
  messages: ContextMessage[]
  tools: ContextTool[]
  status: 'success' | 'error' | null
  usage: TokenUsage | null
}

export type GateDecision = 'allow' | 'retry' | 'fallback' | 'allow_on_error'

/** One response-gate evaluation and routing decision. */
export interface ResponseGateEvent {
  event: 'response_gate'
  timestamp: string
  invocation_id: string
  session_id: string | null
  model: string
  mode: LogMode
  evaluation_call: number
  repair_attempt: number
  decision: GateDecision
  passed: boolean | null
  violations: string[]
  feedback: string | null
  candidate_message_id: string | null
  candidate_characters: number
  candidate: string | null
  available_tools: string[]
  tools_used: string[]
  usage: TokenUsage | null
  error_type: string | null
  error_message: string | null
}

export type LogEvent = ModelContextEvent | ResponseGateEvent

/**
 * Where a record came from.
 *
 * The envelope carries this, not the event: a synthesized record has to be
 * exactly the shape the backend writes, or it is not covering anything. Maia
 * shows no fabricated data anywhere else, so the one place that does says so
 * per record rather than in a footnote.
 */
export type RecordOrigin = 'captured' | 'synthesized'

export interface LogRecord<T extends LogEvent = LogEvent> {
  /** Stable within a stream: the log has no id of its own to key a list on. */
  id: string
  origin: RecordOrigin
  event: T
}

export interface LogStream {
  id: LogStreamId
  /** The file the backend writes, named so a reader can go find it. */
  file: string
  records: LogRecord[]
  /** Absent until a records endpoint exists; the seed adapter reports null. */
  capturedAt: string | null
}

export interface ReadLogStreamCommand {
  stream: LogStreamId
  signal?: AbortSignal
}

export interface ReadLogStreamRequest {
  stream: LogStreamId
  signal?: AbortSignal
}
