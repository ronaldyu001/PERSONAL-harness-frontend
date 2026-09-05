import { ArrowUpRight, Moon, Sun } from 'lucide-react'
import { ParticleSphere, type ParticleSphereState } from './ParticleSphere'
import { Thread } from './Thread'
import { Tooltip } from './Tooltip'
import type { Conversation } from '../types'

const QUICK_STARTS = [
  {
    label: 'Shape my day',
    prompt: 'Help me shape the rest of today without overfilling it',
  },
  {
    label: 'Draft a note',
    prompt: 'Help me write a warm note to someone',
  },
  {
    label: 'Think beside me',
    prompt: 'I need to think through something slowly',
  },
] as const

export interface MaiaRoomProps {
  active: Conversation | null
  conversationLoading: boolean
  state: ParticleSphereState
  threadVisible: boolean
  reduceMotion: boolean
  theme: 'dark' | 'light'
  onSend: (text: string) => void
  onRetry: (assistantId: string) => void
  onToast: (text: string) => void
  onNewConversation: () => void
  onInspectConversation: (sessionId: string) => void
  onThemeChange: (theme: 'dark' | 'light') => void
}

export function MaiaRoom({
  active,
  conversationLoading,
  state,
  threadVisible,
  reduceMotion,
  theme,
  onSend,
  onRetry,
  onToast,
  onNewConversation,
  onInspectConversation,
  onThemeChange,
}: MaiaRoomProps) {
  const landingAccessible = state === 'landing' || state === 'leaving'
  const conversationAccessible = Boolean(active && threadVisible)
  const nextTheme = theme === 'dark' ? 'light' : 'dark'

  return (
    <main className={`maia-room maia-room--${state}`}>
      <header className="maia-room__header">
        <span>{conversationAccessible ? 'With Maia' : 'Maia’s room'}</span>
        <div className="maia-room__header-actions">
          {active && (
            <div className="maia-room__conversation-actions">
              <button type="button" onClick={() => onInspectConversation(active.id)}>
                How Maia worked
              </button>
              <button type="button" onClick={onNewConversation}>
                New conversation
              </button>
            </div>
          )}
          <Tooltip label={`Switch to ${nextTheme} mode`} side="bottom">
            <button
              type="button"
              role="switch"
              aria-label="Dark mode"
              aria-checked={theme === 'dark'}
              className="maia-room__mode-switch"
              onClick={() => onThemeChange(nextTheme)}
            >
              <span className="maia-room__mode-glyph" aria-hidden="true">
                {theme === 'dark' ? (
                  <Moon size={14} strokeWidth={1.8} />
                ) : (
                  <Sun size={15} strokeWidth={1.8} />
                )}
              </span>
            </button>
          </Tooltip>
        </div>
      </header>

      <section
        className="maia-room__landing"
        aria-label="Maia’s room"
        aria-hidden={!landingAccessible}
        inert={!landingAccessible ? true : undefined}
      >
        <div className="maia-room__copy">
          <p className="maia-room__eyebrow">Maia has the day in hand</p>
          <h1>
            Let’s make room
            <br />
            for what <em>matters.</em>
          </h1>
          <div className="maia-room__intro">
            <span aria-hidden="true" />
            <p>
              I’ve kept your day nearby. Bring me the loose ends and I’ll help arrange the
              next gentle step.
            </p>
          </div>
        </div>

        <div className="maia-room__art" aria-hidden="true">
          <ParticleSphere
            state={state}
            reduceMotion={reduceMotion}
            className="maia-room__particles"
          />
        </div>

        <div className="maia-room__quick-starts" aria-label="Ways to begin">
          {QUICK_STARTS.map((item, index) => (
            <button key={item.label} type="button" onClick={() => onSend(item.prompt)}>
              <small>{String(index + 1).padStart(2, '0')}</small>
              <span>{item.label}</span>
              <ArrowUpRight size={14} strokeWidth={1.5} aria-hidden="true" />
            </button>
          ))}
        </div>
      </section>

      <section
        className={`maia-room__conversation${threadVisible ? ' is-visible' : ''}`}
        aria-label="Conversation with Maia"
        aria-hidden={!conversationAccessible}
        inert={!conversationAccessible ? true : undefined}
      >
        <div className="maia-room__thread-shell">
          {active ? (
            <Thread
              messages={active.messages}
              loading={conversationLoading}
              onRetry={onRetry}
              onToast={onToast}
            />
          ) : null}
        </div>
      </section>
    </main>
  )
}
