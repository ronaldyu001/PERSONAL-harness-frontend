import type { ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useBackendReadiness } from '../hooks/useBackendReadiness'
import { StartupScreen } from './StartupScreen'

interface StartupGateProps {
  healthUrl: string
  children: ReactNode
}

export function StartupGate({ healthUrl, children }: StartupGateProps) {
  const { phase, retry } = useBackendReadiness(healthUrl)
  const systemReducedMotion = useReducedMotion()
  const savedReducedMotion = document.documentElement.dataset.reduceMotion === 'true'
  const reduceMotion = Boolean(systemReducedMotion || savedReducedMotion)

  return (
    <AnimatePresence mode="wait" initial={false}>
      {phase === 'ready' ? (
        <motion.div
          key="application"
          className="startup-ready"
          initial={reduceMotion ? false : { opacity: 0, scale: 0.994 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{
            duration: reduceMotion ? 0.01 : 0.38,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          {children}
        </motion.div>
      ) : (
        <StartupScreen key="startup" phase={phase} onRetry={retry} />
      )}
    </AnimatePresence>
  )
}
