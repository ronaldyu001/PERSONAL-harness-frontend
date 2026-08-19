import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
} from 'react'
import { AnimatePresence, motion } from 'motion/react'

type Side = 'right' | 'top' | 'bottom'

/** Distance from the trigger, and the minimum viewport margin. */
const GAP = 8
const MARGIN = 8

interface Coords {
  top: number
  left: number
}

/**
 * Minimal delayed tooltip.
 *
 * The wrapper is `display: contents` so it never disturbs the flex rows these
 * triggers live in, which means it has no box of its own: the trigger measured
 * here is the wrapper's first element child. The tip is positioned from that
 * rect and clamped to the window, so it cannot drift off the trigger or off
 * screen.
 */
export function Tooltip({
  label,
  shortcut,
  side = 'top',
  children,
  disabled = false,
}: {
  label: string
  shortcut?: string
  side?: Side
  children: ReactElement<Record<string, unknown>>
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState<Coords | null>(null)
  const wrapRef = useRef<HTMLSpanElement>(null)
  const tipRef = useRef<HTMLSpanElement>(null)
  const timer = useRef<number | undefined>(undefined)

  const show = () => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setOpen(true), 350)
  }
  const hide = () => {
    window.clearTimeout(timer.current)
    setOpen(false)
  }

  const place = useCallback(() => {
    const trigger = wrapRef.current?.firstElementChild?.getBoundingClientRect()
    const tip = tipRef.current?.getBoundingClientRect()
    if (!trigger || !tip) return

    const vw = window.innerWidth
    const vh = window.innerHeight
    let top: number
    let left: number

    if (side === 'right') {
      top = trigger.top + trigger.height / 2 - tip.height / 2
      left = trigger.right + GAP
      if (left + tip.width > vw - MARGIN) left = trigger.left - tip.width - GAP
    } else if (side === 'top') {
      top = trigger.top - tip.height - GAP
      left = trigger.left + trigger.width / 2 - tip.width / 2
      if (top < MARGIN) top = trigger.bottom + GAP
    } else {
      top = trigger.bottom + GAP
      left = trigger.left + trigger.width / 2 - tip.width / 2
      if (top + tip.height > vh - MARGIN) top = trigger.top - tip.height - GAP
    }

    top = Math.min(Math.max(top, MARGIN), Math.max(MARGIN, vh - MARGIN - tip.height))
    left = Math.min(Math.max(left, MARGIN), Math.max(MARGIN, vw - MARGIN - tip.width))

    setCoords({ top, left })
  }, [side])

  useLayoutEffect(() => {
    if (!open) return
    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [open, place])

  /* Approach travel runs along the axis the tip arrives on. */
  const approach = side === 'right' ? { x: -4 } : side === 'top' ? { y: 4 } : { y: -4 }
  const settled = side === 'right' ? { x: 0 } : { y: 0 }

  return (
    <span
      ref={wrapRef}
      className="tip-anchor"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      onMouseDown={hide}
    >
      {children}
      <AnimatePresence>
        {open && !disabled && (
          <motion.span
            ref={tipRef}
            className="tip"
            role="tooltip"
            style={{
              top: coords?.top ?? 0,
              left: coords?.left ?? 0,
              /* Hidden for the frame before measurement so it never flashes
                 at the wrong position. */
              visibility: coords ? 'visible' : 'hidden',
            }}
            initial={{ opacity: 0, scale: 0.96, ...approach }}
            animate={{ opacity: 1, scale: 1, ...settled }}
            exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.1 } }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
          >
            {label}
            {shortcut && <kbd>{shortcut}</kbd>}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  )
}
