import { useRef } from 'react'

/**
 * The reader's split, wherever two readings share a panel.
 *
 * One component, three splits now: the conversation against the readouts, the
 * two readouts against each other, and the ledger against the record on the
 * bench. Each is a focusable `role="separator"` carrying live values, so the
 * drag and the keys are the same control rather than two.
 */

/* The strip is wider than the rule it draws: a 2px line is not a pointer
   target, and the hit area is what makes the split feel like an edge rather
   than a hairline to hunt for. */
export const RESIZER_THICKNESS = 14

/**
 * A separator sits in the gutter it moves and draws nothing there — between
 * two floating panels the ground already is the line. The rule arrives under
 * the pointer or on focus, and runs the full gutter while it is held.
 */
export function Separator({
  orientation,
  style,
  label,
  valueNow,
  valueMin,
  valueMax,
  valueText,
  step,
  dragging,
  onDragStart,
  onDrag,
  onDragEnd,
  onNudge,
  onExtreme,
  onReset,
}: {
  orientation: 'vertical' | 'horizontal'
  style: React.CSSProperties
  label: string
  valueNow: number
  valueMin: number
  valueMax: number
  valueText: string
  step: number
  dragging: boolean
  onDragStart: () => void
  onDrag: (delta: number) => void
  onDragEnd: () => void
  onNudge: (delta: number) => void
  onExtreme: (edge: 'start' | 'end') => void
  onReset: () => void
}) {
  const axis = orientation === 'vertical' ? 'x' : 'y'
  const origin = useRef(0)

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    event.preventDefault()
    const target = event.currentTarget
    origin.current = axis === 'x' ? event.clientX : event.clientY
    target.setPointerCapture(event.pointerId)
    onDragStart()
    document.body.dataset.resizing = axis

    const move = (ev: PointerEvent) =>
      onDrag((axis === 'x' ? ev.clientX : ev.clientY) - origin.current)
    const release = () => {
      target.releasePointerCapture(event.pointerId)
      target.removeEventListener('pointermove', move)
      onDragEnd()
      delete document.body.dataset.resizing
    }

    target.addEventListener('pointermove', move)
    target.addEventListener('pointerup', release, { once: true })
    target.addEventListener('pointercancel', release, { once: true })
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const back = axis === 'x' ? 'ArrowLeft' : 'ArrowUp'
    const forward = axis === 'x' ? 'ArrowRight' : 'ArrowDown'
    const distance = event.shiftKey ? step * 3 : step

    if (event.key === back) onNudge(-distance)
    else if (event.key === forward) onNudge(distance)
    else if (event.key === 'Home') onExtreme('start')
    else if (event.key === 'End') onExtreme('end')
    else if (event.key === 'Enter') onReset()
    else return

    event.preventDefault()
  }

  return (
    <div
      className={`resizer resizer--${axis}${dragging ? ' resizer--dragging' : ''}`}
      style={style}
      role="separator"
      tabIndex={0}
      aria-orientation={orientation}
      aria-label={label}
      aria-valuemin={valueMin}
      aria-valuemax={valueMax}
      aria-valuenow={valueNow}
      aria-valuetext={valueText}
      onDoubleClick={onReset}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
    >
      <span className="resizer-line" aria-hidden="true" />
    </div>
  )
}
