export type ConversationRole = 'system' | 'user' | 'assistant' | 'tool'

/** One conversation as the sidebar needs it: no messages. */
export interface ConversationInfo {
  conversationId: string
  title: string
  createdAt: string
  lastUpdated: string
}

export interface ConversationMessageRecord {
  messageId: string | null
  role: ConversationRole
  content: string
  createdAt: string | null
  metadata: Record<string, unknown>
}

/** One conversation with its stored messages, oldest first. */
export interface ConversationDetail {
  conversationId: string
  title: string | null
  createdAt: string | null
  lastUpdated: string | null
  messages: ConversationMessageRecord[]
}

export interface ListConversationsCommand {
  limit?: number
  signal?: AbortSignal
}

export interface GetConversationCommand {
  conversationId: string
  signal?: AbortSignal
}

export interface ListConversationsRequest {
  userId: string
  limit?: number
  signal?: AbortSignal
}

export interface GetConversationRequest {
  userId: string
  conversationId: string
  signal?: AbortSignal
}
