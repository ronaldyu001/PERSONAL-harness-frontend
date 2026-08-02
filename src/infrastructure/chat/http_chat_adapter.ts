import type { ChatPort } from '../../application/chat/chat_port'
import type { ChatRequest, ChatResult } from '../../application/chat/schemas'

interface ChatResponseBody {
  content: string
  session_id: string
  usage?: Record<string, unknown> | null
}

export class ChatApiError extends Error {
  readonly status?: number

  constructor(message: string, status?: number) {
    super(message)
    this.name = 'ChatApiError'
    this.status = status
  }
}

export class HttpChatAdapter implements ChatPort {
  private readonly endpoint: string

  constructor(baseUrl = '') {
    this.endpoint = `${baseUrl.replace(/\/$/, '')}/api/chat`
  }

  async chat(request: ChatRequest): Promise<ChatResult> {
    let response: Response

    try {
      response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: request.message,
          model: request.model,
          user_id: request.userId,
          session_id: request.sessionId,
          temperature: request.temperature,
          max_tokens: request.maxTokens,
        }),
        signal: request.signal,
      })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw error
      }
      throw new ChatApiError('Unable to reach the chat service.')
    }

    const payload: unknown = await response.json().catch(() => undefined)

    if (!response.ok) {
      throw new ChatApiError(this.errorMessage(payload, response.status), response.status)
    }
    if (!this.isChatResponse(payload)) {
      throw new ChatApiError('The chat service returned an invalid response.', response.status)
    }

    return {
      content: payload.content,
      sessionId: payload.session_id,
      usage: payload.usage ?? undefined,
    }
  }

  private isChatResponse(payload: unknown): payload is ChatResponseBody {
    if (typeof payload !== 'object' || payload === null) return false

    const candidate = payload as Partial<ChatResponseBody>
    return typeof candidate.content === 'string' && typeof candidate.session_id === 'string'
  }

  private errorMessage(payload: unknown, status: number): string {
    if (typeof payload === 'object' && payload !== null && 'detail' in payload) {
      const detail = (payload as { detail?: unknown }).detail
      if (typeof detail === 'string') return detail
    }

    return `Chat request failed with status ${status}.`
  }
}
