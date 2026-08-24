import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MotionConfig } from 'motion/react'
import { ControlColumn } from './components/ControlColumn'
import { Deck } from './components/Deck'
import { SearchOverlay } from './components/SearchOverlay'
import { Toast } from './components/Toast'
import type { Prefs } from './components/SettingsPanel'
import type { SendChat } from './application/chat/send_chat'
import type { LoadConversations } from './application/conversation/load_conversations'
import type { ConversationDetail } from './application/conversation/schemas'
import type { AssistantMessage, Conversation, Message, UserMessage } from './types'

const HISTORY_LOAD_FAILED = 'Could not load your conversations.'

let seq = 0
const uid = (prefix: string) => `${prefix}-${Date.now()}-${seq++}`

const PREFS_STORAGE_KEY = 'harness.preferences'
const DEFAULT_PREFS: Prefs = {
  theme: 'dark',
  reduceMotion: false,
  showHints: true,
  style: 'default',
}

const readPreferences = (): Prefs => {
  try {
    const stored = JSON.parse(window.localStorage.getItem(PREFS_STORAGE_KEY) ?? '{}') as Partial<Prefs> & {
      textSize?: 'sm' | 'md' | 'lg'
    }
    const migratedStyle =
      stored.textSize === 'sm' ? 'snug' : stored.textSize === 'lg' ? 'roomy' : 'default'
    return {
      theme: stored.theme === 'light' || stored.theme === 'dark' ? stored.theme : DEFAULT_PREFS.theme,
      reduceMotion:
        typeof stored.reduceMotion === 'boolean' ? stored.reduceMotion : DEFAULT_PREFS.reduceMotion,
      showHints: typeof stored.showHints === 'boolean' ? stored.showHints : DEFAULT_PREFS.showHints,
      style:
        stored.style === 'snug' || stored.style === 'roomy' || stored.style === 'default'
          ? stored.style
          : migratedStyle,
    }
  } catch {
    return DEFAULT_PREFS
  }
}

interface PendingChat {
  controller: AbortController
  convoId: string
  msgId: string
}

interface AppProps {
  sendChat: SendChat
  loadConversations: LoadConversations
}

/** Map one stored conversation onto the shape the thread renders. */
function toConversation(detail: ConversationDetail, title: string): Conversation {
  return {
    id: detail.conversationId,
    title: detail.title ?? title,
    origin: 'history',
    lastUpdated: detail.lastUpdated ?? undefined,
    messages: detail.messages.flatMap<Message>((record, index) => {
      const id = record.messageId ?? `${detail.conversationId}-${index}`
      if (record.role === 'user') {
        return [{ id, role: 'user', text: record.content, attachments: [] }]
      }
      if (record.role !== 'assistant') return []
      const model = record.metadata.model
      return [
        {
          id,
          role: 'assistant',
          md: record.content,
          status: 'complete',
          model: typeof model === 'string' ? model : 'unknown',
        },
      ]
    }),
  }
}

const isAbortError = (error: unknown) =>
  error instanceof DOMException && error.name === 'AbortError'

