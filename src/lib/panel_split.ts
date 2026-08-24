/**
 * Storage for a split the reader owns.
 *
 * A split is a preference, so it outlives the session; it is stored as the
 * panel's own size in pixels, or as a fraction where the axis follows the
 * window. Storage being unavailable costs the preference, never the split.
 */

export const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max)

export const readStored = (key: string): number | null => {
  try {
    const parsed = Number.parseFloat(window.localStorage.getItem(key) ?? '')
    return Number.isFinite(parsed) ? parsed : null
  } catch {
    return null
  }
}

export const writeStored = (key: string, value: number | null) => {
  try {
    if (value === null) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, String(value))
  } catch {
    /* The split still works for this session when storage is unavailable. */
  }
}
