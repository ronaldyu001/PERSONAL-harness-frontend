import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { MessageSquare, Search } from 'lucide-react'
import { GROUP_LABELS } from '../config'
import type { Conversation } from '../types'

export function SearchOverlay({
  open,
  onClose,
  conversations,
  onSelect,
  showHints,
}: {
  open: boolean
  onClose: () => void
  conversations: Conversation[]
  onSelect: (id: string) => void
  showHints: boolean
}) {
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return conversations
    return conversations.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.messages.some((m) => (m.role === 'user' ? m.text : m.md).toLowerCase().includes(q)),
    )
  }, [query, conversations])

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])



  const close = () => {
    setQuery('')
    setCursor(0)
    onClose()
  }

  const choose = (id: string) => {
    onSelect(id)
    close()
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.13 } }}
          transition={{ duration: 0.18 }}
          onClick={close}
          /* Escape works from the input, a result row, or the panel itself. */
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.stopPropagation()
              close()
            }
          }}
        >
          <motion.div
            className="search-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Search conversations"
            initial={{ opacity: 0, scale: 0.97, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -6, transition: { duration: 0.12 } }}
            transition={{ type: 'spring', stiffness: 460, damping: 36 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="search-panel__field">
              <Search size={17} strokeWidth={1.8} />
              <input
                ref={inputRef}
                value={query}
                placeholder="Search conversations"
                aria-label="Search conversations"
                onChange={(e) => {
                  setQuery(e.target.value)
                  setCursor(0)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault()
                    setCursor((c) => Math.min(c + 1, results.length - 1))
                  }
                  if (e.key === 'ArrowUp') {
                    e.preventDefault()
                    setCursor((c) => Math.max(c - 1, 0))
                  }
                  if (e.key === 'Enter' && results[cursor]) {
                    choose(results[cursor].id)
                  }
                }}
              />
              <kbd className="search-panel__esc">esc</kbd>
            </div>

            <div className="search-panel__results" role="listbox" aria-label="Results">
              {results.length === 0 ? (
                <div className="search-panel__empty">
                  <span>No conversations found</span>
                  <span className="search-panel__empty-hint">Try a different phrase</span>
                </div>
              ) : (
                results.map((c, i) => (
                  <button
                    key={c.id}
                    type="button"
                    role="option"
                    aria-selected={i === cursor}
                    className={`search-result${i === cursor ? ' search-result--cursor' : ''}`}
                    onMouseEnter={() => setCursor(i)}
                    onClick={() => choose(c.id)}
                  >
                    <MessageSquare size={15} strokeWidth={1.8} />
                    <span className="search-result__title">{c.title}</span>
                    <span className="search-result__group">{GROUP_LABELS[c.group]}</span>
                  </button>
                ))
              )}
            </div>

            {showHints && (
              <div className="search-panel__foot">
                <span>
                  <kbd>↑</kbd>
                  <kbd>↓</kbd> navigate
                </span>
                <span>
                  <kbd>⏎</kbd> open
                </span>
                <span>
                  <kbd>esc</kbd> close
                </span>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
