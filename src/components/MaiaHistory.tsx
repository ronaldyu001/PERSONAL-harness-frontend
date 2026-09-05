import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowUpRight, Search, X } from 'lucide-react'
import { GROUP_LABELS } from '../config'
import { historyGroup } from '../lib/history_groups'
import type { Conversation, HistoryGroup } from '../types'

const GROUPS: HistoryGroup[] = ['today', 'yesterday', 'week', 'older']

export interface MaiaHistoryProps {
  open: boolean
  conversations: Conversation[]
  activeId: string | null
  loading: boolean
  error: string | null
  hasMore: boolean
  loadingMore: boolean
  reduceMotion: boolean
  onOpen: (id: string) => void
  onClose: () => void
  onLoadMore: () => void
  onRetry: () => void
}

export function MaiaHistory({
  open,
  conversations,
  activeId,
  loading,
  error,
  hasMore,
  loadingMore,
  reduceMotion,
  onOpen,
  onClose,
  onLoadMore,
  onRetry,
}: MaiaHistoryProps) {
  const [query, setQuery] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const frame = window.requestAnimationFrame(() => searchRef.current?.focus({ preventScroll: true }))
    return () => window.cancelAnimationFrame(frame)
  }, [open])

  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase()
    return term
      ? conversations.filter((conversation) =>
          conversation.title.toLocaleLowerCase().includes(term),
        )
      : conversations
  }, [conversations, query])

  useEffect(() => {
    if (!open || loading || loadingMore || error || !hasMore) return
    const root = scrollerRef.current
    const sentinel = sentinelRef.current
    if (!root || !sentinel) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) onLoadMore()
      },
      { root, rootMargin: '180px' },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [error, filtered.length, hasMore, loading, loadingMore, onLoadMore, open])

  const emptyMessage = loading
    ? 'Reading your conversations…'
    : error
      ? error
      : query.trim()
        ? `Nothing loaded matches “${query.trim()}”.`
        : 'No saved conversations yet.'

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button"
            className="maia-history__scrim"
            aria-label="Close conversation history"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.18 }}
          />
          <motion.aside
            className="maia-history"
            role="dialog"
            aria-modal="false"
            aria-labelledby="maia-history-title"
            initial={reduceMotion ? false : { x: '-24px', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { x: '-18px', opacity: 0 }}
            transition={
              reduceMotion
                ? { duration: 0 }
                : { type: 'spring', stiffness: 380, damping: 38, mass: 0.9 }
            }
          >
            <header className="maia-history__header">
              <div>
                <p className="maia-history__eyebrow">Conversation history</p>
                <h2 id="maia-history-title">Things we’ve held onto</h2>
              </div>
              <button type="button" className="maia-history__close" onClick={onClose}>
                <X size={17} strokeWidth={1.7} aria-hidden="true" />
                <span className="visually-hidden">Close history</span>
              </button>
            </header>

            <label className="maia-history__search">
              <Search size={15} strokeWidth={1.6} aria-hidden="true" />
              <span className="visually-hidden">Search conversations</span>
              <input
                ref={searchRef}
                type="search"
                value={query}
                placeholder="Find a conversation"
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape' && query) {
                    event.stopPropagation()
                    setQuery('')
                  }
                }}
              />
            </label>

            <div ref={scrollerRef} className="maia-history__scroll">
              {filtered.length === 0 ? (
                <div className="maia-history__empty" role={loading || error ? 'status' : undefined}>
                  <p>{emptyMessage}</p>
                  {error && (
                    <button type="button" onClick={onRetry}>
                      Try again
                    </button>
                  )}
                </div>
              ) : (
                <div className="maia-history__groups">
                  {GROUPS.map((group) => {
                    const items = filtered.filter(
                      (conversation) => historyGroup(conversation.lastUpdated) === group,
                    )
                    if (items.length === 0) return null
                    return (
                      <section key={group} aria-labelledby={`maia-history-${group}`}>
                        <h3 id={`maia-history-${group}`}>{GROUP_LABELS[group]}</h3>
                        <ul>
                          {items.map((conversation) => (
                            <li key={conversation.id}>
                              <button
                                type="button"
                                className={conversation.id === activeId ? 'is-active' : undefined}
                                aria-current={conversation.id === activeId ? 'true' : undefined}
                                onClick={() => onOpen(conversation.id)}
                              >
                                <span>{conversation.title}</span>
                                <ArrowUpRight size={14} strokeWidth={1.5} aria-hidden="true" />
                              </button>
                            </li>
                          ))}
                        </ul>
                      </section>
                    )
                  })}
                </div>
              )}
              <div ref={sentinelRef} className="maia-history__sentinel" aria-hidden="true" />
              {loadingMore && (
                <p className="maia-history__loading" role="status">
                  Reading more…
                </p>
              )}
              {!loading && !error && conversations.length === 0 && (
                <p className="maia-history__source-note">
                  Maia will list conversations here when the backend stores them.
                </p>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
