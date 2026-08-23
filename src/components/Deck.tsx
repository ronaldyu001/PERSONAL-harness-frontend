import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ChevronRight, Maximize2, SquarePen } from 'lucide-react'
import { Thread } from './Thread'
import { Composer, type ComposerProps } from './Composer'
import { Tooltip } from './Tooltip'
import { PANELS, PANEL_BODIES } from './panel-registry'
import { SUGGESTIONS } from '../config'
import type { Conversation, Message } from '../types'

export interface DeckProps {
  expanded: boolean
  active: Conversation | null
  temporaryActive: boolean
  conversations: Conversation[]
  convoLoading: boolean
  onOpenConversation: (id: string) => void
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

const PANEL_GAP_FALLBACK = 8

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
const RESIZER_THICKNESS = 14
const STACK_STORAGE_KEY = 'harness.dashboard.stackWidth'
const SPLIT_STORAGE_KEY = 'harness.dashboard.readoutSplit'

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

const readStored = (key: string): number | null => {
  try {
    const parsed = Number.parseFloat(window.localStorage.getItem(key) ?? '')
    return Number.isFinite(parsed) ? parsed : null
  } catch {
    return null
  }
}

const writeStored = (key: string, value: number | null) => {
  try {
    if (value === null) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, String(value))
  } catch {
    /* The split still works for this session when storage is unavailable. */
  }
}

