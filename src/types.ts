export type MessageStatus = 'thinking' | 'streaming' | 'complete' | 'stopped' | 'error'

export interface Attachment {
  id: string
  name: string
  size: number
  kind: 'document' | 'image' | 'code' | 'data'
}

export interface UserMessage {
  id: string
  role: 'user'
  text: string
  attachments: Attachment[]
}

/**
 * What a turn cost, as the provider reported it.
 *
 * Every field is optional because every field is optional on the wire: a
 * provider that reports nothing leaves the turn without a reading rather than
 * with a zero.
 */
export interface TurnUsage {
  input?: number
  output?: number
  total?: number
}

export interface AssistantMessage {
  id: string
  role: 'assistant'
  /** Accumulated markdown revealed so far */
  md: string
  status: MessageStatus
  model: string
  /** Epoch ms the request left the composer; source for the elapsed readout. */
  startedAt?: number
  /** What actually failed, so the turn itself carries the diagnosis. */
  error?: string
  /** Tokens the provider reported for this turn, when it reported any. */
  usage?: TurnUsage
  /** Wall clock from send to answer, measured here rather than reported. */
  durationMs?: number
  /** Why the model stopped, when the backend passed it through. */
  finishReason?: string
}

export type Message = UserMessage | AssistantMessage

export type HistoryGroup = 'today' | 'yesterday' | 'week' | 'older'

/**
 * Where the frontend first encountered a conversation. This is provenance,
 * not a permission: a conversation restored from history can become the live
 * conversation again when its session id is reused.
 */
export type ConversationOrigin = 'local' | 'history'

export interface Conversation {
  /** The id the backend knows this conversation by; minted before the first send. */
  id: string
  title: string
  origin: ConversationOrigin
  /** ISO instant of the last turn; drives the sidebar grouping. */
  lastUpdated?: string
  temporary?: boolean
  messages: Message[]
}

export interface ModelOption {
  id: string
  name: string
  caption: string
  badge?: string
}
