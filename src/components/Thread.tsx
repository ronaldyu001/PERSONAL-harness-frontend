import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  Check,
  CircleAlert,
  Copy,
  FileText,
  FileCode2,
  FileSpreadsheet,
  Image as ImageIcon,
  PenLine,
  RefreshCw,
} from 'lucide-react'
import { MaiaMark } from './MaiaMark'
import { Tooltip } from './Tooltip'
import { Markdown } from '../lib/markdown'
import { MODELS, formatBytes } from '../config'
import type { AssistantMessage, Attachment, Message, UserMessage } from '../types'

const KIND_ICONS = {
  document: FileText,
  image: ImageIcon,
  code: FileCode2,
  data: FileSpreadsheet,
} as const

export interface ThreadProps {
  messages: Message[]
  loading: boolean
  onRegenerate: (assistantId: string) => void
  onRetry: (assistantId: string) => void
  onEditUser: (userId: string, newText: string) => void
  onToast: (text: string) => void
}

export function Thread({ messages, loading, onRegenerate, onRetry, onEditUser, onToast }: ThreadProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const stickToBottom = useRef(true)

  /* Follow streaming output unless the reader scrolled away */
  const onScroll = () => {
    const el = scrollRef.current
    if (!el) return
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 96
  }

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (el && stickToBottom.current) {
      el.scrollTop = el.scrollHeight
    }
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

/* ── Skeleton while a conversation loads ─────────────────────── */

function ThreadSkeleton() {
  return (
    <div className="thread-skeleton" aria-hidden="true">
      <div className="thread-skeleton__user" />
      <div className="thread-skeleton__row" style={{ width: '58%' }} />
      <div className="thread-skeleton__row" style={{ width: '92%' }} />
      <div className="thread-skeleton__row" style={{ width: '85%' }} />
      <div className="thread-skeleton__row" style={{ width: '68%' }} />
    </div>
  )
}

/* ── User message ────────────────────────────────────────────── */

function UserBlock({ msg, onEdit }: { msg: UserMessage; onEdit: (id: string, text: string) => void }) {
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
      className="msg-user"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 420, damping: 36 }}
    >
      <div className={`msg-user__card${editing ? ' msg-user__card--editing' : ''}`}>
        {msg.attachments.length > 0 && (
          <div className="msg-user__files">
            {msg.attachments.map((att) => (
              <AttachmentBadge key={att.id} att={att} />
            ))}
          </div>
        )}
        {editing ? (
          <div className="msg-user__edit">
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
            <div className="msg-user__edit-row">
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
                Save &amp; resend
              </button>
            </div>
          </div>
        ) : (
          <p>{msg.text}</p>
        )}
      </div>
      {!editing && (
        <div className="msg-actions msg-actions--user">
          <Tooltip label="Edit message" side="top">
            <button
              type="button"
              className="icon-btn icon-btn--xs"
              aria-label="Edit message"
              onClick={() => {
                setDraft(msg.text)
                setEditing(true)
              }}
            >
              <PenLine size={14} strokeWidth={1.8} />
            </button>
          </Tooltip>
        </div>
      )}
    </motion.div>
  )
}

function AttachmentBadge({ att }: { att: Attachment }) {
  const Icon = KIND_ICONS[att.kind]
  return (
    <span className="attachment-chip attachment-chip--static">
      <span className={`attachment-chip__icon attachment-chip__icon--${att.kind}`}>
        <Icon size={14} strokeWidth={1.8} />
      </span>
      <span className="attachment-chip__meta">
        <span className="attachment-chip__name">{att.name}</span>
        <span className="attachment-chip__size">{formatBytes(att.size)}</span>
      </span>
    </span>
  )
}

/* ── Assistant message ───────────────────────────────────────── */

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
  const busy = msg.status === 'thinking' || msg.status === 'streaming'
  const modelName = MODELS.find((m) => m.id === msg.model)?.name ?? 'Maia'

  const copy = () => {
    navigator.clipboard.writeText(msg.md).catch(() => {})
    setCopied(true)
    onToast('Response copied')
    window.setTimeout(() => setCopied(false), 1800)
  }

  return (
    <motion.div
      className="msg-assistant"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 420, damping: 36 }}
    >
      <div className="msg-assistant__head">
        <MaiaMark size={17} thinking={busy} />
        <span className="msg-assistant__name">Maia</span>
        <AnimatePresence>
          {msg.status === 'thinking' && (
            <motion.span
              className="msg-assistant__thinking"
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.15 } }}
            >
              Thinking…
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {msg.md && <Markdown md={msg.md} animateIn={msg.status === 'streaming'} />}

      {msg.status === 'error' && (
        <motion.div
          className="msg-error"
          role="alert"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 480, damping: 36 }}
        >
          <CircleAlert size={15} strokeWidth={1.9} />
          <div className="msg-error__meta">
            <span>Maia hit a snag while responding.</span>
            <span className="msg-error__hint">The connection dropped — nothing was lost.</span>
          </div>
          <button type="button" className="retry-btn" onClick={() => onRetry(msg.id)}>
            <RefreshCw size={13} strokeWidth={2} />
            Retry
          </button>
        </motion.div>
      )}

      {msg.status === 'stopped' && <div className="msg-stopped">Generation stopped</div>}

      {(msg.status === 'complete' || msg.status === 'stopped') && (
        <div className="msg-actions">
          <Tooltip label={copied ? 'Copied' : 'Copy response'} side="top">
            <button type="button" className="icon-btn icon-btn--xs" aria-label="Copy response" onClick={copy}>
              {copied ? <Check size={14} strokeWidth={2} /> : <Copy size={14} strokeWidth={1.8} />}
            </button>
          </Tooltip>
          <Tooltip label="Regenerate" side="top">
            <button
              type="button"
              className="icon-btn icon-btn--xs"
              aria-label="Regenerate response"
              onClick={() => onRegenerate(msg.id)}
            >
              <RefreshCw size={14} strokeWidth={1.8} />
            </button>
          </Tooltip>
          <span className="msg-actions__model">{modelName}</span>
        </div>
      )}
    </motion.div>
  )
}
