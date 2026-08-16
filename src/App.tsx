import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, MotionConfig, motion } from 'motion/react'
import {
  BookOpenText,
  CalendarClock,
  ChevronRight,
  CookingPot,
  PanelLeft,
  PenLine,
} from 'lucide-react'
import { Sidebar } from './components/Sidebar'
import { Composer } from './components/Composer'
import { Thread } from './components/Thread'
import { SearchOverlay } from './components/SearchOverlay'
import { Toast } from './components/Toast'
import { MaiaMark } from './components/MaiaMark'
import type { Prefs } from './components/SettingsPanel'
import type { SendChat } from './application/chat/send_chat'
import { SUGGESTIONS, greetingForHour } from './config'
import type { AssistantMessage, Conversation, Message, UserMessage } from './types'

let seq = 0
const uid = (prefix: string) => `${prefix}-${Date.now()}-${seq++}`

const springSoft = { type: 'spring', stiffness: 300, damping: 32 } as const
const SUGGESTION_ICONS = [CalendarClock, BookOpenText, PenLine, CookingPot]
const PREFS_STORAGE_KEY = 'harness.preferences'
const DEFAULT_PREFS: Prefs = {
  theme: 'dark',
  reduceMotion: false,
  showHints: true,
  textSize: 'md',
}

