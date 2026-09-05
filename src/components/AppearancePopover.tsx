import { useCallback, useEffect, useRef, type RefObject } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { Prefs } from './SettingsPanel'
import { SettingsPanel } from './SettingsPanel'

export interface AppearancePopoverProps {
  open: boolean
  anchorRef: RefObject<HTMLButtonElement | null>
  prefs: Prefs
  reduceMotion: boolean
  onChange: (prefs: Prefs) => void
  onClose: () => void
}

export function AppearancePopover({
  open,
  anchorRef,
  prefs,
  reduceMotion,
  onChange,
  onClose,
}: AppearancePopoverProps) {
  const panelRef = useRef<HTMLElement>(null)
  const closeAndRestore = useCallback(() => {
    onClose()
    window.requestAnimationFrame(() => anchorRef.current?.focus({ preventScroll: true }))
  }, [anchorRef, onClose])

  useEffect(() => {
    if (!open) return

    const frame = window.requestAnimationFrame(() => {
      panelRef.current
        ?.querySelector<HTMLInputElement>('input:checked')
        ?.focus({ preventScroll: true })
    })
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      closeAndRestore()
    }
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (panelRef.current?.contains(target) || anchorRef.current?.contains(target)) return
      onClose()
    }

    document.addEventListener('keydown', onKeyDown, true)
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => {
      window.cancelAnimationFrame(frame)
      document.removeEventListener('keydown', onKeyDown, true)
      document.removeEventListener('pointerdown', onPointerDown, true)
    }
  }, [anchorRef, closeAndRestore, onClose, open])

  return (
    <AnimatePresence>
      {open && (
        <motion.section
          ref={panelRef}
          className="maia-appearance"
          role="dialog"
          aria-modal="false"
          aria-labelledby="maia-appearance-title"
          initial={reduceMotion ? false : { opacity: 0, scale: 0.975, y: -6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98, y: -4 }}
          transition={
            reduceMotion
              ? { duration: 0 }
              : { type: 'spring', stiffness: 470, damping: 38, mass: 0.85 }
          }
        >
          <header className="maia-appearance__header">
            <h2 id="maia-appearance-title">Appearance</h2>
            <button type="button" onClick={closeAndRestore}>
              Done
            </button>
          </header>
          <SettingsPanel prefs={prefs} onChange={onChange} />
        </motion.section>
      )}
    </AnimatePresence>
  )
}
