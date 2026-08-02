import { useRef, useState, type ReactElement } from 'react'
import { AnimatePresence, motion } from 'motion/react'

type Side = 'right' | 'top' | 'bottom'

/**
 * Minimal delayed tooltip. Renders inside a positioned wrapper so it
 * stays glued to its trigger; motion originates from the trigger side.
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
  const timer = useRef<number | undefined>(undefined)

  const show = () => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setOpen(true), 350)
  }
  const hide = () => {
    window.clearTimeout(timer.current)
    setOpen(false)
  }

  // Keep the cross-axis centering constant; animate only the approach axis.
  const centered = side === 'right' ? { y: '-50%' } : { x: '-50%' }
  const approach = side === 'right' ? { x: -4 } : side === 'top' ? { y: 4 } : { y: -4 }
  const settled = side === 'right' ? { x: 0 } : { y: 0 }

  return (
    <span
      className={`tip-anchor tip-anchor--${side}`}
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
            className="tip"
            role="tooltip"
            initial={{ opacity: 0, scale: 0.94, ...centered, ...approach }}
            animate={{ opacity: 1, scale: 1, ...centered, ...settled }}
            exit={{ opacity: 0, scale: 0.96, ...centered, transition: { duration: 0.1 } }}
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
