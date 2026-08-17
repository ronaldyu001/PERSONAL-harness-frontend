import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { MaiaMark } from './MaiaMark'
import type { BackendStartupPhase } from '../hooks/useBackendReadiness'

const STARTING_MESSAGES = [
  'Preparing your workspace',
  'Starting local services',
  'Warming up Maia',
]

const DELAYED_MESSAGES = [
  'Local models can take a moment on first launch',
  'Still preparing your workspace',
  'Maia will be ready shortly',
]

interface StartupScreenProps {
  phase: Exclude<BackendStartupPhase, 'ready'>
  onRetry: () => void
}

export function StartupScreen({ phase, onRetry }: StartupScreenProps) {
  const systemReducedMotion = useReducedMotion()
  const savedReducedMotion = document.documentElement.dataset.reduceMotion === 'true'
  const reduceMotion = Boolean(systemReducedMotion || savedReducedMotion)
  const messages = phase === 'delayed' ? DELAYED_MESSAGES : STARTING_MESSAGES
  const [messageIndex, setMessageIndex] = useState(0)

  useEffect(() => {
    if (phase === 'error' || reduceMotion) return

    const timer = window.setInterval(() => {
      setMessageIndex((current) => (current + 1) % messages.length)
    }, 2_600)

    return () => window.clearInterval(timer)
  }, [messages, phase, reduceMotion])

  const statusMessage = phase === 'error'
    ? 'Maia could not connect to the local service.'
    : messages[messageIndex]

  return (
    <motion.section
      className="startup-screen"
      aria-busy={phase !== 'error'}
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={reduceMotion
        ? { opacity: 0 }
        : { opacity: 0, scale: 1.012, filter: 'blur(7px)' }}
      transition={{ duration: reduceMotion ? 0.01 : 0.34, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="startup-screen__ambient" aria-hidden="true" />

      <div className="startup-screen__content">
        <motion.div
          className="startup-screen__mark"
          initial={reduceMotion ? false : { opacity: 0, y: 8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{
            duration: reduceMotion ? 0.01 : 0.55,
            delay: reduceMotion ? 0 : 0.06,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          <span className="startup-screen__halo" aria-hidden="true" />
          <MaiaMark size={56} thinking={phase !== 'error'} />
        </motion.div>

        <motion.div
          className="startup-screen__identity"
          initial={reduceMotion ? false : { opacity: 0, y: 7 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: reduceMotion ? 0.01 : 0.42,
            delay: reduceMotion ? 0 : 0.14,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          <h1>Maia</h1>
          <p>Local intelligence, thoughtfully prepared.</p>
        </motion.div>

        <div className="startup-screen__status" role="status" aria-live="polite">
          <AnimatePresence mode="wait" initial={false}>
            <motion.p
              key={`${phase}-${statusMessage}`}
              initial={reduceMotion ? false : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
              transition={{ duration: reduceMotion ? 0.01 : 0.2 }}
            >
              {statusMessage}
            </motion.p>
          </AnimatePresence>
        </div>

        {phase === 'error' ? (
          <button className="startup-screen__retry" type="button" onClick={onRetry}>
            Retry connection
          </button>
        ) : (
          <div className="startup-screen__progress" aria-hidden="true">
            <span />
          </div>
        )}
      </div>

      <p className="startup-screen__footnote">Private by design · Running locally</p>
    </motion.section>
  )
}
