export interface SendChatCommand {
  message: string
  model: string
  sessionId?: string
  temperature?: number
  maxTokens?: number
  signal?: AbortSignal
}

export interface ChatRequest {
  message: string
  model: string
  userId: string
  sessionId?: string
  temperature: number
  maxTokens?: number
  signal?: AbortSignal
}

export interface ChatResult {
  content: string
  sessionId: string
  usage?: Record<string, unknown>
  finishReason?: string
}