/* The gutter between the chat panel and the stack lives inside the stack, so
   the animated width has to carry it: panel plus gutter collapse as one and
   the chat panel's right edge lands flush against the frame. --panel-gap is
   deliberately constant across densities, which is what lets a single read
   stay in step with the stylesheet. */
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
function useDeckSizing(deckRef: React.RefObject<HTMLElement | null>) {
  const [panelGap] = useState(readPanelGap)
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
     rather than derived: both ceilings have to follow the room that is left. */
  useLayoutEffect(() => {
    const el = deckRef.current
    if (!el) return
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

  /* Three things can occupy the panel, and the loaded conversation outranks
     both: the dashboard shows the conversation it is holding, and falls back
     to history only when there is nothing loaded to show. */
  const view: 'thread' | 'quick-starts' | 'recents' =
    messages.length > 0 || convoLoading
      ? 'thread'
      : expanded || props.temporaryActive
        ? 'quick-starts'
        : 'recents'

  const restingStackWidth = width + panelGap
  const stackWidth = expanded ? 0 : restingStackWidth
  const chatWidth = Math.max(0, deck.width - restingStackWidth)
  const firstPanelHeight = Math.round(usable * split)
  const transition = reduceMotion
    ? { duration: 0 }
    : { type: 'spring' as const, stiffness: 320, damping: 38 }

  return (
    <main className="deck" ref={deckRef}>
      {/* The chat region's left edge is structurally fixed: it is the flex
          child that absorbs remaining width, so only its right edge travels. */}
      <section className="region region--chat" aria-labelledby="region-chat-legend">
        <header className="region__head">
          <h2 id="region-chat-legend" className="legend region__legend">
            {chatPanel.legend}
          </h2>
          {active && view === 'thread' && <span className="region__title">{active.title}</span>}
          {(props.temporaryActive || active?.temporary) && (
            <span className="region__flag">Temporary</span>
          )}
          <div className="region__head-end">
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
              <button type="button" className="ghost-btn" onClick={props.onCollapse}>
                Dashboard
              </button>
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
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={view}
              className="region__fill"
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: reduceMotion ? 0 : 0.12 } }}
              transition={{ duration: reduceMotion ? 0 : 0.2 }}
            >
              {view === 'thread' ? (
                <Thread
                  messages={messages}
                  loading={convoLoading}
                  onRetry={props.onRetry}
                  onToast={props.onToast}
                />
              ) : view === 'quick-starts' ? (
                <ChatEmptyState onSend={props.onSend} />
              ) : (
                <Recents conversations={conversations} onOpen={props.onOpenConversation} />
              )}
            </motion.div>
          </AnimatePresence>

          {/* The composer holds the reading axis under every view. What fills
              the region above it changes; the axis it is measured on does not,
              so nothing the reader toggles moves the input under their hands. */}
          <div className="region__composer">
            <Composer {...props.composer} onSend={props.onSend} />
          </div>
        </div>
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

/**
 * A separator sits in the gutter it moves and draws nothing there — between
 * two floating panels the ground already is the line. The rule arrives under
 * the pointer or on focus, and runs the full gutter while it is held.
 */
function Separator({
  orientation,
  style,
  label,
  valueNow,
  valueMin,
  valueMax,
  valueText,
  step,
  dragging,
  onDragStart,
  onDrag,
  onDragEnd,
  onNudge,
  onExtreme,
  onReset,
}: {
  orientation: 'vertical' | 'horizontal'
  style: React.CSSProperties
  label: string
  valueNow: number
  valueMin: number
  valueMax: number
  valueText: string
  step: number
  dragging: boolean
  onDragStart: () => void
  onDrag: (delta: number) => void
  onDragEnd: () => void
  onNudge: (delta: number) => void
  onExtreme: (edge: 'start' | 'end') => void
  onReset: () => void
}) {
  const axis = orientation === 'vertical' ? 'x' : 'y'
  const origin = useRef(0)

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    event.preventDefault()
    const target = event.currentTarget
    origin.current = axis === 'x' ? event.clientX : event.clientY
    target.setPointerCapture(event.pointerId)
    onDragStart()
    document.body.dataset.resizing = axis

    const move = (ev: PointerEvent) =>
      onDrag((axis === 'x' ? ev.clientX : ev.clientY) - origin.current)
    const release = () => {
      target.releasePointerCapture(event.pointerId)
      target.removeEventListener('pointermove', move)
      onDragEnd()
      delete document.body.dataset.resizing
    }

    target.addEventListener('pointermove', move)
    target.addEventListener('pointerup', release, { once: true })
    target.addEventListener('pointercancel', release, { once: true })
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const back = axis === 'x' ? 'ArrowLeft' : 'ArrowUp'
    const forward = axis === 'x' ? 'ArrowRight' : 'ArrowDown'
    const distance = event.shiftKey ? step * 3 : step

    if (event.key === back) onNudge(-distance)
    else if (event.key === forward) onNudge(distance)
    else if (event.key === 'Home') onExtreme('start')
    else if (event.key === 'End') onExtreme('end')
    else if (event.key === 'Enter') onReset()
    else return

    event.preventDefault()
  }

  return (
    <div
      className={`deck__resizer deck__resizer--${axis}${dragging ? ' deck__resizer--dragging' : ''}`}
      style={style}
      role="separator"
      tabIndex={0}
      aria-orientation={orientation}
      aria-label={label}
      aria-valuemin={valueMin}
      aria-valuemax={valueMax}
      aria-valuenow={valueNow}
      aria-valuetext={valueText}
      onDoubleClick={onReset}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
    >
      <span className="deck__resizer-line" aria-hidden="true" />
    </div>
  )
}

function Recents({
  conversations,
  onOpen,
}: {
  conversations: Conversation[]
  onOpen: (id: string) => void
}) {
  if (conversations.length === 0) {
    return (
      <div className="recents recents--empty">
        <p className="recents__empty-line">No conversations yet.</p>
        <p className="recents__empty-hint">Ask Maia something to begin.</p>
      </div>
    )
  }

  return (
    <div className="recents">
      <ul className="recents__list">
        {conversations.slice(0, 7).map((conversation) => (
          <li key={conversation.id}>
            <button type="button" className="recents__row" onClick={() => onOpen(conversation.id)}>
              <span className="recents__title">{conversation.title}</span>
              <ChevronRight size={13} strokeWidth={1.8} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ChatEmptyState({ onSend }: { onSend: (text: string) => void }) {
  return (
    <div className="chat-empty">
      <p className="chat-empty__lead">Ask Maia anything. Nothing leaves this machine.</p>
      <ul className="chat-empty__list">
        {SUGGESTIONS.map((suggestion) => (
          <li key={suggestion}>
            <button type="button" className="chat-empty__row" onClick={() => onSend(suggestion)}>
              <span>{suggestion}</span>
              <ChevronRight size={13} strokeWidth={1.8} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
