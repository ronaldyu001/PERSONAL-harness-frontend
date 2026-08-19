import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ChevronRight, Maximize2 } from 'lucide-react'
import { Thread } from './Thread'
import { Composer, type ComposerProps } from './Composer'
import { PANELS, PANEL_BODIES } from './panel-registry'
import { SUGGESTIONS } from '../config'
import type { Conversation, Message } from '../types'

export interface DeckProps {
  expanded: boolean
  active: Conversation | null
  conversations: Conversation[]
  convoLoading: boolean
  onOpenConversation: (id: string) => void
  onExpand: () => void
  onCollapse: () => void
  onSend: (text: string) => void
  onRegenerate: (id: string) => void
  onRetry: (id: string) => void
  onEditUser: (id: string, text: string) => void
  onToast: (text: string) => void
  composer: Omit<ComposerProps, 'onSend'>
  reduceMotion: boolean
}

const SECONDARY = PANELS.filter((panel) => panel.slot === 'secondary')

function useStackWidth() {
  const read = () => (window.innerWidth <= 1100 ? 232 : 296)
  const [width, setWidth] = useState(read)
  useEffect(() => {
    const onResize = () => setWidth(read())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return width
}

export function Deck(props: DeckProps) {
  const { expanded, active, conversations, reduceMotion } = props
  const chatPanel = PANELS.find((panel) => panel.id === 'chat')!
  const messages: Message[] = active?.messages ?? []
  /* Matches the CSS stack width per breakpoint so the animated value and the
     laid-out value never disagree. */
  const restingStackWidth = useStackWidth()
  const stackWidth = expanded ? 0 : restingStackWidth
  const transition = reduceMotion
    ? { duration: 0 }
    : { type: 'spring' as const, stiffness: 320, damping: 38 }

  return (
    <main className="deck">
      {/* The chat region's left edge is structurally fixed: it is the flex
          child that absorbs remaining width, so only its right edge travels. */}
      <section className="region region--chat" aria-labelledby="region-chat-legend">
        <header className="region__head">
          <h2 id="region-chat-legend" className="legend region__legend">
            {chatPanel.legend}
          </h2>
          {expanded && active && <span className="region__title">{active.title}</span>}
          {active?.temporary && <span className="region__flag">Temporary</span>}
          <div className="region__head-end">
            {expanded ? (
              <button type="button" className="ghost-btn" onClick={props.onCollapse}>
                Dashboard
              </button>
            ) : (
              <button
                type="button"
                className="ghost-btn ghost-btn--icon"
                onClick={props.onExpand}
                aria-label="Open the conversation surface"
              >
                <Maximize2 size={14} strokeWidth={1.9} aria-hidden="true" />
                Open
              </button>
            )}
          </div>
        </header>

        <div className="region__body">
          <AnimatePresence mode="wait" initial={false}>
            {expanded ? (
              <motion.div
                key="thread"
                className="region__fill"
                initial={reduceMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: reduceMotion ? 0 : 0.12 } }}
                transition={{ duration: reduceMotion ? 0 : 0.2 }}
              >
                {messages.length === 0 && !props.convoLoading ? (
                  <ChatEmptyState onSend={props.onSend} />
                ) : (
                  <Thread
                    messages={messages}
                    loading={props.convoLoading}
                    onRegenerate={props.onRegenerate}
                    onRetry={props.onRetry}
                    onEditUser={props.onEditUser}
                    onToast={props.onToast}
                  />
                )}
              </motion.div>
            ) : (
              <motion.div
                key="recents"
                className="region__fill"
                initial={reduceMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: reduceMotion ? 0 : 0.12 } }}
                transition={{ duration: reduceMotion ? 0 : 0.2 }}
              >
                <Recents conversations={conversations} onOpen={props.onOpenConversation} />
              </motion.div>
            )}
          </AnimatePresence>

          <div className={`region__composer${expanded ? ' region__composer--measure' : ''}`}>
            <Composer {...props.composer} onSend={props.onSend} />
          </div>
        </div>
      </section>

      {/* Secondary regions translate off-frame; they never resize the chat's
          left edge. Width animates to zero so the face stays continuous. */}
      <motion.div
        className="deck__stack"
        animate={{ width: stackWidth }}
        initial={false}
        transition={transition}
        aria-hidden={expanded}
      >
        <div className="deck__stack-inner">
          {SECONDARY.map((panel) => {
            const Body = PANEL_BODIES[panel.id]
            const legendId = `region-${panel.id}-legend`
            return (
              <section
                key={panel.id}
                className="region region--dormant"
                aria-labelledby={legendId}
                aria-disabled="true"
              >
                <header className="region__head">
                  <panel.icon size={14} strokeWidth={1.9} aria-hidden="true" />
                  <h2 id={legendId} className="legend region__legend">
                    {panel.legend}
                  </h2>
                </header>
                <div className="region__body region__body--readout">
                  {Body ? <Body /> : null}
                  <p className="region__awaiting">{panel.awaiting}</p>
                </div>
              </section>
            )
          })}
        </div>
      </motion.div>
    </main>
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
              <ChevronRight size={13} strokeWidth={1.9} aria-hidden="true" />
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
              <ChevronRight size={13} strokeWidth={1.9} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
