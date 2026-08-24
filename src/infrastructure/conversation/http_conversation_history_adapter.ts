import type { ConversationHistoryPort } from '../../application/conversation/conversation_history_port'
import type {
  ConversationDetail,
  ConversationMessageRecord,
  ConversationRole,
  ConversationInfo,
  GetConversationRequest,
  ListConversationsRequest,
} from '../../application/conversation/schemas'

interface ConversationInfoBody {
  conversation_id: string
  title: string
  created_at: string
  last_updated: string
}

interface ConversationMessageBody {
  message_id: string | null
  role: string
  content: string
  created_at: string | null
  metadata: Record<string, unknown> | null
}

interface ConversationBody {
  conversation_id: string
  title: string | null
  created_at: string | null
  last_updated: string | null
  messages: ConversationMessageBody[]
}

const ROLES: ConversationRole[] = ['system', 'user', 'assistant', 'tool']

export class ConversationHistoryApiError extends Error {
  readonly status?: number

  constructor(message: string, status?: number) {
    super(message)
    this.name = 'ConversationHistoryApiError'
    this.status = status
  }
}

export class HttpConversationHistoryAdapter implements ConversationHistoryPort {
  private readonly baseUrl: string

  constructor(baseUrl = '') {
    this.baseUrl = baseUrl.replace(/\/$/, '')
  }

  async list(request: ListConversationsRequest): Promise<ConversationInfo[]> {
    const params = new URLSearchParams({ user_id: request.userId })
    if (request.limit !== undefined) params.set('limit', String(request.limit))

    const payload = await this.request(
      `/api/conversations?${params.toString()}`,
      request.signal,
    )

    if (!Array.isArray(payload)) {
      throw new ConversationHistoryApiError('The history service returned an invalid response.')
    }

    return payload.filter(this.isConversationInfo).map((item) => ({
      conversationId: item.conversation_id,
      title: item.title,
      createdAt: item.created_at,
      lastUpdated: item.last_updated,
    }))
  }

  async get(request: GetConversationRequest): Promise<ConversationDetail | null> {
    const params = new URLSearchParams({ user_id: request.userId })
    const payload = await this.request(
      `/api/conversations/${encodeURIComponent(request.conversationId)}?${params.toString()}`,
      request.signal,
      /* A conversation that is absent, or owned by someone else, is not an
         error the caller has to handle differently. */
      { allowMissing: true },
    )

    if (payload === null) return null
    if (!this.isConversation(payload)) {
      throw new ConversationHistoryApiError('The history service returned an invalid response.')
    }

    return {
      conversationId: payload.conversation_id,
      title: payload.title,
      createdAt: payload.created_at,
      lastUpdated: payload.last_updated,
      messages: payload.messages.map((message) => this.toRecord(message)),
    }
  }

  private async request(
    path: string,
    signal?: AbortSignal,
    options: { allowMissing?: boolean } = {},
  ): Promise<unknown> {
    let response: Response

    try {
      response = await fetch(`${this.baseUrl}${path}`, { signal })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw error
      }
      throw new ConversationHistoryApiError('Unable to reach the history service.')
    }

    if (options.allowMissing && response.status === 404) return null

    const payload: unknown = await response.json().catch(() => undefined)

    if (!response.ok) {
      throw new ConversationHistoryApiError(
        this.errorMessage(payload, response.status),
        response.status,
      )
    }

    return payload
  }

  private toRecord(message: ConversationMessageBody): ConversationMessageRecord {
    return {
      messageId: message.message_id,
      role: this.toRole(message.role),
      content: message.content,
      createdAt: message.created_at,
      metadata: message.metadata ?? {},
    }
  }

  private toRole(role: string): ConversationRole {
    return (ROLES as string[]).includes(role) ? (role as ConversationRole) : 'assistant'
  }

  private isConversationInfo(item: unknown): item is ConversationInfoBody {
    if (typeof item !== 'object' || item === null) return false
    const candidate = item as Partial<ConversationInfoBody>
    return (
      typeof candidate.conversation_id === 'string' &&
      typeof candidate.title === 'string' &&
      typeof candidate.last_updated === 'string'
    )
  }

  private isConversation(payload: unknown): payload is ConversationBody {
    if (typeof payload !== 'object' || payload === null) return false
    const candidate = payload as Partial<ConversationBody>
    return typeof candidate.conversation_id === 'string' && Array.isArray(candidate.messages)
  }

  private errorMessage(payload: unknown, status: number): string {
    if (typeof payload === 'object' && payload !== null && 'detail' in payload) {
      const detail = (payload as { detail?: unknown }).detail
      if (typeof detail === 'string') return detail
    }

    return `History request failed with status ${status}.`
  }
}
