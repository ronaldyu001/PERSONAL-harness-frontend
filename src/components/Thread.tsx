import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { Check, CircleAlert, Copy, PenLine, RefreshCw } from 'lucide-react'
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
  onRegenerate: (assistantId: string) => void
  onRetry: (assistantId: string) => void
  onEditUser: (userId: string, newText: string) => void
  onToast: (text: string) => void
}

export function Thread({
  messages,
  loading,
  onRegenerate,
  onRetry,
  onEditUser,
  onToast,
}: ThreadProps) {
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

  return (
    <div className="thread" ref={scrollRef} onScroll={onScroll}>
      <div className="thread__col">
        {loading ? (
          <ThreadSkeleton />
        ) : (
          messages.map((msg) =>
            msg.role === 'user' ? (
              <UserBlock key={msg.id} msg={msg} onEdit={onEditUser} />
            ) : (
              <AssistantBlock
                key={msg.id}
                msg={msg}
                onRegenerate={onRegenerate}
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

/* User turn: raised field, 1px seam, flush left, full measure. Never a bubble. */

function UserBlock({
  msg,
  onEdit,
}: {
  msg: UserMessage
  onEdit: (id: string, text: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(msg.text)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (editing) {
      const el = textareaRef.current
      el?.focus()
      el?.setSelectionRange(el.value.length, el.value.length)
    }
  }, [editing])

  const save = () => {
    const next = draft.trim()
    setEditing(false)
    if (next && next !== msg.text) onEdit(msg.id, next)
    else setDraft(msg.text)
  }

  return (
    <motion.div
      className="turn turn--user"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
    >
      <div className={`turn__field${editing ? ' turn__field--editing' : ''}`}>
        {editing ? (
          <div className="turn__edit">
            <textarea
              ref={textareaRef}
              value={draft}
              rows={Math.min(6, Math.max(2, draft.split('\n').length))}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  save()
                }
                if (e.key === 'Escape') {
                  setEditing(false)
                  setDraft(msg.text)
                }
              }}
              aria-label="Edit message"
            />
            <div className="turn__edit-row">
              <button
                type="button"
                className="ghost-btn"
                onClick={() => {
                  setEditing(false)
                  setDraft(msg.text)
                }}
              >
                Cancel
              </button>
              <button type="button" className="solid-btn" onClick={save} disabled={!draft.trim()}>
                Save and resend
              </button>
            </div>
          </div>
        ) : (
          <p>{msg.text}</p>
        )}
      </div>
      {!editing && (
        <div className="turn__actions">
          <button
            type="button"
            className="turn__action"
            onClick={() => {
              setDraft(msg.text)
              setEditing(true)
            }}
          >
            <PenLine size={13} strokeWidth={1.9} aria-hidden="true" />
            Edit
          </button>
        </div>
      )}
    </motion.div>
  )
}

/* Assistant turn: no container at all. Prose sits directly on the page tone. */

function AssistantBlock({
  msg,
  onRegenerate,
  onRetry,
  onToast,
}: {
  msg: AssistantMessage
  onRegenerate: (id: string) => void
  onRetry: (id: string) => void
  onToast: (text: string) => void
}) {
  const [copied, setCopied] = useState(false)
  const thinking = msg.status === 'thinking'
  const modelName = MODELS.find((m) => m.id === msg.model)?.name ?? 'Maia'

  const copy = () => {
    navigator.clipboard.writeText(msg.md).catch(() => {})
    setCopied(true)
    onToast('Response copied')
    window.setTimeout(() => setCopied(false), 1800)
  }

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
          <CircleAlert size={15} strokeWidth={1.9} aria-hidden="true" />
          <span className="turn__error-text">
            {msg.error ?? 'Maia could not complete this response.'}
          </span>
          <button
            type="button"
            className="turn__action turn__action--retry"
            onClick={() => onRetry(msg.id)}
          >
            <RefreshCw size={13} strokeWidth={1.9} aria-hidden="true" />
            Retry
          </button>
        </div>
      )}

      {msg.status === 'stopped' && <p className="turn__note">Generation stopped.</p>}

      {(msg.status === 'complete' || msg.status === 'stopped') && (
        <div className="turn__actions">
          <button type="button" className="turn__action" onClick={copy}>
            {copied ? (
              <Check size={13} strokeWidth={2} aria-hidden="true" />
            ) : (
              <Copy size={13} strokeWidth={1.9} aria-hidden="true" />
            )}
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button type="button" className="turn__action" onClick={() => onRegenerate(msg.id)}>
            <RefreshCw size={13} strokeWidth={1.9} aria-hidden="true" />
            Regenerate
          </button>
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
        {path && <span className="turn__readout-seg">{path.toUpperCase()}</span>}
        <span className="turn__clock">{formatElapsed(seconds)}</span>
      </span>
      {seconds >= REASSURE_AFTER_S && (
        <span className="turn__readout-note">
          Local models can take a moment on first launch.
        </span>
      )}
    </div>
  )
}
