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

/** One completed tool call and the evidence the gate was given for it. */
export interface GateToolTrace {
  tool_call_id?: string | null
  name?: string | null
  evidence?: string | null
  /** Turns back from the one being answered; 0 is this turn. */
  turns_ago?: number
}

/** One message of the window the gate read, minus the tool activity. */
export interface GateTurn {
  role?: string
  content?: string
}

/**
 * What the evaluator was given about the turn.
 *
 * Not recoverable from anywhere else: the model-context stream holds the
 * request Maia was given, not the window the gate judged against, the
 * evidence as budgeted for it, or the memories that were in force. Every
 * field is optional because a record written before the gate kept its context
 * carries none of them, and a partial line should still read.
 */
export interface GateContext {
  /** The evaluator's own instruction, which is edited between runs. */
  evaluator_prompt?: string | null
  /** The system prompt Maia was actually running under. */
  system_prompt?: string | null
  user_memories?: string[]
  time_context?: { current_time?: string; timezone?: string } | null
  conversation?: GateTurn[]
  tool_traces?: GateToolTrace[]
  /** How many user turns back the window was allowed to reach. */
  evidence_turns?: number
}

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
  /** Full mode only, and absent on records written before it was kept. */
  gate_context: GateContext | null
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