const readPreferences = (): Prefs => {
  try {
    const stored = JSON.parse(window.localStorage.getItem(PREFS_STORAGE_KEY) ?? '{}') as Partial<Prefs>
    return {
      theme: stored.theme === 'light' || stored.theme === 'dark' ? stored.theme : DEFAULT_PREFS.theme,
      reduceMotion: typeof stored.reduceMotion === 'boolean' ? stored.reduceMotion : DEFAULT_PREFS.reduceMotion,
      showHints: typeof stored.showHints === 'boolean' ? stored.showHints : DEFAULT_PREFS.showHints,
      textSize: stored.textSize === 'sm' || stored.textSize === 'lg' ? stored.textSize : DEFAULT_PREFS.textSize,
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
  const [convoLoading, setConvoLoading] = useState(false)
  const [sidebarExpanded, setSidebarExpanded] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [tempMode, setTempMode] = useState(false)
  const [model, setModel] = useState('qwen')
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null)
  const [prefs, setPrefs] = useState<Prefs>(readPreferences)

  const pendingChatRef = useRef<PendingChat | null>(null)
  const loadTimer = useRef<number | undefined>(undefined)
  const toastTimer = useRef<number | undefined>(undefined)

  const active = conversations.find((c) => c.id === activeId) ?? null
  const isHome = active === null
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
    document.documentElement.style.colorScheme = prefs.theme
    try {
      window.localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs))
    } catch {
      // Theme changes still work when storage is unavailable.
    }
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', prefs.theme === 'light' ? '#e5e2d3' : '#191710')
  }, [prefs])

  /* ── Conversation state helpers ── */

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
          updateMessage(convoId, msgId, (item) => ({ ...item, status: 'error' }))
          showToast(error instanceof Error ? error.message : 'Chat request failed.')
        }
      } finally {
        if (pendingChatRef.current?.controller === controller) {
          pendingChatRef.current = null
        }
      }
    },
    [cancelCurrentChat, sendChat, showToast, updateMessage],
  )

  /* ── Actions ── */

  const handleSend = useCallback(
    (text: string) => {
      const userMsg: Message = { id: uid('u'), role: 'user', text, attachments: [] }
      const assistantMsg: AssistantMessage = {
        id: uid('a'),
        role: 'assistant',
        md: '',
        status: 'thinking',
        model,
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
      void requestChat(
        convoId,
        assistantMsg.id,
        text,
        model,
        currentConversation?.sessionId,
      )
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
      }))
      void requestChat(
        active.id,
        assistantId,
        userMessage.text,
        requestModel,
        active.sessionId,
      )
    },
    [active, model, requestChat, updateMessage],
  )

  const handleRetry = useCallback(
    (assistantId: string) => {
      handleRegenerate(assistantId)
    },
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
      if (id === activeId) return
      window.clearTimeout(loadTimer.current)
      setActiveId(id)
      setTempMode(false)
      setConvoLoading(true)
      loadTimer.current = window.setTimeout(() => setConvoLoading(false), 460)
    },
    [activeId],
  )

  const newChat = useCallback(() => {
    cancelCurrentChat(true)
    setActiveId(null)
    setTempMode(false)
  }, [cancelCurrentChat])

  const temporaryChat = useCallback(() => {
    cancelCurrentChat(true)
    setActiveId(null)
    setTempMode(true)
  }, [cancelCurrentChat])

  const toggleTemporary = useCallback(() => {
    if (isHome) {
      setTempMode((v) => !v)
    } else if (active?.temporary) {
      newChat()
    } else {
      temporaryChat()
      showToast('Started a temporary chat')
    }
  }, [isHome, active, newChat, temporaryChat, showToast])

  /* ── Global keys ── */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen((v) => !v)
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault()
        setSidebarExpanded((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const greeting = greetingForHour(new Date().getHours())
  const historyConversations = conversations.filter((c) => !c.temporary)
  const temporaryActive = tempMode || (active?.temporary ?? false)

  return (
    <MotionConfig reducedMotion={prefs.reduceMotion ? 'always' : 'user'}>
      <div
        className="app"
        data-theme={prefs.theme}
        data-reduce-motion={prefs.reduceMotion || undefined}
        data-text-size={prefs.textSize}
      >
        <div className="app__ambient" aria-hidden="true" />

        <Sidebar
          expanded={sidebarExpanded}
          onToggle={setSidebarExpanded}
          conversations={historyConversations}
          activeId={activeId}
          onSelect={openConversation}
          onNewChat={newChat}
          onTemporaryChat={temporaryChat}
          onOpenSearch={() => setSearchOpen(true)}
          temporaryActive={temporaryActive}
          prefs={prefs}
          onPrefsChange={updatePreferences}
          onToast={showToast}
        />

        {/* Mobile drawer */}
        <AnimatePresence>
          {drawerOpen && (
            <>
              <motion.div
                key="scrim"
                className="drawer-scrim"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                onClick={() => setDrawerOpen(false)}
              />
              <motion.div
                key="drawer"
                className="drawer"
                initial={{ x: -300 }}
                animate={{ x: 0 }}
                exit={{ x: -308 }}
                transition={{ type: 'spring', stiffness: 380, damping: 36 }}
              >
                <Sidebar
                  expanded
                  onToggle={() => setDrawerOpen(false)}
                  conversations={historyConversations}
                  activeId={activeId}
                  onSelect={openConversation}
                  onNewChat={newChat}
                  onTemporaryChat={temporaryChat}
                  onOpenSearch={() => setSearchOpen(true)}
                  temporaryActive={temporaryActive}
                  prefs={prefs}
                  onPrefsChange={updatePreferences}
                  onToast={showToast}
                  isDrawer
                  onCloseDrawer={() => setDrawerOpen(false)}
                />
              </motion.div>
            </>
          )}
        </AnimatePresence>

        <main className="workspace">
          {/* Slim header, present in conversation state */}
          <AnimatePresence>
            {!isHome && (
              <motion.header
                key="header"
                className="workspace__header"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6, transition: { duration: 0.14 } }}
                transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              >
                <button
                  type="button"
                  className="icon-btn icon-btn--sm workspace__menu"
                  aria-label="Open navigation"
                  onClick={() => setDrawerOpen(true)}
                >
                  <PanelLeft size={17} strokeWidth={1.8} />
                </button>
                <h1 className="workspace__title">{active?.title}</h1>
                {active?.temporary && <span className="temp-badge">Temporary</span>}
              </motion.header>
            )}
          </AnimatePresence>

          {/* Mobile menu affordance on home */}
          {isHome && (
            <button
              type="button"
              className="icon-btn icon-btn--sm workspace__menu workspace__menu--float"
              aria-label="Open navigation"
              onClick={() => setDrawerOpen(true)}
            >
              <PanelLeft size={17} strokeWidth={1.8} />
            </button>
          )}

          <div className={`canvas${isHome ? ' canvas--home' : ' canvas--chat'}`}>
            <AnimatePresence mode="popLayout">
              {isHome ? (
                <motion.div
                  key="intro"
                  className="home-intro"
                  initial={{ opacity: 0, y: 14, filter: 'blur(6px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, y: -18, filter: 'blur(6px)', transition: { duration: 0.2 } }}
                  transition={{ ...springSoft, delay: 0.04 }}
                >
                  <MaiaMark size={40} className="home-intro__mark" />
                  <h1 className="home-intro__greeting">{greeting}</h1>
                  <AnimatePresence>
                    {tempMode && (
                      <motion.span
                        className="temp-pill"
                        initial={{ opacity: 0, y: 6, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.12 } }}
                        transition={{ type: 'spring', stiffness: 500, damping: 34 }}
                      >
                        Temporary chat — hidden from history
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.div>
              ) : (
                <motion.div
                  key="thread"
                  className="thread-wrap"
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, transition: { duration: 0.16 } }}
                  transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1], delay: 0.05 }}
                >
                  <Thread
                    messages={active?.messages ?? []}
                    loading={convoLoading}
                    onRegenerate={handleRegenerate}
                    onRetry={handleRetry}
                    onEditUser={handleEditUser}
                    onToast={showToast}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <motion.div
              layout="position"
              className="composer-slot"
              transition={{ type: 'spring', stiffness: 320, damping: 34 }}
            >
              <Composer
                onSend={handleSend}
                streaming={isStreaming}
                onStop={handleStop}
                model={model}
                onModelChange={(id) => setModel(id)}
                temporary={temporaryActive}
                onToggleTemporary={toggleTemporary}
                showHints={prefs.showHints}
                autoFocus
              />
            </motion.div>

            <AnimatePresence mode="popLayout">
              {isHome && (
                <motion.div
                  key="suggestions"
                  className="home-below"
                  initial="hidden"
                  animate="show"
                  exit={{ opacity: 0, y: 14, transition: { duration: 0.16 } }}
                  variants={{
                    hidden: {},
                    show: { transition: { staggerChildren: 0.045, delayChildren: 0.16 } },
                  }}
                >
                  <p className="home-below__label">Quick starts</p>
                  <div className="home-suggestions">
                    {SUGGESTIONS.map((s, index) => {
                      const SuggestionIcon = SUGGESTION_ICONS[index]
                      return (
                        <motion.button
                          key={s}
                          type="button"
                          className="suggestion"
                          onClick={() => handleSend(s)}
                          variants={{
                            hidden: { opacity: 0, y: 10, filter: 'blur(4px)' },
                            show: {
                              opacity: 1,
                              y: 0,
                              filter: 'blur(0px)',
                              transition: { type: 'spring', stiffness: 420, damping: 34 },
                            },
                          }}
                        >
                          <span className="suggestion__icon" aria-hidden="true">
                            <SuggestionIcon size={16} strokeWidth={1.8} />
                          </span>
                          <span className="suggestion__label">{s}</span>
                          <ChevronRight className="suggestion__chevron" size={14} strokeWidth={1.8} aria-hidden="true" />
                        </motion.button>
                      )
                    })}
                  </div>
                  <motion.p
                    className="home-filehint"
                    variants={{
                      hidden: { opacity: 0 },
                      show: { opacity: 1, transition: { duration: 0.4, delay: 0.2 } },
                    }}
                  >
                    Conversation context stays connected across turns
                  </motion.p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>

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
