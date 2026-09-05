import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ChevronRight, History, LockKeyhole, Maximize2, PanelRight, Search, SquarePen, X } from 'lucide-react'
import { Thread } from './Thread'
import { ConversationAside } from './ConversationAside'
import { MaiaMark } from './MaiaMark'
import { Composer, type ComposerProps } from './Composer'
import { Tooltip } from './Tooltip'
import { PANELS, PANEL_BODIES } from './panel-registry'
import { Separator, RESIZER_THICKNESS } from './Separator'
import { viewSlide } from '../lib/motion'
import { clamp, readStored, writeStored } from '../lib/panel_split'
import { GROUP_LABELS, SUGGESTIONS } from '../config'
import { historyGroup } from '../lib/history_groups'
import type { Conversation, Message } from '../types'

export interface DeckProps {
  expanded: boolean
  active: Conversation | null
  temporaryActive: boolean
  conversations: Conversation[]
  convoLoading: boolean
  historyLoading: boolean
  historyError: string | null
  historyHasMore: boolean
  historyLoadingMore: boolean
  /** The card is showing its history. Owned above so Ctrl+K can ask for it. */
  historyOpen: boolean
  onHistoryOpenChange: (open: boolean) => void
  onLoadMoreHistory: () => void
  onRetryHistory: () => void
  onOpenConversation: (id: string) => void
  onCloseConversation: () => void
  onInspectConversation: (sessionId: string) => void
  onNewChat: () => void
  onExpand: () => void
  onCollapse: () => void
  onSend: (text: string) => void
  onRetry: (id: string) => void
  onToast: (text: string) => void
  composer: Omit<ComposerProps, 'onSend'>
  reduceMotion: boolean
}

const SECONDARY = PANELS.filter((panel) => panel.slot === 'secondary')

/* Only reached when the stylesheet cannot be read at all. It has to track
   --panel-gap: a fallback that disagrees with the token puts the animated
   width and the laid-out width out of step, which shows as a band of ground
   at the stack's outer edge — the gutter, stranded on the wrong side. */
const PANEL_GAP_FALLBACK = 0

/* Both splits are floored, never capped: a panel may not be dragged narrower
   or shorter than the point where it stops reading, and everything between
   those floors belongs to whoever is dragging.

   STACK_MIN is where the readout legends start to clip; CHAT_MIN is where the
   conversation stops being a conversation; PANEL_MIN is a head plus its
   reading. */
const STACK_WIDE = 296
const STACK_NARROW = 232
const STACK_MIN = 160
const CHAT_MIN = 340
const PANEL_MIN = 104
const STACK_STEP = 16
const SPLIT_STEP = 24
const READOUT_SPLIT = 0.5
/* The rail's width is owned here rather than by a media query, so the value
   that animates and the value that lays out cannot disagree — the same reason
   the readout stack's width lives in this file. Zero means there is no room
   for it: the reading column would fall under its own floor. */
const ASIDE_WIDE = 296
const ASIDE_NARROW = 236
const ASIDE_NONE_BELOW = 900
const ASIDE_NARROW_BELOW = 1120

const DETAIL_STORAGE_KEY = 'harness.conversation.detail'
const STACK_STORAGE_KEY = 'harness.dashboard.stackWidth'
const SPLIT_STORAGE_KEY = 'harness.dashboard.readoutSplit'

/* The gutter between the chat panel and the stack lives inside the stack, so
   the animated width has to carry it: panel plus gutter collapse as one and
   the chat panel's right edge lands flush against the frame. --panel-gap is
   deliberately constant across densities, which is what lets a single read
   stay in step with the stylesheet — but not before the stylesheet is there
   to read, which is why the value is taken again once the deck is mounted. */
function readPanelGap() {
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--panel-gap')
  const parsed = Number.parseFloat(raw)
  return Number.isFinite(parsed) ? parsed : PANEL_GAP_FALLBACK
}

