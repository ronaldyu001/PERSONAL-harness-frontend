import type { UserIdentityPort } from '../identity/user_identity_port'
import type { ConversationHistoryPort } from './conversation_history_port'
import type {
  ConversationDetail,
  ConversationInfo,
  GetConversationCommand,
  ListConversationsCommand,
} from './schemas'

/**
 * Reads stored conversations. Identity is supplied here rather than by the
 * components, the same way SendChat supplies it.
 */
export class LoadConversations {
  private readonly history: ConversationHistoryPort
  private readonly identity: UserIdentityPort

  constructor(history: ConversationHistoryPort, identity: UserIdentityPort) {
    this.history = history
    this.identity = identity
  }

  list(command: ListConversationsCommand = {}): Promise<ConversationInfo[]> {
    return this.history.list({
      userId: this.identity.getUserId(),
      limit: command.limit,
      signal: command.signal,
    })
  }

  get(command: GetConversationCommand): Promise<ConversationDetail | null> {
    return this.history.get({
      userId: this.identity.getUserId(),
      conversationId: command.conversationId,
      signal: command.signal,
    })
  }
}
