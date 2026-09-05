import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, MotionConfig, motion } from 'motion/react'
import { AppearancePopover } from './components/AppearancePopover'
import { FloatingComposer } from './components/FloatingComposer'
import { Investigate } from './components/Investigate'
import { MaiaHistory } from './components/MaiaHistory'
import { MaiaRail, type MaiaRailArea } from './components/MaiaRail'
import { MaiaRoom } from './components/MaiaRoom'
import type { ParticleSphereState } from './components/ParticleSphere'
import { Toast } from './components/Toast'
import type { Prefs } from './components/SettingsPanel'
import type { SendChat } from './application/chat/send_chat'
import type { LoadConversations } from './application/conversation/load_conversations'
import type { ReadLogStream } from './application/observability/read_log_stream'
import type { ConversationDetail } from './application/conversation/schemas'
import { readUsage } from './lib/usage'
import type { AssistantMessage, Conversation, Message, UserMessage } from './types'

const HISTORY_LOAD_FAILED = 'Could not load your conversations.'

/* The store pages by window size rather than by cursor, so "more" is the same
   listing asked for again one page wider. Stored conversations already in
   hand keep their identity through the merge, so re-reading the head of the
   list costs nothing the reader can see. */
const HISTORY_PAGE_SIZE = 25
const ROOM_TRANSITION_MS = 720
const THREAD_REVEAL_MS = Math.round(ROOM_TRANSITION_MS * 0.72)

const THEME_COLORS: Record<Prefs['palette'], Record<Prefs['theme'], string>> = {
  salon: { dark: '#241f1a', light: '#f1eadf' },
  'print-room': { dark: '#101114', light: '#f4efe6' },
  'day-office': { dark: '#24323e', light: '#f4f0e8' },
}

let seq = 0
const uid = (prefix: string) => `${prefix}-${Date.now()}-${seq++}`

const PREFS_STORAGE_KEY = 'harness.preferences'
const DEFAULT_PREFS: Prefs = {
  theme: 'dark',
  palette: 'salon',
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
      palette:
        stored.palette === 'salon' ||
        stored.palette === 'print-room' ||
        stored.palette === 'day-office'
          ? stored.palette
          : DEFAULT_PREFS.palette,
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
  readLogStream: ReadLogStream
}

/** The room and trace view are mutually exclusive by construction. */
type Surface = 'dashboard' | 'conversation' | 'investigate'

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