/**
 * The reader owns both splits.
 *
 * The stack's resting width is a preference, not a constant, and so is the
 * share of it each readout takes. Stored values are the panel's own size — the
 * gutter is added back where it is animated — so the collapse mechanic is
 * untouched by either drag.
 */
/** How much room the conversation's own readouts get, if any. */
function useAsideWidth() {
  const [viewport, setViewport] = useState(() => window.innerWidth)

  useEffect(() => {
    const onResize = () => setViewport(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  if (viewport <= ASIDE_NONE_BELOW) return 0
  return viewport <= ASIDE_NARROW_BELOW ? ASIDE_NARROW : ASIDE_WIDE
}

function useDeckSizing(deckRef: React.RefObject<HTMLElement | null>) {
  const [panelGap, setPanelGap] = useState(readPanelGap)
  const [storedWidth, setStoredWidth] = useState<number | null>(() =>
    readStored(STACK_STORAGE_KEY),
  )
  const [storedSplit, setStoredSplit] = useState<number | null>(() => readStored(SPLIT_STORAGE_KEY))
  const [viewport, setViewport] = useState(() => window.innerWidth)
  const [deck, setDeck] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const onResize = () => setViewport(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  /* The column expands without a window resize, so the deck is measured
     rather than derived: both ceilings have to follow the room that is left.

     The gutter is re-read in the same pass. On the first render the custom
     property may not resolve yet — in development the styles arrive with the
     module graph — and a gap read before the stylesheet lands would be held
     for the session. */
  useLayoutEffect(() => {
    const el = deckRef.current
    if (!el) return
    setPanelGap(readPanelGap())
    setDeck({ width: el.clientWidth, height: el.clientHeight })
    const observer = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect
      if (box) setDeck({ width: box.width, height: box.height })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [deckRef])

  const defaultWidth = viewport <= 1100 ? STACK_NARROW : STACK_WIDE
  const widthMax =
    deck.width > 0
      ? Math.max(STACK_MIN, deck.width - panelGap - CHAT_MIN)
      : Math.max(STACK_MIN, storedWidth ?? defaultWidth)
  const width = clamp(storedWidth ?? defaultWidth, STACK_MIN, widthMax)

  /* The readouts share the stack's height minus the one gutter between them.
     The floor is expressed as a fraction of what is actually there, so a short
     window tightens both panels rather than starving the lower one. */
  const usable = Math.max(0, deck.height - panelGap)
  const splitMin = usable > 0 ? Math.min(0.5, PANEL_MIN / usable) : 0
  const split = clamp(storedSplit ?? READOUT_SPLIT, splitMin, 1 - splitMin)

  const setWidth = useCallback(
    (next: number) => {
      const value = clamp(Math.round(next), STACK_MIN, widthMax)
      setStoredWidth(value)
      writeStored(STACK_STORAGE_KEY, value)
    },
    [widthMax],
  )

  const setSplit = useCallback(
    (next: number) => {
      const value = Number(clamp(next, splitMin, 1 - splitMin).toFixed(4))
      setStoredSplit(value)
      writeStored(SPLIT_STORAGE_KEY, value)
    },
    [splitMin],
  )

  const resetWidth = useCallback(() => {
    setStoredWidth(null)
    writeStored(STACK_STORAGE_KEY, null)
  }, [])

  const resetSplit = useCallback(() => {
    setStoredSplit(null)
    writeStored(SPLIT_STORAGE_KEY, null)
  }, [])

  return {
    deck,
    panelGap,
    resetSplit,
    resetWidth,
    setSplit,
    setWidth,
    split,
    splitMin,
    usable,
    width,
    widthMax,
  }
}

export function Deck(props: DeckProps) {
  const { expanded, active, conversations, convoLoading, reduceMotion } = props
  const chatPanel = PANELS.find((panel) => panel.id === 'chat')!
  const messages: Message[] = active?.messages ?? []
  const deckRef = useRef<HTMLElement>(null)
  /* The detail rail is a preference, not a mode: it is the reason to expand,
     so it opens by default and stays however the reader last left it. */
  const [detailOpen, setDetailOpen] = useState(() => readStored(DETAIL_STORAGE_KEY) !== 0)
  const asideWidth = useAsideWidth()
  const [draggingAxis, setDraggingAxis] = useState<'x' | 'y' | null>(null)
  const dragStart = useRef(0)
  const {
    deck,
    panelGap,
    resetSplit,
    resetWidth,
    setSplit,
    setWidth,
    split,
    splitMin,
    usable,
    width,
    widthMax,
  } = useDeckSizing(deckRef)

  /* The history is a view of this card, but the ask can come from outside it
     — Ctrl+K reaches for the history wherever the reader is — so the state
     lives above and arrives as a prop. The view focuses its own field when it
     mounts, which is the whole of what the shortcut has to arrange. */
  const { historyOpen, onHistoryOpenChange: setHistoryOpen } = props

  /* History is a view the reader opens over whatever the panel is holding, so
     it outranks both; closing it returns to what was underneath rather than to
     a remembered view. Under it, the loaded conversation outranks the landing,
     and the landing is one state, not two — expanding the panel gives history
     and quick starts more room, it does not swap one for the other. */
  const view: 'thread' | 'landing' | 'history' = historyOpen
    ? 'history'
    : messages.length > 0 || convoLoading
      ? 'thread'
      : 'landing'

  /* A stored conversation is read, not held: it is the other thing on this
     card the reader can put down. */
  const storedOpen = view === 'thread' && active?.origin === 'history'
  const { onCloseConversation } = props

  /* The same key that leaves every other stacked state, and it leaves them in
     the order they were stacked. The search overlay stops the event at its own
     handler, so this never fires out from under it. */
  useEffect(() => {
    if (!historyOpen && !storedOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      if (historyOpen) setHistoryOpen(false)
      else onCloseConversation()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [historyOpen, onCloseConversation, setHistoryOpen, storedOpen])

  const toggleDetail = () => {
    const next = !detailOpen
    setDetailOpen(next)
    writeStored(DETAIL_STORAGE_KEY, next ? 1 : 0)
  }

  /* The thread is the scroll container and the turn is inside it, so the
     browser's own scrolling is the whole mechanism. */
  const goToTurn = (messageId: string) => {
    document.getElementById(`turn-${messageId}`)?.scrollIntoView({
      behavior: reduceMotion ? 'auto' : 'smooth',
      block: 'start',
    })
  }

  /* The list is the same list in both places, so its inputs travel as one
     bundle rather than as seven props repeated at two call sites. */
  const history: HistoryState = {
    conversations,
    loading: props.historyLoading,
    error: props.historyError,
    hasMore: props.historyHasMore,
    loadingMore: props.historyLoadingMore,
    onLoadMore: props.onLoadMoreHistory,
    onRetry: props.onRetryHistory,
  }

  /* Both of these land the reader on a conversation, so both close the view
     that was covering one. */
  const { onOpenConversation, onSend } = props

  const openFromHistory = useCallback(
    (id: string) => {
      setHistoryOpen(false)
      onOpenConversation(id)
    },
    [onOpenConversation, setHistoryOpen],
  )

  const sendAndReturn = useCallback(
    (text: string) => {
      setHistoryOpen(false)
      onSend(text)
    },
    [onSend, setHistoryOpen],
  )

  /* History is the view stacked on top, so it comes from the right and
     everything underneath comes back from the left. */
  const viewDirection = view === 'history' ? 1 : -1
  const showAside = expanded && detailOpen && asideWidth > 0
  const restingStackWidth = width + panelGap
  const stackWidth = expanded ? 0 : restingStackWidth
  const chatWidth = Math.max(0, deck.width - restingStackWidth)
  const firstPanelHeight = Math.round(usable * split)
  const transition = reduceMotion
    ? { duration: 0 }
    : { type: 'spring' as const, stiffness: 320, damping: 38 }

  return (
    <main className={`deck${expanded ? ' deck--expanded' : ''}`} ref={deckRef}>
      {/* The chat region's left edge is structurally fixed: it is the flex
          child that absorbs remaining width, so only its right edge travels. */}
      <section className="region region--chat" aria-labelledby="region-chat-legend">
        {/* Head, thread and composer are one column; the rail is the other.
            The head sits inside this one, so its controls end where the rail
            begins and travel with it rather than standing over it. */}
        <div className="region__main">
        <header className="region__head">
          <h2 id="region-chat-legend" className="legend region__legend">
            {chatPanel.legend}
          </h2>
          {active && view === 'thread' && <span className="region__title">{active.title}</span>}
          {/* The flag describes what is on the card: a conversation being read
              is temporary or it is not. With nothing loaded there is only the
              armed mode to report, which is the state the next chat will take. */}
          {(active ? active.temporary : props.temporaryActive) && (
            <span className="region__flag">Temporary</span>
          )}
          {active?.origin === 'history' && (
            <span className="region__flag region__flag--settled">Read-only</span>
          )}
          <div className="region__head-end">
{/* The head is icons: the tooltip carries the name and the shortcut,
                and the view behind it says the rest. */}
            <Tooltip
              label={historyOpen ? 'Close history' : 'History and search'}
              shortcut={historyOpen ? undefined : 'Ctrl+K'}
              side="bottom"
            >
              <button
                type="button"
                className={`icon-btn icon-btn--xs${historyOpen ? ' icon-btn--active' : ''}`}
                onClick={() => setHistoryOpen(!historyOpen)}
                aria-label={
                  historyOpen ? 'Close conversation history' : 'Conversation history and search'
                }
                aria-pressed={historyOpen}
              >
                {historyOpen ? (
                  <X size={14} strokeWidth={1.8} aria-hidden="true" />
                ) : (
                  <History size={14} strokeWidth={1.8} aria-hidden="true" />
                )}
              </button>
            </Tooltip>
            <Tooltip label="New chat" side="bottom">
              <button
                type="button"
                className="icon-btn icon-btn--xs"
                onClick={props.onNewChat}
                aria-label="New chat"
                disabled={!active && !props.temporaryActive}
              >
                <SquarePen size={14} strokeWidth={1.8} aria-hidden="true" />
              </button>
            </Tooltip>
            {expanded ? (
              <>
                {asideWidth > 0 && (
                  <Tooltip label={detailOpen ? 'Hide detail' : 'Show detail'} side="bottom">
                    <button
                      type="button"
                      className={`icon-btn icon-btn--xs${detailOpen ? ' icon-btn--active' : ''}`}
                      onClick={toggleDetail}
                      aria-label="Conversation detail"
                      aria-pressed={detailOpen}
                    >
                      <PanelRight size={14} strokeWidth={1.8} aria-hidden="true" />
                    </button>
                  </Tooltip>
                )}
                <button type="button" className="ghost-btn" onClick={props.onCollapse}>
                  Dashboard
                </button>
              </>
            ) : (
              <Tooltip label="Expand" side="bottom">
                <button
                  type="button"
                  className="icon-btn icon-btn--xs"
                  onClick={props.onExpand}
                  aria-label="Expand the conversation"
                >
                  <Maximize2 size={14} strokeWidth={1.8} aria-hidden="true" />
                </button>
              </Tooltip>
            )}
          </div>
        </header>

        <div className="region__body">
          {/* History opens over what the card was holding, so it arrives from
              the right and closing sends it back; the thread and the landing
              exchange places on the same rail. */}
          <AnimatePresence mode="wait" initial={false} custom={viewDirection}>
            <motion.div
              key={view}
              className="region__fill"
              custom={viewDirection}
              variants={viewSlide(reduceMotion)}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              {view === 'history' ? (
                <HistoryView
                  history={history}
                  onOpen={openFromHistory}
                  onClose={() => setHistoryOpen(false)}
                />
              ) : view === 'thread' ? (
                <div className="thread-view">
                  {/* A stored conversation is read, not held, and the way to
                      put it down belongs with it rather than in the head:
                      the head's controls act on the card, this one acts on
                      what is in it. */}
                  {storedOpen && (
                    <div className="thread-view__head">
                      <h3 className="legend">Stored conversation</h3>
                      <button type="button" className="ghost-btn" onClick={onCloseConversation}>
                        Close
                      </button>
                    </div>
                  )}
                  <Thread
                    messages={messages}
                    loading={convoLoading}
                    onRetry={props.onRetry}
                    onToast={props.onToast}
                  />
                </div>
              ) : (
                <Landing onSend={onSend} />
              )}
            </motion.div>
          </AnimatePresence>

          {/* The composer holds the reading axis under every view. What fills
              the region above it changes; the axis it is measured on does not,
              so nothing the reader toggles moves the input under their hands. */}
          <div className="region__composer">
            <Composer {...props.composer} onSend={sendAndReturn} />
          </div>
        </div>
        </div>

        {/* Expanding trades the ambient readouts for readings about the
            conversation itself: the stack leaves the frame, and the rail
            arrives inside the region by the same mechanic — an animated width
            clipping a block that keeps its own, so the head's controls travel
            with the edge instead of jumping to meet it. */}
        <motion.div
          className="region__aside"
          animate={{ width: showAside ? asideWidth : 0 }}
          initial={false}
          transition={transition}
          aria-hidden={!showAside}
        >
          <div className="region__aside-inner" style={{ width: asideWidth || ASIDE_WIDE }}>
            {showAside && (
              <ConversationAside
                conversation={active}
                temporaryActive={props.temporaryActive}
                onGoToTurn={goToTurn}
                onInspect={props.onInspectConversation}
              />
            )}
          </div>
        </motion.div>
      </section>

      {!expanded && (
        <Separator
          orientation="vertical"
          style={{
            right: width + panelGap / 2 - RESIZER_THICKNESS / 2,
            width: RESIZER_THICKNESS,
          }}
          label="Widen the conversation"
          valueNow={Math.round(chatWidth)}
          valueMin={CHAT_MIN}
          valueMax={Math.round(Math.max(CHAT_MIN, deck.width - panelGap - STACK_MIN))}
          valueText={`Conversation ${Math.round(chatWidth)} pixels wide`}
          step={STACK_STEP}
          dragging={draggingAxis === 'x'}
          onDragStart={() => {
            dragStart.current = width
            setDraggingAxis('x')
          }}
          onDrag={(delta) => setWidth(dragStart.current - delta)}
          onDragEnd={() => setDraggingAxis(null)}
          onNudge={(delta) => setWidth(width - delta)}
          onExtreme={(edge) => setWidth(edge === 'start' ? widthMax : STACK_MIN)}
          onReset={resetWidth}
        />
      )}

      {/* Secondary regions translate off-frame; they never resize the chat's
          left edge. Width animates to zero, gutter included, so the chat panel
          ends flush against the frame rather than short of it. */}
      <motion.div
        className="deck__stack"
        animate={{ width: stackWidth }}
        initial={false}
        transition={draggingAxis === 'x' ? { duration: 0 } : transition}
        aria-hidden={expanded}
      >
        {/* Fixed at the resting width so the collapse clips the readouts away
            rather than squeezing them. */}
        <div className="deck__stack-inner" style={{ width }}>
          {SECONDARY.map((panel, index) => {
            const Body = PANEL_BODIES[panel.id]
            const legendId = `region-${panel.id}-legend`
            /* The stored share belongs to the first readout; the rest divide
               what is left, which is the whole stack today and still sensible
               if the registry grows. */
            const sized = index === 0 && SECONDARY.length > 1
            return (
              <Fragment key={panel.id}>
                <section
                  className="region region--dormant"
                  aria-labelledby={legendId}
                  aria-disabled="true"
                  style={
                    sized
                      ? { flex: `0 0 calc((100% - ${panelGap}px) * ${split})` }
                      : undefined
                  }
                >
                  <header className="region__head">
                    <panel.icon size={14} strokeWidth={1.8} aria-hidden="true" />
                    <h2 id={legendId} className="legend region__legend">
                      {panel.legend}
                    </h2>
                  </header>
                  <div className="region__body region__body--readout">
                    {Body ? <Body /> : null}
                    <p className="region__awaiting">{panel.awaiting}</p>
                  </div>
                </section>
                {sized && !expanded && (
                  <Separator
                    orientation="horizontal"
                    style={{
                      top: `calc((100% - ${panelGap}px) * ${split} + ${
                        panelGap / 2 - RESIZER_THICKNESS / 2
                      }px)`,
                      height: RESIZER_THICKNESS,
                    }}
                    label={`Resize the ${panel.legend.toLowerCase()} readout`}
                    valueNow={firstPanelHeight}
                    valueMin={Math.round(usable * splitMin)}
                    valueMax={Math.round(usable * (1 - splitMin))}
                    valueText={`${panel.legend} ${firstPanelHeight} pixels tall`}
                    step={SPLIT_STEP}
                    dragging={draggingAxis === 'y'}
                    onDragStart={() => {
                      dragStart.current = split
                      setDraggingAxis('y')
                    }}
                    onDrag={(delta) =>
                      setSplit(usable > 0 ? dragStart.current + delta / usable : split)
                    }
                    onDragEnd={() => setDraggingAxis(null)}
                    onNudge={(delta) => setSplit(usable > 0 ? split + delta / usable : split)}
                    onExtreme={(edge) => setSplit(edge === 'start' ? 0 : 1)}
                    onReset={resetSplit}
                  />
                )}
              </Fragment>
            )
          })}
        </div>
      </motion.div>
    </main>
  )
}

interface HistoryState {
  conversations: Conversation[]
  loading: boolean
  error: string | null
  hasMore: boolean
  loadingMore: boolean
  onLoadMore: () => void
  onRetry: () => void
}

/**
 * The stored conversations, as a scroller.
 *
 * The next page is asked for when the foot of the loaded list comes into view,
 * with a margin so the list is already longer by the time the reader reaches
 * the end of it. The scroller is the observer's root: the panel scrolls, the
 * window does not.
 */
function HistoryList({
  history,
  onOpen,
  query = '',
}: {
  history: HistoryState
  onOpen: (id: string) => void
  query?: string
}) {
  const { loading, error, hasMore, loadingMore, onLoadMore, onRetry } = history
  const scrollRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)

  /* The search reads what is loaded. It does not have to ask for the rest:
     a filtered list is short, which puts the page sentinel back in view, and
     the next page arrives on its own until the history is exhausted. */
  const term = query.trim().toLowerCase()
  const conversations = term
    ? history.conversations.filter((item) => item.title.toLowerCase().includes(term))
    : history.conversations
  const empty = conversations.length === 0

  useEffect(() => {
    const root = scrollRef.current
    const sentinel = sentinelRef.current
    if (!root || !sentinel || !hasMore || loading || error) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) onLoadMore()
      },
      { root, rootMargin: '160px' },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [conversations.length, error, hasMore, loading, onLoadMore])

  return (
    <div className="history" ref={scrollRef}>
      {/* History reads from the top down, the way a list does: a short one
          starts at the top and leaves the room under it alone. */}
      <div className="history__inner">
        {empty ? (
          <p className="history__note" role={loading || error ? 'status' : undefined}>
            {loading ? (
              'Loading your conversations\u2026'
            ) : term ? (
              `Nothing loaded matches \u201c${query.trim()}\u201d.`
            ) : error ? (
              <>
                {error}{' '}
                <button type="button" className="link-btn" onClick={onRetry}>
                  Try again
                </button>
              </>
            ) : (
              'No conversations yet.'
            )}
          </p>
        ) : (
          <ul className="history__list">
            {conversations.map((conversation) => (
              <li key={conversation.id}>
                <button
                  type="button"
                  className="history__row"
                  onClick={() => onOpen(conversation.id)}
                  title={conversation.title}
                >
                  <span className="history__title">{conversation.title}</span>
                  <span className="history__when">
                    {GROUP_LABELS[historyGroup(conversation.lastUpdated)]}
                  </span>
                  <ChevronRight size={13} strokeWidth={1.8} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div ref={sentinelRef} className="history__sentinel" aria-hidden="true" />

        {!empty && loadingMore && (
          <p className="history__note history__note--foot" role="status">
            Loading more&#8230;
          </p>
        )}
        {!empty && error && (
          <p className="history__note history__note--foot" role="status">
            {error}{' '}
            <button type="button" className="link-btn" onClick={onRetry}>
              Try again
            </button>
          </p>
        )}
      </div>
    </div>
  )
}

/**
 * The landing: what the conversation panel holds when nothing is loaded.
 *
 * Quick starts, on the shelf just above the composer where the reader's hands
 * already are — and nothing else. History is a view of its own, one control
 * away, so it does not also stand here taking room from the thing this state
 * is for: starting.
 */
function Landing({ onSend }: { onSend: (text: string) => void }) {
  return (
    <div className="landing">
      <div className="landing__hero">
        <div className="landing__visual" aria-hidden="true">
          <span className="landing__visual-label">LOCAL / PRIVATE / YOURS</span>
          <span className="landing__orbit landing__orbit--outer" />
          <span className="landing__orbit landing__orbit--inner" />
          <MaiaMark fill className="landing__mark" />
          <span className="landing__visual-number">01</span>
        </div>
        <div className="landing__copy">
          <span className="landing__eyebrow">
            <LockKeyhole size={12} strokeWidth={1.8} aria-hidden="true" />
            An intelligence that stays home
          </span>
          <h1>
            <span>Think in</span>
            <span><em>private.</em></span>
          </h1>
          <p>Ask, explore, and make with a model that lives entirely on your machine.</p>
        </div>
      </div>
      <p className="landing__lead">
        <span>Four ways into the blank page</span>
        <span>Choose a thought</span>
      </p>
      <ul className="landing__suggestions">
        {SUGGESTIONS.map((suggestion, index) => (
          <li key={suggestion}>
            <button type="button" className="landing__start" onClick={() => onSend(suggestion)}>
              <span className="landing__index">{String(index + 1).padStart(2, '0')}</span>
              <span>{suggestion}</span>
              <ChevronRight size={13} strokeWidth={1.8} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * History as a view of its own, opened over whatever the panel was holding.
 *
 * It takes the whole card rather than a shelf of it, so the list is read at
 * full height. The way out is stated in the view as well as in the panel head:
 * a view that covers a conversation has to say how to get back to it.
 */
function HistoryView({
  history,
  onOpen,
  onClose,
}: {
  history: HistoryState
  onOpen: (id: string) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const field = useRef<HTMLInputElement>(null)

  /* Opening the history is nearly always opening it to look for something,
     so the field is ready rather than waiting to be clicked. */
  useEffect(() => field.current?.focus(), [])

  return (
    <div className="history-view">
      <div className="history-view__head">
        <h3 className="legend">History</h3>
        <button type="button" className="ghost-btn" onClick={onClose}>
          Close
        </button>
      </div>

      <div className="history-view__search">
        <Search size={14} strokeWidth={1.8} aria-hidden="true" />
        <input
          ref={field}
          type="search"
          value={query}
          placeholder="Search conversations"
          aria-label="Search conversations"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape' && query) {
              event.stopPropagation()
              setQuery('')
            }
          }}
        />
      </div>

      <HistoryList history={history} onOpen={onOpen} query={query} />
    </div>
  )
}
