import { useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  History,
  MessageSquareDashed,
  PanelLeftClose,
  Search,
  Settings2,
  SquarePen,
} from 'lucide-react'
import { MaiaMark } from './MaiaMark'
import { Tooltip } from './Tooltip'
import { Popover } from './Popover'
import { SettingsPanel, type Prefs } from './SettingsPanel'
import { GROUP_LABELS } from '../config'
import type { Conversation, HistoryGroup } from '../types'

const spring = { type: 'spring', stiffness: 380, damping: 34 } as const

export interface SidebarProps {
  expanded: boolean
  onToggle: (next: boolean) => void
  conversations: Conversation[]
  activeId: string | null
  onSelect: (id: string) => void
  onNewChat: () => void
  onTemporaryChat: () => void
  onOpenSearch: () => void
  temporaryActive: boolean
  prefs: Prefs
  onPrefsChange: (p: Prefs) => void
  onToast: (text: string) => void
  isDrawer?: boolean
  onCloseDrawer?: () => void
}

export function Sidebar(props: SidebarProps) {
  const {
    expanded,
    onToggle,
    conversations,
    activeId,
    onSelect,
    onNewChat,
    onTemporaryChat,
    onOpenSearch,
    temporaryActive,
    prefs,
    onPrefsChange,
    onToast,
    isDrawer = false,
    onCloseDrawer,
  } = props

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const settingsBtnRef = useRef<HTMLButtonElement>(null)
  const profileBtnRef = useRef<HTMLButtonElement>(null)

  const groups: HistoryGroup[] = ['today', 'yesterday', 'week']

  const select = (id: string) => {
    onSelect(id)
    onCloseDrawer?.()
  }

  return (
    <motion.nav
      className={`sidebar${expanded ? ' sidebar--expanded' : ''}${isDrawer ? ' sidebar--drawer' : ''}`}
      aria-label="Navigation"
      animate={isDrawer ? undefined : { width: expanded ? 276 : 64 }}
      transition={spring}
    >
      {/* ── Collapsed rail ── */}
      <AnimatePresence initial={false}>
        {!expanded && !isDrawer && (
          <motion.div
            key="rail"
            className="sidebar__rail"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.18, delay: 0.06 } }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
          >
            <Tooltip label="Maia — home" side="right">
              <button type="button" className="rail-mark" onClick={onNewChat} aria-label="Maia home">
                <MaiaMark size={26} />
              </button>
            </Tooltip>

            <div className="sidebar__rail-group">
              <Tooltip label="New chat" side="right">
                <button type="button" className="icon-btn" onClick={onNewChat} aria-label="New chat">
                  <SquarePen size={18} strokeWidth={1.8} />
                </button>
              </Tooltip>
              <Tooltip label="Search" shortcut="⌘K" side="right">
                <button type="button" className="icon-btn" onClick={onOpenSearch} aria-label="Search conversations">
                  <Search size={18} strokeWidth={1.8} />
                </button>
              </Tooltip>
              <Tooltip label="History" side="right">
                <button type="button" className="icon-btn" onClick={() => onToggle(true)} aria-label="Conversation history">
                  <History size={18} strokeWidth={1.8} />
                </button>
              </Tooltip>
              <Tooltip label="Temporary chat" side="right">
                <button
                  type="button"
                  className={`icon-btn${temporaryActive ? ' icon-btn--active' : ''}`}
                  onClick={onTemporaryChat}
                  aria-label="Start temporary chat"
                  aria-pressed={temporaryActive}
                >
                  <MessageSquareDashed size={18} strokeWidth={1.8} />
                </button>
              </Tooltip>
            </div>

            <div className="sidebar__rail-bottom">
              <Tooltip label="Preferences" side="right">
                <button
                  type="button"
                  ref={settingsBtnRef}
                  className={`icon-btn${settingsOpen ? ' icon-btn--active' : ''}`}
                  onClick={() => setSettingsOpen((v) => !v)}
                  aria-label="Preferences"
                  aria-expanded={settingsOpen}
                >
                  <Settings2 size={18} strokeWidth={1.8} />
                </button>
              </Tooltip>
              <Tooltip label="Ronald Yu" side="right">
                <button
                  type="button"
                  ref={profileBtnRef}
                  className="avatar-btn"
                  onClick={() => setProfileOpen((v) => !v)}
                  aria-label="Account"
                  aria-expanded={profileOpen}
                >
                  R
                </button>
              </Tooltip>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Expanded panel ── */}
      <AnimatePresence initial={false}>
        {(expanded || isDrawer) && (
          <motion.div
            key="panel"
            className="sidebar__panel"
            initial={{ opacity: 0, x: isDrawer ? 0 : -10 }}
            animate={{ opacity: 1, x: 0, transition: { duration: 0.22, delay: 0.05, ease: [0.22, 1, 0.36, 1] } }}
            exit={{ opacity: 0, x: -8, transition: { duration: 0.1 } }}
          >
            <div className="sidebar__head">
              <button type="button" className="sidebar__wordmark" onClick={onNewChat}>
                <MaiaMark size={22} />
                <span>Maia</span>
              </button>
              <Tooltip label="Collapse" side="bottom">
                <button
                  type="button"
                  className="icon-btn icon-btn--sm"
                  onClick={() => (isDrawer ? onCloseDrawer?.() : onToggle(false))}
                  aria-label="Collapse sidebar"
                >
                  <PanelLeftClose size={17} strokeWidth={1.8} />
                </button>
              </Tooltip>
            </div>

            <div className="sidebar__actions">
              <button type="button" className="side-row" onClick={() => { onNewChat(); onCloseDrawer?.() }}>
                <SquarePen size={16} strokeWidth={1.8} />
                <span>New chat</span>
              </button>
              <button type="button" className="side-row" onClick={() => { onOpenSearch(); onCloseDrawer?.() }}>
                <Search size={16} strokeWidth={1.8} />
                <span>Search</span>
                {prefs.showHints && <kbd className="side-row__kbd">⌘K</kbd>}
              </button>
              <button
                type="button"
                className={`side-row${temporaryActive ? ' side-row--active' : ''}`}
                onClick={() => { onTemporaryChat(); onCloseDrawer?.() }}
              >
                <MessageSquareDashed size={16} strokeWidth={1.8} />
                <span>Temporary chat</span>
              </button>
            </div>

            <div className="sidebar__history" role="list" aria-label="Conversation history">
              {groups.map((group) => {
                const items = conversations.filter((c) => c.group === group)
                if (!items.length) return null
                return (
                  <div key={group} className="sidebar__group">
                    <div className="sidebar__group-label">{GROUP_LABELS[group]}</div>
                    {items.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        role="listitem"
                        className={`convo-row${c.id === activeId ? ' convo-row--active' : ''}`}
                        onClick={() => select(c.id)}
                        title={c.title}
                      >
                        <span className="convo-row__title">{c.title}</span>
                      </button>
                    ))}
                  </div>
                )
              })}
            </div>

            <div className="sidebar__foot">
              <Tooltip label="Preferences" side="top">
                <button
                  type="button"
                  ref={expanded || isDrawer ? settingsBtnRef : undefined}
                  className={`icon-btn${settingsOpen ? ' icon-btn--active' : ''}`}
                  onClick={() => setSettingsOpen((v) => !v)}
                  aria-label="Preferences"
                  aria-expanded={settingsOpen}
                >
                  <Settings2 size={17} strokeWidth={1.8} />
                </button>
              </Tooltip>
              <button
                type="button"
                ref={profileBtnRef}
                className="sidebar__profile"
                onClick={() => setProfileOpen((v) => !v)}
                aria-expanded={profileOpen}
              >
                <span className="avatar-btn avatar-btn--static" aria-hidden="true">R</span>
                <span className="sidebar__profile-meta">
                  <span className="sidebar__profile-name">Ronald Yu</span>
                  <span className="sidebar__profile-mail">ronaldyu001@gmail.com</span>
                </span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Anchored surfaces */}
      <div className="sidebar__popover-slot">
        <Popover
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          anchorRef={settingsBtnRef}
          placement="right-end"
          width={296}
        >
          <SettingsPanel prefs={prefs} onChange={onPrefsChange} />
        </Popover>
        <Popover
          open={profileOpen}
          onClose={() => setProfileOpen(false)}
          anchorRef={profileBtnRef}
          placement="right-end"
          width={248}
        >
          <div className="profile-menu">
            <div className="profile-menu__head">
              <span className="avatar-btn avatar-btn--static" aria-hidden="true">R</span>
              <div>
                <div className="profile-menu__name">Ronald Yu</div>
                <div className="profile-menu__mail">ronaldyu001@gmail.com</div>
              </div>
            </div>
            <div className="popover__divider" />
            <button
              type="button"
              className="menu-item"
              data-menu-item
              onClick={() => {
                setProfileOpen(false)
                setSettingsOpen(true)
              }}
            >
              Preferences
            </button>
            <button
              type="button"
              className="menu-item"
              data-menu-item
              onClick={() => {
                setProfileOpen(false)
                onToast('Accounts arrive after the preview.')
              }}
            >
              Sign out
            </button>
          </div>
        </Popover>
      </div>
    </motion.nav>
  )
}