export default function App({ sendChat, loadConversations }: AppProps) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [chatOpen, setChatOpen] = useState(false)
  const [convoLoading, setConvoLoading] = useState(false)
  const [columnExpanded, setColumnExpanded] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [tempMode, setTempMode] = useState(false)
  const [model, setModel] = useState('qwen')
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null)
  const [prefs, setPrefs] = useState<Prefs>(readPreferences)
  const [armed, setArmed] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(true)
  const [historyError, setHistoryError] = useState<string | null>(null)

  const pendingChatRef = useRef<PendingChat | null>(null)
  const historyRequestRef = useRef<AbortController | null>(null)
  const toastTimer = useRef<number | undefined>(undefined)

  const active = conversations.find((c) => c.id === activeId) ?? null
  const isStreaming = useMemo(
    () =>
      active?.messages.some(
        (m) => m.role === 'assistant' && (m.status === 'thinking' || m.status === 'streaming'),
      ) ?? false,
    [active],
  )

  const showToast = useCallback((text: string) => {
    window.clearTimeout(toastTimer.current)
    setToast({ id: Date.now(), text })
    toastTimer.current = window.setTimeout(() => setToast(null), 2200)
  }, [])

  const updatePreferences = useCallback((next: Prefs) => {
    document.documentElement.dataset.theme = next.theme
    if (next.reduceMotion) {
      document.documentElement.dataset.reduceMotion = 'true'
    } else {
      delete document.documentElement.dataset.reduceMotion
    }
    setPrefs(next)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = prefs.theme
    if (prefs.reduceMotion) {
      document.documentElement.dataset.reduceMotion = 'true'
    } else {
      delete document.documentElement.dataset.reduceMotion
    }
    document.documentElement.style.colorScheme = prefs.theme
    try {
      window.localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs))
    } catch {
      // Theme changes still work when storage is unavailable.
    }
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', prefs.theme === 'light' ? '#cfccc3' : '#262624')
  }, [prefs])

  /* No synchronous setState here: the effect below calls this on mount, and
     historyLoading already starts true. Only the retry path resets it. */
  const fetchHistory = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const listing = await loadConversations.list({ signal })
        if (signal?.aborted) return
        setConversations((prev) => {
          /* Merge rather than replace: a conversation started before the list
             arrived is already local, and its live messages outrank a stored
             listing. */
          const known = new Set(prev.map((conversation) => conversation.id))
          const stored = listing
            .filter((info) => !known.has(info.conversationId))
            .map<Conversation>((info) => ({
              id: info.conversationId,
              title: info.title,
              origin: 'history',
              lastUpdated: info.lastUpdated,
              messages: [],
            }))
          return [...prev, ...stored]
        })
        setHistoryError(null)
      } catch (error) {
        if (isAbortError(error)) return
        setHistoryError(HISTORY_LOAD_FAILED)
      } finally {
        if (!signal?.aborted) setHistoryLoading(false)
      }
    },
    [loadConversations],
  )

  useEffect(() => {
    const controller = new AbortController()
    /* Loading remote data on mount sets state by definition. Without a
       fetching library or a Suspense boundary there is no version of this the
       rule accepts, and every write here is guarded by the abort signal. */
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchHistory(controller.signal)
    return () => controller.abort()
  }, [fetchHistory])

  const retryHistory = useCallback(() => {
    setHistoryLoading(true)
    setHistoryError(null)
    void fetchHistory()
  }, [fetchHistory])

  /* Conversation state helpers */

  const updateMessage = useCallback(
    (convoId: string, msgId: string, patch: (m: AssistantMessage) => AssistantMessage) => {
      setConversations((prev) =>
        prev.map((c) =>
          c.id !== convoId
            ? c
            : {
                ...c,
                messages: c.messages.map((m) =>
                  m.id === msgId && m.role === 'assistant' ? patch(m) : m,
                ),
              },
        ),
      )
    },
    [],
  )

  const cancelCurrentChat = useCallback(
    (markStopped: boolean) => {
      const current = pendingChatRef.current
      if (!current) return
      current.controller.abort()
      if (markStopped) {
        updateMessage(current.convoId, current.msgId, (m) =>
          m.status === 'thinking' || m.status === 'streaming' ? { ...m, status: 'stopped' } : m,
        )
      }
      pendingChatRef.current = null
    },
    [updateMessage],
  )

  const requestChat = useCallback(
    async (
      convoId: string,
      msgId: string,
      message: string,
      requestModel: string,
      temporary: boolean,
    ) => {
      cancelCurrentChat(true)
      const controller = new AbortController()
      pendingChatRef.current = { controller, convoId, msgId }

      try {
        const result = await sendChat.execute({
          message,
          model: requestModel,
          /* The conversation id is the session id: the frontend mints it, so
             the backend never has to hand one back. */
          sessionId: convoId,
          temporary,
          signal: controller.signal,
        })

        if (pendingChatRef.current?.controller !== controller) return

        setConversations((prev) =>
          prev.map((conversation) =>
            conversation.id !== convoId
              ? conversation
              : {
                  ...conversation,
                  lastUpdated: new Date().toISOString(),
                  messages: conversation.messages.map((item) =>
                    item.id === msgId && item.role === 'assistant'
                      ? { ...item, md: result.content, status: 'complete' }
                      : item,
                  ),
                },
          ),
        )
      } catch (error) {
        if (!isAbortError(error)) {
          const detail = error instanceof Error ? error.message : undefined
          updateMessage(convoId, msgId, (item) => ({ ...item, status: 'error', error: detail }))
        }
      } finally {
        if (pendingChatRef.current?.controller === controller) {
          pendingChatRef.current = null
        }
      }
    },
    [cancelCurrentChat, sendChat, updateMessage],
  )

  /* Actions */

  const handleSend = useCallback(
    (text: string) => {
      /* A stored conversation has no agent context behind it, so it cannot be
         continued. The composer is disabled; this is the guard behind it. */
      if (active?.origin === 'history') return

      const userMsg: Message = { id: uid('u'), role: 'user', text, attachments: [] }
      const assistantMsg: AssistantMessage = {
        id: uid('a'),
        role: 'assistant',
        md: '',
        status: 'thinking',
        model,
        startedAt: Date.now(),
      }

      const currentConversation = active
      /* Minted here, before the first request, so the conversation carries its
         real id from the start and never has to be re-keyed mid-flight. */
      const convoId = currentConversation?.id ?? crypto.randomUUID()
      if (!currentConversation) {
        const title = text.length > 44 ? `${text.slice(0, 44).replace(/\s+\S*$/, '')}…` : text
        const convo: Conversation = {
          id: convoId,
          title,
          origin: 'local',
          lastUpdated: new Date().toISOString(),
          temporary: tempMode,
          messages: [userMsg, assistantMsg],
        }
        setConversations((prev) => [convo, ...prev])
        setActiveId(convoId)
      } else {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === convoId ? { ...c, messages: [...c.messages, userMsg, assistantMsg] } : c,
          ),
        )
      }
      /* Sending never moves the surface: the dashboard's conversation panel
         holds the turn, and expanding stays the reader's call. */
      void requestChat(
        convoId,
        assistantMsg.id,
        text,
        model,
        currentConversation?.temporary ?? tempMode,
      )
    },
    [active, model, requestChat, tempMode],
  )

  const handleStop = useCallback(() => cancelCurrentChat(true), [cancelCurrentChat])

  /* Retry is the one resend left: it recovers a turn that failed, and reuses
     the message and model the failed turn already carried. */
  const handleRetry = useCallback(
    (assistantId: string) => {
      if (!active || active.origin === 'history') return
      const assistantIndex = active.messages.findIndex((item) => item.id === assistantId)
      const userMessage = active.messages
        .slice(0, assistantIndex)
        .reverse()
        .find((item): item is UserMessage => item.role === 'user')
      if (!userMessage) return

      const assistant = active.messages[assistantIndex]
      const requestModel = assistant?.role === 'assistant' ? assistant.model : model
      updateMessage(active.id, assistantId, (item) => ({
        ...item,
        md: '',
        status: 'thinking',
        error: undefined,
        startedAt: Date.now(),
      }))
      void requestChat(
        active.id,
        assistantId,
        userMessage.text,
        requestModel,
        active.temporary ?? false,
      )
    },
    [active, model, requestChat, updateMessage],
  )

  /* Opening a conversation loads it; it does not move the reader. The
     dashboard's conversation panel shows whatever is loaded, so history can be
     opened without leaving the dashboard. */
  const openConversation = useCallback(
    (id: string) => {
      setActiveId(id)
      setTempMode(false)

      const conversation = conversations.find((item) => item.id === id)
      /* Only a stored conversation has messages still to fetch, and an empty
         one is also the retry path: selecting it again asks again. */
      if (!conversation || conversation.origin !== 'history') return
      if (conversation.messages.length > 0) return

      const controller = new AbortController()
      historyRequestRef.current?.abort()
      historyRequestRef.current = controller
      setConvoLoading(true)

      void loadConversations
        .get({ conversationId: id, signal: controller.signal })
        .then((detail) => {
          if (controller.signal.aborted) return
          if (!detail) {
            showToast('That conversation is no longer available.')
            return
          }
          setConversations((prev) =>
            prev.map((item) =>
              item.id === id ? toConversation(detail, item.title) : item,
            ),
          )
        })
        .catch((error: unknown) => {
          if (isAbortError(error)) return
          showToast('Could not open that conversation. Select it to try again.')
        })
        .finally(() => {
          if (historyRequestRef.current === controller) {
            historyRequestRef.current = null
            setConvoLoading(false)
          }
        })
    },
    [conversations, loadConversations, showToast],
  )

  /* The conversation surface is a toggle, like temporary mode: the same
     control that opens it puts the reader back on the dashboard. */
  const toggleChat = useCallback(() => setChatOpen((open) => !open), [])

  const newChat = useCallback(() => {
    cancelCurrentChat(true)
    setActiveId(null)
    setTempMode(false)
  }, [cancelCurrentChat])

  const temporaryChat = useCallback(() => {
    cancelCurrentChat(true)
    setActiveId(null)
    setTempMode(true)
    setChatOpen(true)
  }, [cancelCurrentChat])

  /* Toggles the mode in place. It never navigates, so arming a temporary chat
     from the control column leaves you where you are. */
  const toggleTemporaryMode = useCallback(() => {
    setTempMode((current) => {
      if (!current) {
        cancelCurrentChat(true)
        setActiveId(null)
      }
      return !current
    })
  }, [cancelCurrentChat])

  const toggleTemporary = useCallback(() => {
    if (!active) {
      setTempMode((v) => !v)
    } else if (active.temporary) {
      newChat()
    } else {
      temporaryChat()
      showToast('Started a temporary chat')
    }
  }, [active, newChat, temporaryChat, showToast])

  /* Global keys */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen((v) => !v)
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault()
        setColumnExpanded((v) => !v)
      }
      /* Esc leaves the state users most want out of, from anywhere. */
      if (e.key === 'Escape' && !searchOpen && isStreaming) {
        e.preventDefault()
        cancelCurrentChat(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cancelCurrentChat, isStreaming, searchOpen])

  const historyConversations = conversations.filter((c) => !c.temporary)
  const temporaryActive = tempMode || (active?.temporary ?? false)

  return (
    <MotionConfig reducedMotion={prefs.reduceMotion ? 'always' : 'user'}>
      <div
        className="app"
        data-theme={prefs.theme}
        data-reduce-motion={prefs.reduceMotion || undefined}
        data-style={prefs.style}
        /* Drives the signal precedence rule: while a turn is in flight the
           accent is claimed, so focus rings demote to the neutral token. */
        data-busy={isStreaming || undefined}
        /* Primary action outranks focus and selection: while a sendable draft
           exists the send button is the one lit element. */
        data-armed={(!isStreaming && armed) || undefined}
      >
        <ControlColumn
          expanded={columnExpanded}
          onToggle={setColumnExpanded}
          conversations={historyConversations}
          activeId={activeId}
          chatOpen={chatOpen}
          onSelect={openConversation}
          historyLoading={historyLoading}
          historyError={historyError}
          onRetryHistory={retryHistory}
          onToggleChat={toggleChat}
          onGoDashboard={() => setChatOpen(false)}
          onTemporaryChat={toggleTemporaryMode}
          onOpenSearch={() => setSearchOpen(true)}
          temporaryActive={temporaryActive}
          prefs={prefs}
          onPrefsChange={updatePreferences}
          reduceMotion={prefs.reduceMotion}
        />

        <Deck
          expanded={chatOpen}
          active={active}
          temporaryActive={temporaryActive}
          conversations={historyConversations}
          convoLoading={convoLoading}
          onOpenConversation={openConversation}
          onNewChat={newChat}
          onExpand={() => setChatOpen(true)}
          onCollapse={() => setChatOpen(false)}
          onSend={handleSend}
          onRetry={handleRetry}
          onToast={showToast}
          reduceMotion={prefs.reduceMotion}
          composer={{
            streaming: isStreaming,
            onStop: handleStop,
            model,
            onModelChange: setModel,
            temporary: temporaryActive,
            onToggleTemporary: toggleTemporary,
            showHints: prefs.showHints,
            interfaceStyle: prefs.style,
            readOnly: active?.origin === 'history',
            autoFocus: true,
            onArmedChange: setArmed,
          }}
        />

        <SearchOverlay
          open={searchOpen}
          onClose={() => setSearchOpen(false)}
          conversations={historyConversations}
          onSelect={openConversation}
          showHints={prefs.showHints}
        />

        <Toast toast={toast} />
      </div>
    </MotionConfig>
  )
}
