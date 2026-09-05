import { useEffect, useId, useMemo, useRef, useState, type RefObject } from 'react'
import { MaiaMark } from './MaiaMark'

export type MaiaRailArea = 'conversation' | 'history' | 'investigate'

export interface MaiaRailProps {
  activeArea: MaiaRailArea
  onNavigate: (area: MaiaRailArea) => void
  settingsOpen: boolean
  onSettingsToggle: () => void
  settingsButtonRef?: RefObject<HTMLButtonElement | null>
  tasksDisconnectedLabel?: string
  weatherDisconnectedLabel?: string
}

const NAV_ITEMS: ReadonlyArray<{ area: MaiaRailArea; label: string }> = [
  { area: 'conversation', label: 'Conversation' },
  { area: 'history', label: 'History' },
  { area: 'investigate', label: 'How Maia worked' },
]

const CLOCK_REFRESH_MS = 30_000

export function MaiaRail({
  activeArea,
  onNavigate,
  settingsOpen,
  onSettingsToggle,
  settingsButtonRef,
  tasksDisconnectedLabel = 'Awaiting a task source.',
  weatherDisconnectedLabel = 'Awaiting a weather source.',
}: MaiaRailProps) {
  const [now, setNow] = useState(() => new Date())
  const [pressing, setPressing] = useState(false)
  const pressingRef = useRef(false)
  const pressedAt = useRef(0)
  const releaseTimer = useRef<number | undefined>(undefined)
  const railId = useId()
  const timeFormatter = useMemo(
    () => new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }),
    [],
  )
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      }),
    [],
  )

  useEffect(() => {
    const refreshClock = () => setNow(new Date())
    const timer = window.setInterval(refreshClock, CLOCK_REFRESH_MS)
    window.addEventListener('focus', refreshClock)

    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', refreshClock)
    }
  }, [])

  useEffect(() => () => window.clearTimeout(releaseTimer.current), [])

  const beginPress = () => {
    window.clearTimeout(releaseTimer.current)
    pressedAt.current = performance.now()
    pressingRef.current = true
    setPressing(true)
  }

  const endPress = () => {
    if (!pressingRef.current) return
    const remaining = Math.max(0, 140 - (performance.now() - pressedAt.current))
    window.clearTimeout(releaseTimer.current)
    releaseTimer.current = window.setTimeout(() => {
      pressingRef.current = false
      setPressing(false)
    }, remaining)
  }

  const localTime = timeFormatter.format(now)
  const localDate = dateFormatter.format(now)

  return (
    <aside className="maia-rail" aria-label="Maia overview and navigation">
      <header className="maia-rail__brand">
        {/* `maia-hit-target-44` is the stylesheet contract for a 44px square
            minimum pointer target; the wordmark stays outside the button. */}
        <button
          ref={settingsButtonRef}
          type="button"
          className={`maia-rail__settings-button maia-hit-target-44${pressing ? ' is-pressing' : ''}`}
          aria-label={settingsOpen ? 'Close appearance settings' : 'Open appearance settings'}
          aria-haspopup="dialog"
          aria-expanded={settingsOpen}
          onClick={onSettingsToggle}
          onPointerDown={(event) => {
            if (event.pointerType !== 'mouse' || event.button === 0) beginPress()
          }}
          onPointerUp={endPress}
          onPointerCancel={endPress}
          onPointerLeave={endPress}
          onKeyDown={(event) => {
            if (!event.repeat && (event.key === 'Enter' || event.key === ' ')) beginPress()
          }}
          onKeyUp={(event) => {
            if (event.key === 'Enter' || event.key === ' ') endPress()
          }}
          onBlur={endPress}
        >
          <span
            className="maia-rail__mark-motion"
            aria-hidden="true"
          >
            <MaiaMark size={24} />
          </span>
        </button>
        <span className="maia-rail__wordmark">Maia</span>
      </header>

      <time
        className="maia-rail__clock"
        dateTime={now.toISOString()}
        aria-label={`${localTime}, ${localDate}`}
      >
        <strong className="maia-rail__time">{localTime}</strong>
        <span className="maia-rail__date">{localDate}</span>
      </time>

      <section className="maia-rail__section" aria-labelledby={`${railId}-today-title`}>
        <header className="maia-rail__section-header">
          <h2 id={`${railId}-today-title`} className="maia-rail__section-title">
            Today
          </h2>
          <span className="maia-rail__source-state">Disconnected</span>
        </header>
        <p className="maia-rail__empty-state">{tasksDisconnectedLabel}</p>
      </section>

      <section className="maia-rail__section" aria-labelledby={`${railId}-outside-title`}>
        <header className="maia-rail__section-header">
          <h2 id={`${railId}-outside-title`} className="maia-rail__section-title">
            Outside
          </h2>
          <span className="maia-rail__source-state">Disconnected</span>
        </header>
        <p className="maia-rail__empty-state">{weatherDisconnectedLabel}</p>
      </section>

      <nav className="maia-rail__nav" aria-label="Primary">
        {NAV_ITEMS.map(({ area, label }) => {
          const active = activeArea === area
          return (
            <button
              key={area}
              type="button"
              className={`maia-rail__nav-button${active ? ' maia-rail__nav-button--active' : ''}`}
              aria-current={active ? 'page' : undefined}
              onClick={() => onNavigate(area)}
            >
              {label}
            </button>
          )
        })}
      </nav>
    </aside>
  )
}
