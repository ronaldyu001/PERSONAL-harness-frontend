import { useEffect, useRef, type ReactNode, type RefObject } from 'react'
import { AnimatePresence, motion } from 'motion/react'

export type PopoverPlacement = 'top-start' | 'top-end' | 'bottom-start' | 'right-end'

/**
 * Anchored floating surface. Positions itself against `anchorRef`,
 * grows from the trigger's corner, closes on Escape / outside click,
 * and supports simple arrow-key focus movement between menu items.
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
          style={{ width, transformOrigin: origin }}
          initial={{ opacity: 0, scale: 0.98, y: placement.startsWith('top') ? 4 : -4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: placement.startsWith('top') ? 3 : -3, transition: { duration: 0.12 } }}
          transition={{ type: 'spring', stiffness: 560, damping: 38 }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
