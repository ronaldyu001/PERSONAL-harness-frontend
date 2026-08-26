/**
 * The shapes Maia's agent traces are served in.
 *
 * These mirror `presentation/api/schemas.py` on the backend field for field,
 * snake_case included: a trace is the wire, and the wire is not translated
 * here the way the chat contract is. Investigate reads records, and a record
 * that has been renamed on the way in is no longer the thing the agent wrote.
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
  user_id: string | null
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
  user_id: string | null
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

export interface LogRecord<T extends LogEvent = LogEvent> {
  /** The sink's own id for the line, which is what a list keys on. */
  id: string
  event: T
}

export interface LogStream {
  id: LogStreamId
  /** Where the backend read the records from, named so a reader can go find them. */
  source: string
  records: LogRecord[]
  /** When the response was produced, which is a fact about the response. */
  capturedAt: string | null
}

export interface ReadLogStreamCommand {
  stream: LogStreamId
  /** Narrows the read to one conversation's turns. */
  sessionId?: string
  limit?: number
  signal?: AbortSignal
}

export interface ReadLogStreamRequest {
  stream: LogStreamId
  userId: string
  sessionId?: string
  limit?: number
  signal?: AbortSignal
}
