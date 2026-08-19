import { Switch } from './Switch'

export interface Prefs {
  theme: 'dark' | 'light'
  reduceMotion: boolean
  showHints: boolean
  style: 'snug' | 'default' | 'roomy'
}

const THEMES: { id: Prefs['theme']; label: string }[] = [
  { id: 'dark', label: 'Dark' },
  { id: 'light', label: 'Light' },
]

const STYLES: { id: Prefs['style']; label: string }[] = [
  { id: 'snug', label: 'Snug' },
  { id: 'default', label: 'Default' },
  { id: 'roomy', label: 'Roomy' },
]

export function SettingsPanel({ prefs, onChange }: { prefs: Prefs; onChange: (p: Prefs) => void }) {
  return (
    <div className="settings">
      <div className="settings__title">Preferences</div>

      <div className="settings__row">
        <div className="settings__label">
          <span>Appearance</span>
          <span className="settings__hint">Choose your preferred palette</span>
        </div>
        <div className="segmented" role="radiogroup" aria-label="Appearance">
          {THEMES.map((theme) => (
            <button
              key={theme.id}
              type="button"
              className={`segmented__opt${prefs.theme === theme.id ? ' segmented__opt--on' : ''}`}
              role="radio"
              aria-checked={prefs.theme === theme.id}
              onClick={() => onChange({ ...prefs, theme: theme.id })}
              data-menu-item
            >
              {theme.label}
            </button>
          ))}
        </div>
      </div>

      <div className="settings__row">
        <div className="settings__label">
          <span>Style</span>
          <span className="settings__hint">Adjusts scale, spacing, and density</span>
        </div>
        <div className="segmented" role="radiogroup" aria-label="Interface style">
          {STYLES.map((style) => (
            <button
              key={style.id}
              type="button"
              role="radio"
              aria-checked={prefs.style === style.id}
              className={`segmented__opt${prefs.style === style.id ? ' segmented__opt--on' : ''}`}
              onClick={() => onChange({ ...prefs, style: style.id })}
              data-menu-item
            >
              {style.label}
            </button>
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

      <div className="settings__row settings__row--inline">
        <div className="settings__label">
          <span>Keyboard hints</span>
          <span className="settings__hint">Show shortcuts in the interface</span>
        </div>
        <Switch
          checked={prefs.showHints}
          onChange={(v) => onChange({ ...prefs, showHints: v })}
          label="Keyboard hints"
        />
      </div>

      <div className="settings__foot">Maia Preview 0.1</div>
    </div>
  )
}
