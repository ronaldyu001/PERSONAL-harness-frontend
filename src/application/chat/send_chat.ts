import type { UserIdentityPort } from '../identity/user_identity_port'
import type { ChatPort } from './chat_port'
import type { ChatResult, SendChatCommand } from './schemas'

export class SendChat {
  private readonly chat: ChatPort
  private readonly identity: UserIdentityPort

  constructor(
    chat: ChatPort,
    identity: UserIdentityPort,
  ) {
    this.chat = chat
    this.identity = identity
  }

  execute(command: SendChatCommand): Promise<ChatResult> {
    return this.chat.chat({
      message: command.message,
      model: command.model,
      userId: this.identity.getUserId(),
      sessionId: command.sessionId,
      temporary: command.temporary,
      temperature: command.temperature ?? 0.7,
      maxTokens: command.maxTokens ?? 1024,
      signal: command.signal,
    })
  }
}
