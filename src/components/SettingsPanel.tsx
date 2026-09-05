import type { KeyboardEvent } from 'react'
import { Switch } from './Switch'

export interface Prefs {
  theme: 'dark' | 'light'
  palette: 'salon' | 'print-room' | 'day-office'
  reduceMotion: boolean
  showHints: boolean
  style: 'snug' | 'default' | 'roomy'
  textSize: 'small' | 'medium' | 'large'
}

const MODES: { id: Prefs['theme']; label: string }[] = [
  { id: 'dark', label: 'Dark' },
  { id: 'light', label: 'Light' },
]

const TEXT_SIZES: { id: Prefs['textSize']; label: string }[] = [
  { id: 'small', label: 'Small' },
  { id: 'medium', label: 'Medium' },
  { id: 'large', label: 'Large' },
]

const PALETTES: { id: Prefs['palette']; label: string; tone: string }[] = [
  { id: 'salon', label: 'Salon', tone: 'Elegant' },
  { id: 'print-room', label: 'Print Room', tone: 'Moody' },
  { id: 'day-office', label: 'Day Office', tone: 'Tailored' },
]

export function SettingsPanel({ prefs, onChange }: { prefs: Prefs; onChange: (p: Prefs) => void }) {
  const selectTextSizeByKey = (event: KeyboardEvent<HTMLInputElement>, index: number) => {
    let nextIndex: number | null = null
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = (index + 1) % TEXT_SIZES.length
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = (index - 1 + TEXT_SIZES.length) % TEXT_SIZES.length
    } else if (event.key === 'Home') {
      nextIndex = 0
    } else if (event.key === 'End') {
      nextIndex = TEXT_SIZES.length - 1
    }
    if (nextIndex === null) return

    event.preventDefault()
    const group = event.currentTarget.closest('[role="radiogroup"]')
    const inputs = group?.querySelectorAll<HTMLInputElement>('input[type="radio"]')
    const next = TEXT_SIZES[nextIndex]
    inputs?.[nextIndex]?.focus({ preventScroll: true })
    onChange({ ...prefs, textSize: next.id })
  }

  return (
    <div className="settings maia-settings">
      <div className="settings__row">
        <div className="settings__label">
          <span>Theme</span>
          <span className="settings__hint">Three rooms, each with its own character</span>
        </div>
        <div className="maia-settings__palettes" role="radiogroup" aria-label="Theme">
          {PALETTES.map((palette) => (
            <label key={palette.id} className="maia-settings__palette" data-palette={palette.id}>
              <input
                className="visually-hidden"
                type="radio"
                name="maia-palette"
                value={palette.id}
                checked={prefs.palette === palette.id}
                onChange={() => onChange({ ...prefs, palette: palette.id })}
              />
              <span className="maia-settings__swatch" aria-hidden="true" />
              <span className="maia-settings__palette-copy">
                <strong>{palette.label}</strong>
                <small>{palette.tone}</small>
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="settings__row">
        <div className="settings__label">
          <span>Mode</span>
        </div>
        <div className="segmented" role="radiogroup" aria-label="Color mode">
          {MODES.map((theme) => (
            <button
              key={theme.id}
              type="button"
              role="radio"
              aria-checked={prefs.theme === theme.id}
              className={`segmented__opt${prefs.theme === theme.id ? ' segmented__opt--on' : ''}`}
              onClick={() => onChange({ ...prefs, theme: theme.id })}
            >
              {theme.label}
            </button>
          ))}
        </div>
      </div>

      <div className="settings__row">
        <div className="settings__label">
          <span>Text size</span>
        </div>
        <div
          className="segmented maia-settings__text-size"
          role="radiogroup"
          aria-label="Text size"
        >
          {TEXT_SIZES.map((size, index) => (
            <label
              key={size.id}
              data-size={size.id}
              className={`segmented__opt${prefs.textSize === size.id ? ' segmented__opt--on' : ''}`}
            >
              <input
                className="visually-hidden"
                type="radio"
                name="maia-text-size"
                value={size.id}
                checked={prefs.textSize === size.id}
                onChange={() => onChange({ ...prefs, textSize: size.id })}
                onKeyDown={(event) => selectTextSizeByKey(event, index)}
              />
              <span>{size.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="settings__row settings__row--inline">
        <div className="settings__label">
          <span>Reduce motion</span>
          <span className="settings__hint">Calms transitions and effects</span>
        </div>
        <Switch
          checked={prefs.reduceMotion}
          onChange={(v) => onChange({ ...prefs, reduceMotion: v })}
          label="Reduce motion"
        />
      </div>

      <div className="settings__foot">Saved on this device</div>
    </div>
  )
}
