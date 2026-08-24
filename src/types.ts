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
}

export type Message = UserMessage | AssistantMessage

export type HistoryGroup = 'today' | 'yesterday' | 'week' | 'older'

/**
 * Where a conversation came from. A conversation read back from storage is
 * read-only: the agent keeps no context for it once the API restarts, so
 * continuing it would answer with none.
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
