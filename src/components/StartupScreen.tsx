import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { MaiaMark } from './MaiaMark'
import type {
  BackendStartupPhase,
  StartupStep,
} from '../hooks/useBackendReadiness'

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
  step: StartupStep
  statusMessage?: string
  errorCode?: string
  onRetry: () => void
  onCancel: () => void
}

const stepIndex = (step: StartupStep) => {
  if (step === 'starting-stack') return 1
  if (step === 'waiting-backend') return 2
  return 0
}

const STARTUP_STEPS = ['Docker', 'Services', 'Maia']

export function StartupScreen({
  phase,
  step,
  statusMessage: reportedStatus,
  errorCode,
  onRetry,
  onCancel,
}: StartupScreenProps) {
  const systemReducedMotion = useReducedMotion()
  const savedReducedMotion = document.documentElement.dataset.reduceMotion === 'true'
  const reduceMotion = Boolean(systemReducedMotion || savedReducedMotion)
  const messages = phase === 'delayed' ? DELAYED_MESSAGES : STARTING_MESSAGES
  const [messageIndex, setMessageIndex] = useState(0)

  useEffect(() => {
    if (phase === 'error' || reduceMotion || reportedStatus) return

    const timer = window.setInterval(() => {
      setMessageIndex((current) => (current + 1) % messages.length)
    }, 2_600)

    return () => window.clearInterval(timer)
  }, [messages, phase, reduceMotion, reportedStatus])

  const statusMessage = reportedStatus ?? (phase === 'error'
    ? 'Maia could not connect to the local service.'
    : messages[messageIndex])
  const activeStep = stepIndex(step)
  const dockerNotInstalled = errorCode === 'docker-not-installed'

  return (
    <motion.section
      className="startup-screen"
      aria-busy={phase !== 'error'}
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={reduceMotion
        ? { opacity: 0 }
        : { clipPath: 'inset(0 0 100% 0)', opacity: 0.98 }}
      transition={{ duration: reduceMotion ? 0.01 : 0.72, ease: [0.77, 0, 0.175, 1] }}
    >
      <div className="startup-screen__ambient" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>

      <header className="startup-screen__masthead">
        <span className="startup-screen__brand">Maia</span>
        <span>Private local runtime</span>
        <span>Local / {String(activeStep + 1).padStart(2, '0')}</span>
      </header>

      <div className="startup-screen__stage" aria-hidden="true">
        <motion.div
          className="startup-screen__mark"
          initial={reduceMotion ? false : { opacity: 0, transform: 'translateY(18px) scale(0.94)' }}
          animate={{ opacity: 1, transform: 'translateY(0) scale(1)' }}
          transition={{
            duration: reduceMotion ? 0.01 : 0.86,
            delay: reduceMotion ? 0 : 0.12,
            ease: [0.23, 1, 0.32, 1],
          }}
        >
          <span className="startup-screen__halo" aria-hidden="true" />
          <span className="startup-screen__orbit startup-screen__orbit--one" aria-hidden="true" />
          <span className="startup-screen__orbit startup-screen__orbit--two" aria-hidden="true" />
          <MaiaMark size={92} thinking={phase !== 'error'} />
        </motion.div>
      </div>

      <div className="startup-screen__content">
        <motion.div
          className="startup-screen__identity"
          initial={reduceMotion ? false : { opacity: 0, transform: 'translateY(16px)' }}
          animate={{ opacity: 1, transform: 'translateY(0)' }}
          transition={{
            duration: reduceMotion ? 0.01 : 0.78,
            delay: reduceMotion ? 0 : 0.2,
            ease: [0.23, 1, 0.32, 1],
          }}
        >
          <span className="startup-screen__eyebrow">Local intelligence / waking</span>
          <h1>
            <span>Preparing a quieter</span>
            <span>place to think.</span>
          </h1>
        </motion.div>
      </div>

      <footer className="startup-screen__footer">
        <div className="startup-screen__status" role="status" aria-live="polite">
          <span className="startup-screen__status-index">
            {String(activeStep + 1).padStart(2, '0')}
          </span>
          <AnimatePresence mode="wait" initial={false}>
            <motion.p
              key={`${phase}-${statusMessage}`}
              initial={reduceMotion ? false : { opacity: 0, transform: 'translateY(4px)' }}
              animate={{ opacity: 1, transform: 'translateY(0)' }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, transform: 'translateY(-4px)' }}
              transition={{ duration: reduceMotion ? 0.01 : 0.2 }}
            >
              {statusMessage}
            </motion.p>
          </AnimatePresence>
        </div>

        <ol className="startup-screen__steps" aria-label="Startup progress">
          {STARTUP_STEPS.map((label, index) => {
            const state = index < activeStep
              ? 'complete'
              : index === activeStep
                ? (phase === 'error' ? 'error' : 'active')
                : 'pending'
            return (
              <li key={label} className={`startup-screen__step startup-screen__step--${state}`}>
                <span className="startup-screen__step-index" aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="startup-screen__step-label">{label}</span>
              </li>
            )
          })}
        </ol>

        {phase === 'error' ? (
          <div className="startup-screen__actions">
            {!dockerNotInstalled && (
              <button className="startup-screen__retry" type="button" onClick={onRetry}>
                Retry
              </button>
            )}
            <button
              className="startup-screen__retry startup-screen__retry--secondary"
              type="button"
              onClick={onCancel}
            >
              {dockerNotInstalled ? 'Cancel startup' : 'Close Maia'}
            </button>
          </div>
        ) : (
          <div className="startup-screen__progress" aria-hidden="true" />
        )}
        <p className="startup-screen__footnote">Private by design<br />Running locally</p>
      </footer>
    </motion.section>
  )
}
