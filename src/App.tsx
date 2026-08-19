import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MotionConfig } from 'motion/react'
import { ControlColumn } from './components/ControlColumn'
import { Deck } from './components/Deck'
import { SearchOverlay } from './components/SearchOverlay'
import { Toast } from './components/Toast'
import type { Prefs } from './components/SettingsPanel'
import type { SendChat } from './application/chat/send_chat'
import type { AssistantMessage, Conversation, Message, UserMessage } from './types'

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
}

const isAbortError = (error: unknown) =>
  error instanceof DOMException && error.name === 'AbortError'

export default function App({ sendChat }: AppProps) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [chatOpen, setChatOpen] = useState(false)
  const [convoLoading, setConvoLoading] = useState(false)
  const [columnExpanded, setColumnExpanded] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [tempMode, setTempMode] = useState(false)
  const [model, setModel] = useState('llama')
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null)
  const [prefs, setPrefs] = useState<Prefs>(readPreferences)
  const [armed, setArmed] = useState(false)

  const pendingChatRef = useRef<PendingChat | null>(null)
  const loadTimer = useRef<number | undefined>(undefined)
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
      sessionId?: string,
    ) => {
      cancelCurrentChat(true)
      const controller = new AbortController()
      pendingChatRef.current = { controller, convoId, msgId }

      try {
        const result = await sendChat.execute({
          message,
          model: requestModel,
          sessionId,
          signal: controller.signal,
        })

        if (pendingChatRef.current?.controller !== controller) return

        setConversations((prev) =>
          prev.map((conversation) =>
            conversation.id !== convoId
              ? conversation
              : {
                  ...conversation,
                  sessionId: result.sessionId,
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
      const convoId = currentConversation?.id ?? uid('c')
      if (!currentConversation) {
        const title = text.length > 44 ? `${text.slice(0, 44).replace(/\s+\S*$/, '')}…` : text
        const convo: Conversation = {
          id: convoId,
          title,
          group: 'today',
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
      /* Sending from the dashboard opens the conversation surface. */
      setChatOpen(true)
      void requestChat(convoId, assistantMsg.id, text, model, currentConversation?.sessionId)
    },
    [active, model, requestChat, tempMode],
  )

  const handleStop = useCallback(() => cancelCurrentChat(true), [cancelCurrentChat])

  const handleRegenerate = useCallback(
    (assistantId: string) => {
      if (!active) return
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
        startedAt: Date.now(),
      }))
      void requestChat(active.id, assistantId, userMessage.text, requestModel, active.sessionId)
    },
    [active, model, requestChat, updateMessage],
  )

  const handleRetry = useCallback(
    (assistantId: string) => handleRegenerate(assistantId),
    [handleRegenerate],
  )

  const handleEditUser = useCallback(
    (userId: string, newText: string) => {
      if (!active) return
      const idx = active.messages.findIndex((m) => m.id === userId)
      if (idx === -1) return
      cancelCurrentChat(false)
      const assistantMsg: AssistantMessage = {
        id: uid('a'),
        role: 'assistant',
        md: '',
        status: 'thinking',
        model,
        startedAt: Date.now(),
      }
      setConversations((prev) =>
        prev.map((c) =>
          c.id !== active.id
            ? c
            : {
                ...c,
                sessionId: undefined,
                messages: [
                  ...c.messages.slice(0, idx),
                  { ...c.messages[idx], text: newText } as Message,
                  assistantMsg,
                ],
              },
        ),
      )
      showToast('Edited messages start a new conversation context.')
      void requestChat(active.id, assistantMsg.id, newText, model)
    },
    [active, cancelCurrentChat, model, requestChat, showToast],
  )

  const openConversation = useCallback(
    (id: string) => {
      setChatOpen(true)
      if (id === activeId) return
      window.clearTimeout(loadTimer.current)
      setActiveId(id)
      setTempMode(false)
      setConvoLoading(true)
      loadTimer.current = window.setTimeout(() => setConvoLoading(false), 420)
    },
    [activeId],
  )

  const newChat = useCallback(() => {
    cancelCurrentChat(true)
    setActiveId(null)
    setTempMode(false)
    setChatOpen(true)
  }, [cancelCurrentChat])

  const temporaryChat = useCallback(() => {
    cancelCurrentChat(true)
    setActiveId(null)
    setTempMode(true)
    setChatOpen(true)
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
          onNewChat={newChat}
          onOpenChat={() => setChatOpen(true)}
          onTemporaryChat={temporaryChat}
          onOpenSearch={() => setSearchOpen(true)}
          temporaryActive={temporaryActive}
          prefs={prefs}
          onPrefsChange={updatePreferences}
          reduceMotion={prefs.reduceMotion}
        />

        <Deck
          expanded={chatOpen}
          active={active}
          conversations={historyConversations}
          convoLoading={convoLoading}
          onOpenConversation={openConversation}
          onExpand={() => setChatOpen(true)}
          onCollapse={() => setChatOpen(false)}
          onSend={handleSend}
          onRegenerate={handleRegenerate}
          onRetry={handleRetry}
          onEditUser={handleEditUser}
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
