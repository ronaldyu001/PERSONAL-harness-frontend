import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  ArrowUp,
  Check,
  ChevronDown,
  MessageSquareDashed,
  Paperclip,
  Square,
} from 'lucide-react'
import { MODELS } from '../config'
import { Popover } from './Popover'
import { Tooltip } from './Tooltip'

export interface ComposerProps {
  onSend: (text: string) => void
  streaming: boolean
  onStop: () => void
  model: string
  onModelChange: (id: string) => void
  temporary: boolean
  onToggleTemporary: () => void
  showHints: boolean
  interfaceStyle: 'snug' | 'default' | 'roomy'
  autoFocus?: boolean
}

export function Composer({
  onSend,
  streaming,
  onStop,
  model,
  onModelChange,
  temporary,
  onToggleTemporary,
  showHints,
  interfaceStyle,
  autoFocus,
}: ComposerProps) {
  const [text, setText] = useState('')
  const [modelOpen, setModelOpen] = useState(false)
  const [pressed, setPressed] = useState(false)
  const [inputHeight, setInputHeight] = useState(24)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const replicaRef = useRef<HTMLDivElement>(null)
  const modelButtonRef = useRef<HTMLButtonElement>(null)

  const canSend = text.trim().length > 0 && !streaming
  const currentModel = MODELS.find((item) => item.id === model) ?? MODELS[0]

  useLayoutEffect(() => {
    const replica = replicaRef.current
    if (!replica) return
    const lineHeight = Number.parseFloat(window.getComputedStyle(replica).lineHeight) || 24
    setInputHeight(Math.min(Math.max(replica.scrollHeight, lineHeight), 220))
  }, [text, interfaceStyle])

  useEffect(() => {
    if (autoFocus) textareaRef.current?.focus()
  }, [autoFocus])

  const submit = () => {
    if (!canSend) return
    onSend(text.trim())
    setText('')
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      submit()
    }
  }

  return (
    <motion.div
      className={`composer${temporary ? ' composer--temp' : ''}`}
      animate={{ scale: pressed ? 0.992 : 1 }}
      transition={{ type: 'spring', stiffness: 800, damping: 40 }}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      onClick={() => textareaRef.current?.focus()}
    >
      <motion.div
        className="composer__input"
        animate={{ height: inputHeight }}
        transition={{ type: 'spring', stiffness: 620, damping: 42 }}
      >
        <textarea
          ref={textareaRef}
          value={text}
          rows={1}
          placeholder="Ask Maia anything"
          aria-label="Message Maia"
          onChange={(event) => setText(event.target.value)}
          onKeyDown={handleKeyDown}
        />
        <div ref={replicaRef} className="composer__replica" aria-hidden="true">
          {text || ' '}
          {'​'}
        </div>
      </motion.div>

      <div className="composer__row">
        <Tooltip label="Attachments are not supported yet" side="top">
          <button
            type="button"
            className="icon-btn icon-btn--sm"
            aria-label="Attachments are not supported yet"
            disabled
            onClick={(event) => event.stopPropagation()}
          >
            <Paperclip size={16} strokeWidth={1.8} />
          </button>
        </Tooltip>

        <div className="composer__model-slot">
          <button
            type="button"
            ref={modelButtonRef}
            id="model-trigger"
            className={`model-chip${modelOpen ? ' model-chip--open' : ''}`}
            aria-haspopup="menu"
            aria-expanded={modelOpen}
            onClick={(event) => {
              event.stopPropagation()
              setModelOpen((open) => !open)
            }}
          >
            <span>{currentModel.name}</span>
            <motion.span
              className="model-chip__chev"
              animate={{ rotate: modelOpen ? 180 : 0 }}
              transition={{ duration: 0.18 }}
            >
              <ChevronDown size={13} strokeWidth={2} />
            </motion.span>
          </button>
          <Popover
            open={modelOpen}
            onClose={() => setModelOpen(false)}
            anchorRef={modelButtonRef}
            placement="top-start"
            width={264}
            labelledBy="model-trigger"
          >
            <div className="model-menu">
              <div className="model-menu__title">Model</div>
              {MODELS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`menu-item model-menu__item${item.id === model ? ' model-menu__item--on' : ''}`}
                  data-menu-item
                  role="menuitemradio"
                  aria-checked={item.id === model}
                  onClick={() => {
                    onModelChange(item.id)
                    setModelOpen(false)
                  }}
                >
                  <span className="model-menu__meta">
                    <span className="model-menu__name">
                      {item.name}
                      {item.badge && (
                        <span className="model-menu__badge">{item.badge}</span>
                      )}
                    </span>
                    <span className="model-menu__caption">{item.caption}</span>
                  </span>
                  {item.id === model && (
                    <Check
                      size={15}
                      strokeWidth={2.2}
                      className="model-menu__check"
                    />
                  )}
                </button>
              ))}
            </div>
          </Popover>
        </div>

        <Tooltip
          label={
            temporary
              ? 'Temporary chat on — hidden from history'
              : 'Temporary chat'
          }
          side="top"
        >
          <button
            type="button"
            className={`icon-btn icon-btn--sm${temporary ? ' icon-btn--accent' : ''}`}
            aria-label="Toggle temporary chat"
            aria-pressed={temporary}
            onClick={(event) => {
              event.stopPropagation()
              onToggleTemporary()
            }}
          >
            <MessageSquareDashed size={16} strokeWidth={1.8} />
          </button>
        </Tooltip>

        <div className="composer__spacer" />

        <AnimatePresence>
          {showHints && canSend && (
            <motion.span
              className="composer__hint"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <kbd>⏎</kbd> to send
            </motion.span>
          )}
        </AnimatePresence>

        {streaming ? (
          <Tooltip label="Stop generating" side="top">
            <motion.button
              type="button"
              className="send-btn send-btn--stop"
              aria-label="Stop generating"
              onClick={(event) => {
                event.stopPropagation()
                onStop()
              }}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              whileTap={{ scale: 0.92 }}
            >
              <Square size={11} strokeWidth={0} fill="currentColor" />
            </motion.button>
          </Tooltip>
        ) : (
          <motion.button
            type="button"
            className="send-btn"
            aria-label="Send message"
            disabled={!canSend}
            onClick={(event) => {
              event.stopPropagation()
              submit()
            }}
            whileTap={canSend ? { scale: 0.9 } : undefined}
            animate={{ scale: 1 }}
          >
            <ArrowUp size={16} strokeWidth={2.4} />
          </motion.button>
        )}
      </div>
    </motion.div>
  )
}
