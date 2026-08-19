import { AnimatePresence, motion } from 'motion/react'
import { Check } from 'lucide-react'

export function Toast({ toast }: { toast: { id: number; text: string } | null }) {
  return (
    <div className="toast-slot" aria-live="polite">
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            className="toast"
            initial={{ opacity: 0, y: 14, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97, transition: { duration: 0.15 } }}
            transition={{ type: 'spring', stiffness: 520, damping: 34 }}
          >
            <Check size={14} strokeWidth={1.8} />
            <span>{toast.text}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
