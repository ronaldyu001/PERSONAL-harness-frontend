import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { Check, CircleAlert, Copy, RefreshCw } from 'lucide-react'
import { MaiaMark } from './MaiaMark'
import { Markdown } from '../lib/markdown'
import { MODELS } from '../config'
import { useElapsed, formatElapsed } from '../hooks/useElapsed'
import { useInferencePath } from '../lib/inference'
import type { AssistantMessage, Message, UserMessage } from '../types'

/** Matches the startup screen threshold so both waits speak one language. */
const REASSURE_AFTER_S = 20

export interface ThreadProps {
  messages: Message[]
  loading: boolean
  onRetry: (assistantId: string) => void
  onToast: (text: string) => void
}

export function Thread({ messages, loading, onRetry, onToast }: ThreadProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const stickToBottom = useRef(true)

  const onScroll = () => {
    const el = scrollRef.current
    if (!el) return
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 96
  }

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight
  }, [messages])

  const lastIndex = messages.length - 1

  return (
    <div className="thread" ref={scrollRef} onScroll={onScroll}>
      <div className="thread__col">
        {loading ? (
          <ThreadSkeleton />
        ) : (
          messages.map((msg, index) =>
            msg.role === 'user' ? (
              <UserBlock key={msg.id} msg={msg} current={index === lastIndex} onToast={onToast} />
            ) : (
              <AssistantBlock
                key={msg.id}
                msg={msg}
                current={index === lastIndex}
                onRetry={onRetry}
                onToast={onToast}
              />
            ),
          )
        )}
        <div className="thread__tail" aria-hidden="true" />
      </div>
    </div>
  )
}

function ThreadSkeleton() {
  return (
    <div className="thread-skeleton" aria-busy="true" aria-label="Loading conversation">
      <div className="thread-skeleton__user" />
      <div className="thread-skeleton__row" style={{ width: '58%' }} />
      <div className="thread-skeleton__row" style={{ width: '92%' }} />
      <div className="thread-skeleton__row" style={{ width: '85%' }} />
      <div className="thread-skeleton__row" style={{ width: '68%' }} />
    </div>
  )
}

/**
 * Copy is the only action a turn carries.
 *
 * The row keeps its place in the layout on every turn — reserving it is what
 * stops the thread reflowing under the pointer — but on turns behind the
 * current one the ink is withheld until the turn is hovered or holds focus.
 */
function useCopyAction(text: string, notice: string, onToast: (text: string) => void) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const copy = useCallback(() => {
    navigator.clipboard.writeText(text).catch(() => {})
    setCopied(true)
    onToast(notice)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setCopied(false), 1800)
  }, [notice, onToast, text])

  return { copied, copy }
}

function CopyAction({ copied, onCopy }: { copied: boolean; onCopy: () => void }) {
  return (
    <button type="button" className="turn__action" onClick={onCopy}>
      {copied ? (
        <Check size={13} strokeWidth={1.8} aria-hidden="true" />
      ) : (
        <Copy size={13} strokeWidth={1.8} aria-hidden="true" />
      )}
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

const buttonsClass = (current: boolean) => `turn__buttons${current ? '' : ' turn__buttons--quiet'}`

/* User turn: raised field, flush left, full measure. Never a bubble. */

function UserBlock({
  msg,
  current,
  onToast,
}: {
  msg: UserMessage
  current: boolean
  onToast: (text: string) => void
}) {
  const { copied, copy } = useCopyAction(msg.text, 'Message copied', onToast)

  return (
    <motion.div
      className="turn turn--user"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
    >
      <div className="turn__field">
        <p>{msg.text}</p>
      </div>
      <div className="turn__actions">
        <div className={buttonsClass(current)}>
          <CopyAction copied={copied} onCopy={copy} />
        </div>
      </div>
    </motion.div>
  )
}

/* Assistant turn: no container at all. Prose sits directly on the page tone. */

function AssistantBlock({
  msg,
  current,
  onRetry,
  onToast,
}: {
  msg: AssistantMessage
  current: boolean
  onRetry: (id: string) => void
  onToast: (text: string) => void
}) {
  const { copied, copy } = useCopyAction(msg.md, 'Response copied', onToast)
  const thinking = msg.status === 'thinking'
  const modelName = MODELS.find((m) => m.id === msg.model)?.name ?? 'Maia'

  return (
    <motion.div
      className="turn turn--assistant"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
    >
      <div className="turn__head">
        <MaiaMark size={17} thinking={thinking} />
        <span className="turn__who">Maia</span>
      </div>

      {thinking && <ThinkingReadout msg={msg} />}

      {msg.md && <Markdown md={msg.md} animateIn={msg.status === 'streaming'} />}

      {msg.status === 'error' && (
        <div className="turn__error" role="alert">
          <CircleAlert size={15} strokeWidth={1.8} aria-hidden="true" />
          <span className="turn__error-text">
            {msg.error ?? 'Maia could not complete this response.'}
          </span>
          <button
            type="button"
            className="turn__action turn__action--retry"
            onClick={() => onRetry(msg.id)}
          >
            <RefreshCw size={13} strokeWidth={1.8} aria-hidden="true" />
            Retry
          </button>
        </div>
      )}

      {msg.status === 'stopped' && <p className="turn__note">Generation stopped.</p>}

      {(msg.status === 'complete' || msg.status === 'stopped') && (
        <div className="turn__actions">
          <div className={buttonsClass(current)}>
            <CopyAction copied={copied} onCopy={copy} />
          </div>
          <span className="turn__model">{modelName}</span>
        </div>
      )}
    </motion.div>
  )
}

/**
 * Elapsed, never progress.
 *
 * The backend returns one complete response, so there is no position to report
 * and any bar would be fiction. This shows the model, the inference path when
 * the orchestrator actually reported one, and a tabular clock counting up.
 */
function ThinkingReadout({ msg }: { msg: AssistantMessage }) {
  const seconds = useElapsed(msg.startedAt, true)
  const path = useInferencePath()
  const modelName = MODELS.find((m) => m.id === msg.model)?.name ?? 'Maia'

  return (
    <div className="turn__readout" role="status" aria-live="polite">
      <span className="turn__readout-line">
        <span>{modelName}</span>
        <span className="turn__readout-sep" aria-hidden="true">
          &#183;
        </span>
        <span className="turn__readout-tail">
          {path && <span>{path.toUpperCase()}</span>}
          <span className="turn__clock">{formatElapsed(seconds)}</span>
        </span>
      </span>
      {seconds >= REASSURE_AFTER_S && (
        <span className="turn__readout-note">
          Local models can take a moment on first launch.
        </span>
      )}
    </div>
  )
}
