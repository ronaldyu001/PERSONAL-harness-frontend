import type {
  ConversationDetail,
  ConversationInfo,
  GetConversationRequest,
  ListConversationsRequest,
} from './schemas'

export interface ConversationHistoryPort {
  list(request: ListConversationsRequest): Promise<ConversationInfo[]>
  /** Resolves to null when the conversation is absent or owned by someone else. */
  get(request: GetConversationRequest): Promise<ConversationDetail | null>
}
