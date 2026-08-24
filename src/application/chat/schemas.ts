export interface SendChatCommand {
  message: string
  model: string
  sessionId?: string
  /** A temporary turn is answered normally but never stored. */
  temporary?: boolean
  temperature?: number
  maxTokens?: number
  signal?: AbortSignal
}

export interface ChatRequest {
  message: string
  model: string
  userId: string
  sessionId?: string
  temporary?: boolean
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
