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
}

export type Message = UserMessage | AssistantMessage

export type HistoryGroup = 'today' | 'yesterday' | 'week'

export interface Conversation {
  id: string
  sessionId?: string
  title: string
  group: HistoryGroup
  temporary?: boolean
  messages: Message[]
}

export interface ModelOption {
  id: string
  name: string
  caption: string
  badge?: string
}
