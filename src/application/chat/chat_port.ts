import type { ChatRequest, ChatResult } from './schemas'

export interface ChatPort {
  chat(request: ChatRequest): Promise<ChatResult>
}
