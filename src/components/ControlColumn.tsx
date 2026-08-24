import { useRef, useState } from 'react'
import { motion } from 'motion/react'
import {
  MessagesSquare,
  MessageSquareDashed,
  PanelLeftClose,
  PanelLeft,
  Search,
  Settings2,
} from 'lucide-react'
import { MaiaMark } from './MaiaMark'
import { Tooltip } from './Tooltip'
import { Popover } from './Popover'
import { SettingsPanel, type Prefs } from './SettingsPanel'
import { GROUP_LABELS } from '../config'
import { historyGroup } from '../lib/history_groups'
import type { Conversation, HistoryGroup } from '../types'

const GROUPS: HistoryGroup[] = ['today', 'yesterday', 'week', 'older']

export interface ControlColumnProps {
  expanded: boolean
  onToggle: (next: boolean) => void
  conversations: Conversation[]
  activeId: string | null
  chatOpen: boolean
  onSelect: (id: string) => void
  historyLoading: boolean
  historyError: string | null
  onRetryHistory: () => void
  onToggleChat: () => void
  onGoDashboard: () => void
  onTemporaryChat: () => void
  onOpenSearch: () => void
  temporaryActive: boolean
  prefs: Prefs
  onPrefsChange: (p: Prefs) => void
  reduceMotion: boolean
}

/**
 * The control column is pinned: it never moves, resizes, or translates when the
 * chat region re-registers. That fixed reference is what keeps the expansion
 * reading as one mechanism reconfiguring rather than a card inflating.
 */
export function ControlColumn(props: ControlColumnProps) {
  const { expanded, conversations, activeId, chatOpen, prefs, reduceMotion } = props
  const [settingsOpen, setSettingsOpen] = useState(false)
  const settingsBtnRef = useRef<HTMLButtonElement>(null)

  return (
    <motion.nav
      className={`column${expanded ? ' column--expanded' : ''}`}
      aria-label="Navigation"
      animate={{ width: expanded ? 244 : 56 }}
      initial={false}
      transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 360, damping: 36 }}
    >
      <div className="column__head">
        <Tooltip label="Dashboard" side="right">
          <button
            type="button"
            className="column__mark"
            onClick={props.onGoDashboard}
            aria-label="Maia, go to the dashboard"
          >
            <MaiaMark size={20} />
            {expanded && <span className="column__wordmark">Maia</span>}
          </button>
        </Tooltip>
        <Tooltip label={expanded ? 'Collapse' : 'Expand'} shortcut="Ctrl+B" side="right">
          <button
            type="button"
            className="icon-btn icon-btn--sm column__toggle"
            onClick={() => props.onToggle(!expanded)}
            aria-label={expanded ? 'Collapse navigation' : 'Expand navigation'}
            aria-expanded={expanded}
          >
            {expanded ? (
              <PanelLeftClose size={16} strokeWidth={1.8} />
            ) : (
              <PanelLeft size={16} strokeWidth={1.8} />
            )}
          </button>
        </Tooltip>
      </div>

      <div className="column__actions">
        {/* Toggles the surface in place, the way temporary mode toggles the
            mode: pressing it again returns the reader to the dashboard. */}
        <ColumnRow
          expanded={expanded}
          label="Conversation"
          icon={<MessagesSquare size={16} strokeWidth={1.8} />}
          onClick={props.onToggleChat}
          active={chatOpen}
        />
        <ColumnRow
          expanded={expanded}
          label="Search"
          shortcut="Ctrl+K"
          icon={<Search size={16} strokeWidth={1.8} />}
          onClick={props.onOpenSearch}
          hint={prefs.showHints ? 'Ctrl K' : undefined}
        />
        <ColumnRow
          expanded={expanded}
          label="Temporary chat"
          icon={<MessageSquareDashed size={16} strokeWidth={1.8} />}
          onClick={props.onTemporaryChat}
          active={props.temporaryActive}
        />
      </div>

      {expanded && (
        <div className="column__history">
          <h2 className="legend column__legend">Recents</h2>
          {props.historyLoading && conversations.length === 0 ? (
            <p className="column__empty" role="status">
              Loading your conversations&#8230;
            </p>
          ) : props.historyError && conversations.length === 0 ? (
            <p className="column__empty" role="status">
              {props.historyError}{' '}
              <button type="button" className="link-btn" onClick={props.onRetryHistory}>
                Try again
              </button>
            </p>
          ) : conversations.length === 0 ? (
            <p className="column__empty">Your conversations will appear here.</p>
          ) : (
            GROUPS.map((group) => {
              const items = conversations.filter(
                (c) => historyGroup(c.lastUpdated) === group,
              )
              if (!items.length) return null
              return (
                <section key={group} className="column__group" aria-label={GROUP_LABELS[group]}>
                  <h3 className="column__group-label">{GROUP_LABELS[group]}</h3>
                  <ul className="column__list">
                    {items.map((conversation) => (
                      <li key={conversation.id}>
                        <button
                          type="button"
                          className={`column__convo${conversation.id === activeId ? ' column__convo--on' : ''}`}
                          onClick={() => props.onSelect(conversation.id)}
                          aria-current={conversation.id === activeId ? 'true' : undefined}
                          title={conversation.title}
                        >
                          {conversation.title}
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )
            })
          )}
          {/* A standing condition gets a standing line, not a toast. */}
          <p className="column__standing">
            Stored conversations open for reading. Start a new chat to continue one.
          </p>
        </div>
      )}

      <div className="column__foot">
        <Tooltip label="Preferences" side="right">
          <button
            type="button"
            ref={settingsBtnRef}
            className={`icon-btn icon-btn--sm${settingsOpen ? ' icon-btn--active' : ''}`}
            onClick={() => setSettingsOpen((v) => !v)}
            aria-label="Preferences"
            aria-expanded={settingsOpen}
          >
            <Settings2 size={16} strokeWidth={1.8} />
          </button>
        </Tooltip>
        {expanded && <span className="column__foot-label">Preferences</span>}
      </div>

      <Popover
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        anchorRef={settingsBtnRef}
        placement="right-end"
        width={292}
      >
        <SettingsPanel prefs={prefs} onChange={props.onPrefsChange} />
      </Popover>
    </motion.nav>
  )
}

function ColumnRow({
  expanded,
  label,
  icon,
  onClick,
  active,
  hint,
  shortcut,
}: {
  expanded: boolean
  label: string
  icon: React.ReactNode
  onClick: () => void
  active?: boolean
  hint?: string
  shortcut?: string
}) {
  const button = (
    <button
      type="button"
      className={`column__row${active ? ' column__row--on' : ''}`}
      onClick={onClick}
      aria-label={expanded ? undefined : label}
      aria-pressed={active}
    >
      <span className="column__row-icon" aria-hidden="true">
        {icon}
      </span>
      {expanded && <span className="column__row-label">{label}</span>}
      {expanded && hint && <kbd className="column__kbd">{hint}</kbd>}
    </button>
  )

  if (expanded) return button
  return (
    <Tooltip label={label} shortcut={shortcut} side="right">
      {button}
    </Tooltip>
  )
}
