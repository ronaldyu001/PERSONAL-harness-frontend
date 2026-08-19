import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react'
import { AnimatePresence, motion } from 'motion/react'

export type PopoverPlacement = 'top-start' | 'top-end' | 'bottom-start' | 'right-end'

/** Gap between the trigger and the panel, and the minimum viewport margin. */
const OFFSET = 6
const MARGIN = 8

interface Coords {
  top: number
  left: number
}

/**
 * Anchored floating surface. Positions itself against `anchorRef`, flips and
 * clamps so it can never leave the window, grows from the trigger's corner,
 * closes on Escape / outside click, and supports arrow-key movement between
 * menu items.
 */
export function Popover({
  open,
  onClose,
  anchorRef,
  placement = 'top-start',
  width,
  children,
  labelledBy,
}: {
  open: boolean
  onClose: () => void
  anchorRef: RefObject<HTMLElement | null>
  placement?: PopoverPlacement
  width?: number
  children: ReactNode
  labelledBy?: string
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [coords, setCoords] = useState<Coords | null>(null)

  const place = useCallback(() => {
    const anchor = anchorRef.current?.getBoundingClientRect()
    const panel = panelRef.current?.getBoundingClientRect()
    if (!anchor || !panel) return

    const vw = window.innerWidth
    const vh = window.innerHeight
    let top: number
    let left: number

    switch (placement) {
      case 'top-start':
        top = anchor.top - panel.height - OFFSET
        left = anchor.left
        break
      case 'top-end':
        top = anchor.top - panel.height - OFFSET
        left = anchor.right - panel.width
        break
      case 'right-end':
        top = anchor.bottom - panel.height
        left = anchor.right + OFFSET
        break
      default:
        top = anchor.bottom + OFFSET
        left = anchor.left
    }

    /* Flip to the opposite side when the preferred one does not fit, then clamp
       so the panel is always fully inside the window. */
    if (placement.startsWith('top') && top < MARGIN) {
      top = anchor.bottom + OFFSET
    } else if (placement === 'bottom-start' && top + panel.height > vh - MARGIN) {
      top = anchor.top - panel.height - OFFSET
    }
    if (placement === 'right-end' && left + panel.width > vw - MARGIN) {
      left = anchor.left - panel.width - OFFSET
    }

    top = Math.min(Math.max(top, MARGIN), Math.max(MARGIN, vh - MARGIN - panel.height))
    left = Math.min(Math.max(left, MARGIN), Math.max(MARGIN, vw - MARGIN - panel.width))

    setCoords({ top, left })
  }, [anchorRef, placement])

  useLayoutEffect(() => {
    if (!open) return
    place()
    /* No scroll listener: the app body does not scroll, anchors live in fixed
       chrome, and the panel closes on outside pointerdown anyway. */
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [open, place])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
        anchorRef.current?.focus()
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const items = panelRef.current?.querySelectorAll<HTMLElement>('[data-menu-item]')
        if (!items?.length) return
        e.preventDefault()
        const list = Array.from(items)
        const idx = list.indexOf(document.activeElement as HTMLElement)
        const next =
          e.key === 'ArrowDown'
            ? list[(idx + 1) % list.length]
            : list[(idx - 1 + list.length) % list.length]
        next.focus()
      }
    }
    const onPointer = (e: PointerEvent) => {
      const t = e.target as Node
      if (panelRef.current?.contains(t)) return
      if (anchorRef.current?.contains(t)) return
      onClose()
    }
    document.addEventListener('keydown', onKey, true)
    document.addEventListener('pointerdown', onPointer, true)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      document.removeEventListener('pointerdown', onPointer, true)
    }
  }, [open, onClose, anchorRef])

  useEffect(() => {
    if (open) {
      const first = panelRef.current?.querySelector<HTMLElement>('[data-menu-item]')
      first?.focus({ preventScroll: true })
    }
  }, [open])

  const origin =
    placement === 'top-start'
      ? 'bottom left'
      : placement === 'top-end'
        ? 'bottom right'
        : placement === 'right-end'
          ? 'bottom left'
          : 'top left'

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={panelRef}
          role="menu"
          aria-labelledby={labelledBy}
          className={`popover popover--${placement}`}
          style={{
            width,
            transformOrigin: origin,
            top: coords?.top ?? 0,
            left: coords?.left ?? 0,
            /* Hidden for the single frame before it has been measured, so it
               never flashes at the wrong position. */
            visibility: coords ? 'visible' : 'hidden',
          }}
          initial={{ opacity: 0, scale: 0.98, y: placement.startsWith('top') ? 4 : -4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{
            opacity: 0,
            scale: 0.98,
            y: placement.startsWith('top') ? 3 : -3,
            transition: { duration: 0.12 },
          }}
          transition={{ type: 'spring', stiffness: 560, damping: 38 }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