export default function App({ sendChat, loadConversations, readLogStream }: AppProps) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [surface, setSurface] = useState<Surface>('dashboard')
  const [inspectedSession, setInspectedSession] = useState<string | null>(null)
  const [convoLoading, setConvoLoading] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [tempMode, setTempMode] = useState(false)
  const [model, setModel] = useState('llama')
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null)
  const [prefs, setPrefs] = useState<Prefs>(readPreferences)
  const [armed, setArmed] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(true)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [historyLimit, setHistoryLimit] = useState(HISTORY_PAGE_SIZE)
  const [historyLoadingMore, setHistoryLoadingMore] = useState(false)
  const [historyHasMore, setHistoryHasMore] = useState(true)
  const [roomState, setRoomState] = useState<ParticleSphereState>('landing')
  const [threadVisible, setThreadVisible] = useState(false)

  const pendingChatRef = useRef<PendingChat | null>(null)
  const historyRequestRef = useRef<AbortController | null>(null)
  const historyListRef = useRef<AbortController | null>(null)
  const toastTimer = useRef<number | undefined>(undefined)
  const roomRevealTimer = useRef<number | undefined>(undefined)
  const roomSettleTimer = useRef<number | undefined>(undefined)
  const settingsButtonRef = useRef<HTMLButtonElement>(null)

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
    document.documentElement.dataset.palette = next.palette
    if (next.reduceMotion) {
      document.documentElement.dataset.reduceMotion = 'true'
    } else {
      delete document.documentElement.dataset.reduceMotion
    }
    setPrefs(next)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = prefs.theme
    document.documentElement.dataset.palette = prefs.palette
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
      ?.setAttribute('content', THEME_COLORS[prefs.palette][prefs.theme])
  }, [prefs])

  const clearRoomTimers = useCallback(() => {
    window.clearTimeout(roomRevealTimer.current)
    window.clearTimeout(roomSettleTimer.current)
    roomRevealTimer.current = undefined
    roomSettleTimer.current = undefined
  }, [])

  useEffect(() => clearRoomTimers, [clearRoomTimers])

  const enterConversationRoom = useCallback(
    (animate = true) => {
      clearRoomTimers()
      if (!animate || prefs.reduceMotion) {
        setRoomState('conversation')
        setThreadVisible(true)
        return
      }

      setRoomState('entering')
      setThreadVisible(false)
      roomRevealTimer.current = window.setTimeout(
        () => setThreadVisible(true),
        THREAD_REVEAL_MS,
      )
      roomSettleTimer.current = window.setTimeout(() => {
        setRoomState('conversation')
        roomSettleTimer.current = undefined
      }, ROOM_TRANSITION_MS)
    },
    [clearRoomTimers, prefs.reduceMotion],
  )

  const returnToLandingRoom = useCallback(
    (animate = true) => {
      clearRoomTimers()
      setThreadVisible(false)
      if (!animate || prefs.reduceMotion) {
        setRoomState('landing')
        return
      }

      setRoomState('leaving')
      roomSettleTimer.current = window.setTimeout(() => {
        setRoomState('landing')
        roomSettleTimer.current = undefined
      }, ROOM_TRANSITION_MS)
    },
    [clearRoomTimers, prefs.reduceMotion],
  )

  /* No synchronous setState here: the effect below calls this on mount, and
     historyLoading already starts true. Only the retry path resets it. */
  const fetchHistory = useCallback(
    async (limit: number, signal?: AbortSignal) => {
      try {
        const listing = await loadConversations.list({ limit, signal })
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
        /* A short page is the end of the history: the store had fewer than the
           window asked for, and asking wider would return the same listing. */
        setHistoryHasMore(listing.length >= limit)
        setHistoryError(null)
      } catch (error) {
        if (isAbortError(error)) return
        setHistoryError(HISTORY_LOAD_FAILED)
      } finally {
        if (!signal?.aborted) {
          setHistoryLoading(false)
          setHistoryLoadingMore(false)
        }
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
    void fetchHistory(HISTORY_PAGE_SIZE, controller.signal)
    return () => controller.abort()
  }, [fetchHistory])

  const retryHistory = useCallback(() => {
    setHistoryLoading(true)
    setHistoryError(null)
    void fetchHistory(historyLimit)
  }, [fetchHistory, historyLimit])

  /* The dashboard asks for the next page when the reader scrolls past what is
     loaded. One request at a time: a listing already in flight is the answer
     to the next ask as well. */
  const loadMoreHistory = useCallback(() => {
    if (historyLoading || historyLoadingMore || !historyHasMore || historyError) return
    const next = historyLimit + HISTORY_PAGE_SIZE
    const controller = new AbortController()
    historyListRef.current?.abort()
    historyListRef.current = controller
    setHistoryLimit(next)
    setHistoryLoadingMore(true)
    void fetchHistory(next, controller.signal).finally(() => {
      if (historyListRef.current === controller) historyListRef.current = null
    })
  }, [fetchHistory, historyError, historyHasMore, historyLimit, historyLoading, historyLoadingMore])

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

        /* What the turn cost is kept rather than dropped: the expanded
           conversation reads it back, and the wall clock is measured here
           because nothing on the wire reports it. */
        const usage = readUsage(result.usage)
        setConversations((prev) =>
          prev.map((conversation) =>
            conversation.id !== convoId
              ? conversation
              : {
                  ...conversation,
                  lastUpdated: new Date().toISOString(),
                  messages: conversation.messages.map((item) =>
                    item.id === msgId && item.role === 'assistant'
                      ? {
                          ...item,
                          md: result.content,
                          status: 'complete',
                          usage,
                          finishReason: result.finishReason,
                          durationMs: item.startedAt ? Date.now() - item.startedAt : undefined,
                        }
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

      setHistoryOpen(false)
      setSettingsOpen(false)
      setSurface('conversation')
      if (!active) enterConversationRoom(true)

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
    [active, enterConversationRoom, model, requestChat, tempMode],
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

  /* Opening a conversation loads it; it does not move the reader, and it does
     not disarm temporary mode. Temporary is a standing arm on the next new
     chat, not a property of whatever is being read: looking something up in
     history is not a decision to start keeping the next one. */
  const openConversation = useCallback(
    (id: string) => {
      setActiveId(id)
      setHistoryOpen(false)
      setSettingsOpen(false)
      enterConversationRoom(false)
      /* The bench has no conversation on it, so opening one from the column
         while it is up would load a conversation the reader cannot see. The
         dashboard is where it lands; which of the two conversation surfaces
         they were last on is not remembered, and never was. */
      setSurface('conversation')

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
    [conversations, enterConversationRoom, loadConversations, showToast],
  )

  /* The bench, opened on one conversation's records: the session id the
     turns were logged under is the conversation's own id, so the two
     surfaces are looking at the same thing from either side. */
  const inspectConversation = useCallback((sessionId: string) => {
    setInspectedSession(sessionId)
    setHistoryOpen(false)
    setSettingsOpen(false)
    setSurface('investigate')
  }, [])

  const newChat = useCallback(() => {
    cancelCurrentChat(true)
    historyRequestRef.current?.abort()
    historyRequestRef.current = null
    setConvoLoading(false)
    setActiveId(null)
    setTempMode(false)
    setHistoryOpen(false)
    setSettingsOpen(false)
    setSurface('dashboard')
    returnToLandingRoom(Boolean(active))
  }, [active, cancelCurrentChat, returnToLandingRoom])

  const temporaryChat = useCallback(() => {
    cancelCurrentChat(true)
    setActiveId(null)
    setTempMode(true)
    setSurface('conversation')
    setHistoryOpen(false)
    setSettingsOpen(false)
    returnToLandingRoom(false)
  }, [cancelCurrentChat, returnToLandingRoom])

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

  const navigate = useCallback((area: MaiaRailArea) => {
    setSettingsOpen(false)
    if (area === 'history') {
      setSurface((current) => (current === 'investigate' ? 'dashboard' : current))
      setHistoryOpen(true)
      return
    }

    setHistoryOpen(false)
    if (area === 'investigate') {
      setInspectedSession(null)
      setSurface('investigate')
    } else {
      setSurface(activeId ? 'conversation' : 'dashboard')
    }
  }, [activeId])

  /* Global keys */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      /* Search is the conversation's history, so the shortcut goes where the
         history is rather than opening a surface of its own. */
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSurface((current) => (current === 'investigate' ? 'dashboard' : current))
        setHistoryOpen(true)
      }
      /* Esc leaves the state users most want out of, from anywhere. */
      if (e.key === 'Escape' && isStreaming) {
        e.preventDefault()
        cancelCurrentChat(true)
      } else if (e.key === 'Escape' && historyOpen) {
        e.preventDefault()
        setHistoryOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cancelCurrentChat, historyOpen, isStreaming])

  const historyConversations = conversations.filter((c) => !c.temporary)
  const temporaryActive = tempMode || (active?.temporary ?? false)
  const activeArea: MaiaRailArea = historyOpen
    ? 'history'
    : surface === 'investigate'
      ? 'investigate'
      : 'conversation'

  return (
    <MotionConfig reducedMotion={prefs.reduceMotion ? 'always' : 'user'}>
      <div
        className="app maia-app"
        data-theme={prefs.theme}
        data-palette={prefs.palette}
        data-reduce-motion={prefs.reduceMotion || undefined}
        data-style={prefs.style}
        /* Drives the signal precedence rule: while a turn is in flight the
           accent is claimed, so focus rings demote to the neutral token. */
        data-busy={isStreaming || undefined}
        /* Primary action outranks focus and selection: while a sendable draft
           exists the send button is the one lit element. */
        data-armed={(!isStreaming && armed) || undefined}
      >
        <MaiaRail
          activeArea={activeArea}
          onNavigate={navigate}
          settingsOpen={settingsOpen}
          onSettingsToggle={() => setSettingsOpen((open) => !open)}
          settingsButtonRef={settingsButtonRef}
        />

        <div className="maia-stage">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={surface === 'investigate' ? 'investigate' : 'room'}
              className="maia-stage__surface"
              initial={prefs.reduceMotion ? false : { opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={prefs.reduceMotion ? { opacity: 0 } : { opacity: 0, x: -10 }}
              transition={{ duration: prefs.reduceMotion ? 0 : 0.2, ease: [0.23, 1, 0.32, 1] }}
            >
              {surface === 'investigate' ? (
                <Investigate
                  readLogStream={readLogStream}
                  onToast={showToast}
                  reduceMotion={prefs.reduceMotion}
                  session={inspectedSession}
                  onClearSession={() => setInspectedSession(null)}
                />
              ) : (
                <MaiaRoom
                  active={active}
                  conversationLoading={convoLoading}
                  state={roomState}
                  threadVisible={threadVisible}
                  reduceMotion={prefs.reduceMotion}
                  onSend={handleSend}
                  onRetry={handleRetry}
                  onToast={showToast}
                  onNewConversation={newChat}
                  onInspectConversation={inspectConversation}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <FloatingComposer
          onSend={handleSend}
          streaming={isStreaming}
          onStop={handleStop}
          model={model}
          onModelChange={setModel}
          temporary={temporaryActive}
          onToggleTemporary={toggleTemporary}
          showHints={prefs.showHints}
          interfaceStyle={prefs.style}
          readOnly={active?.origin === 'history'}
          autoFocus
          onArmedChange={setArmed}
          reduceMotion={prefs.reduceMotion}
        />

        <MaiaHistory
          open={historyOpen}
          conversations={historyConversations}
          activeId={activeId}
          loading={historyLoading}
          error={historyError}
          hasMore={historyHasMore}
          loadingMore={historyLoadingMore}
          reduceMotion={prefs.reduceMotion}
          onOpen={openConversation}
          onClose={() => setHistoryOpen(false)}
          onLoadMore={loadMoreHistory}
          onRetry={retryHistory}
        />

        <AppearancePopover
          open={settingsOpen}
          anchorRef={settingsButtonRef}
          prefs={prefs}
          reduceMotion={prefs.reduceMotion}
          onChange={updatePreferences}
          onClose={() => setSettingsOpen(false)}
        />

        <Toast toast={toast} />
      </div>
    </MotionConfig>
  )
}
