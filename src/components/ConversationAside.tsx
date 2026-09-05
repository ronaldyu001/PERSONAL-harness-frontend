import { useEffect } from 'react'
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react'
import { Radar } from 'lucide-react'
import { MODELS } from '../config'
import { EASE_STANDARD } from '../lib/motion'
import { formatDuration, sumUsage } from '../lib/usage'
import type { AssistantMessage, Conversation, Message } from '../types'

const STAMP = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

const count = (value: number) => value.toLocaleString()

export interface ConversationAsideProps {
  conversation: Conversation | null
  temporaryActive: boolean
  onGoToTurn: (messageId: string) => void
  onInspect: (sessionId: string) => void
}

/**
 * What the expanded conversation gains that the dashboard card cannot hold.
 *
 * Expanding is a trade: the ambient readouts leave the frame. This is what
 * arrives in their place — the same instrument logic pointed at the
 * conversation itself rather than at the machine around it. Its readings are
 * things the card has no room to state and the thread does not say twice: what
 * this conversation has cost, how long each answer took, which model answered,
 * and the session id that ties every turn here to the records on the bench.
 *
 * Nothing here is computed from anything but the conversation in hand. A turn
 * whose provider reported no usage has no reading, and says so.
 */
export function ConversationAside({
  conversation,
  temporaryActive,
  onGoToTurn,
  onInspect,
}: ConversationAsideProps) {
  if (!conversation || conversation.messages.length === 0) {
    return (
      <aside className="aside" aria-label="Conversation detail">
        <header className="aside__head">
          <h3 className="aside__title">This conversation</h3>
        </header>
        <p className="aside__empty">
          {temporaryActive
            ? 'A temporary conversation is answered normally and never stored. Nothing about it is recorded here or in history.'
            : 'Send a message and this reads back what the conversation cost, how long each answer took, and the session the turns were logged under.'}
        </p>
      </aside>
    )
  }

  const turns = pairTurns(conversation.messages)
  const answered = turns.filter((turn) => turn.assistant?.status === 'complete')
  const usage = sumUsage(answered.map((turn) => turn.assistant?.usage))
  const durations = answered
    .map((turn) => turn.assistant?.durationMs)
    .filter((value): value is number => typeof value === 'number')
  const models = [...new Set(answered.map((turn) => turn.assistant?.model).filter(Boolean))]
  const stored = conversation.origin === 'history'

  return (
    <aside className="aside" aria-label="Conversation detail">
      {/* Its own head, on the panel head's line: the rail runs the full height
          of the card, so it starts where the card starts. */}
      <header className="aside__head">
        <h3 className="aside__title">This conversation</h3>
      </header>

      <div className="aside__scroll">
      <section className="aside__block">
        <dl className="aside__facts">
          <Fact label="Turns">{count(turns.length)}</Fact>
          <Fact label="Last activity">
            {conversation.lastUpdated ? STAMP.format(new Date(conversation.lastUpdated)) : '—'}
          </Fact>
          <Fact label="Model">
            {models.length > 0 ? models.map(modelName).join(', ') : '—'}
          </Fact>
          <Fact label="Kept">
            {conversation.temporary ? 'No — temporary' : stored ? 'Yes — from history' : 'Yes'}
          </Fact>
        </dl>
      </section>

      <section className="aside__block">
        <h3 className="aside__title">Tokens</h3>
        {usage.counted > 0 ? (
          <>
            <Cost usage={usage} />
            {/* The context is re-sent every turn, so the input count is the
                one that grows. Saying which reading grows is the difference
                between a number and a reading. */}
            {usage.counted < answered.length && (
              <p className="aside__note">
                {count(answered.length - usage.counted)} of {count(answered.length)} answers
                reported no usage.
              </p>
            )}
          </>
        ) : (
          <p className="aside__note">
            {stored
              ? 'A stored conversation is read back without its usage; only live turns carry it.'
              : 'The provider reported no token usage for these turns.'}
          </p>
        )}
        {durations.length > 0 && (
          <p className="aside__note">
            Slowest answer {formatDuration(Math.max(...durations))} · fastest{' '}
            {formatDuration(Math.min(...durations))}
          </p>
        )}
      </section>

      {/* The reason to have the whole frame: a long conversation becomes
          navigable. The card has no room for this and the thread cannot be
          scrolled by memory. */}
      <section className="aside__block aside__block--turns">
        <h3 className="aside__title">Turns</h3>
        <ol className="aside__turns">
          {turns.map((turn, index) => (
            <li key={turn.id}>
              <button
                type="button"
                className="aside__turn"
                onClick={() => onGoToTurn(turn.id)}
              >
                <span className="aside__turn-head">
                  <span className="aside__turn-index">{index + 1}</span>
                  <span className="aside__turn-text">{turn.prompt}</span>
                </span>
                <span className="aside__turn-meta">{turnMeta(turn.assistant)}</span>
              </button>
            </li>
          ))}
        </ol>
      </section>

      {!conversation.temporary && (
        <section className="aside__block">
          <h3 className="aside__title">Session</h3>
          <p className="aside__session">{conversation.id}</p>
          <button
            type="button"
            className="ghost-btn ghost-btn--icon"
            onClick={() => onInspect(conversation.id)}
          >
            <Radar size={13} strokeWidth={1.8} aria-hidden="true" />
            Open in Investigate
          </button>
          <p className="aside__note">
            Every turn here was logged under this id — the model context it was sent and the
            gate's decision on what came back.
          </p>
        </section>
      )}
      </div>
    </aside>
  )
}

/**
 * What the conversation has cost, as a readout rather than a row of figures.
 *
 * A running total that jumps is the thing that made this block read as a
 * counter rather than as an instrument. Every value here settles instead: the
 * numbers travel from the reading they held to the one they now hold, and the
 * bar under them travels with them, on the same curve everything else in this
 * world moves on. A turn landing is the only thing that moves it, so the
 * movement is the notification — nothing has to flash.
 *
 * The bar is a proportion, not a gauge: the context is re-sent whole on every
 * turn, so input dominates and the shape of that is the reading. It is drawn
 * in the neutral ramp, never a status colour, because nothing here is good or
 * bad news.
 */
function Cost({ usage }: { usage: { input?: number; output?: number; total?: number } }) {
  const input = usage.input ?? 0
  const output = usage.output ?? 0
  const total = usage.total ?? input + output
  const share = total > 0 ? (input / total) * 100 : 0
  const reduceMotion = useReducedMotion() ?? false

  return (
    <div className="aside__cost">
      <p className="aside__cost-total">
        <span>Total</span>
        <Settling value={total} />
      </p>

      <div
        className="aside__meter"
        role="img"
        aria-label={`${count(input)} in, ${count(output)} out`}
      >
        <motion.span
          className="aside__meter-fill"
          initial={false}
          animate={{ width: `${share}%` }}
          transition={{ duration: reduceMotion ? 0 : 0.62, ease: EASE_STANDARD }}
        />
      </div>

      <p className="aside__cost-split" aria-hidden="true">
        <span>
          In <Settling value={input} />
        </span>
        <span>
          Out <Settling value={output} />
        </span>
      </p>
    </div>
  )
}

/**
 * A number that arrives at its reading instead of appearing at it.
 *
 * Tabular figures are already global, so the width never moves while it
 * counts; what travels is the value. Under reduce-motion it simply is the
 * value.
 */
function Settling({ value }: { value: number }) {
  const motionValue = useMotionValue(value)
  const text = useTransform(motionValue, (current) => Math.round(current).toLocaleString())
  const reduceMotion = useReducedMotion() ?? false

  useEffect(() => {
    if (reduceMotion) {
      motionValue.set(value)
      return
    }
    const controls = animate(motionValue, value, { duration: 0.62, ease: EASE_STANDARD })
    return () => controls.stop()
  }, [motionValue, reduceMotion, value])

  return <motion.span className="aside__mono">{text}</motion.span>
}

function Fact({ label, mono, children }: { label: string; mono?: boolean; children: React.ReactNode }) {
  return (
    <div className="aside__fact">
      <dt>{label}</dt>
      <dd className={mono ? 'aside__mono' : undefined}>{children}</dd>
    </div>
  )
}

interface Turn {
  /** The user message's id: what the thread anchors on. */
  id: string
  prompt: string
  assistant: AssistantMessage | null
}

/* The thread is a flat list of messages; a turn is a question and whatever
   answered it. Pairing here rather than in the thread keeps the reading
   order the reader sees identical to the one they scroll. */
function pairTurns(messages: Message[]): Turn[] {
  const turns: Turn[] = []
  for (const message of messages) {
    if (message.role === 'user') {
      turns.push({ id: message.id, prompt: message.text, assistant: null })
      continue
    }
    const open = turns[turns.length - 1]
    if (open && !open.assistant) open.assistant = message
  }
  return turns
}

function turnMeta(assistant: AssistantMessage | null): string {
  if (!assistant) return 'No answer'
  if (assistant.status === 'thinking' || assistant.status === 'streaming') return 'Answering'
  if (assistant.status === 'stopped') return 'Stopped'
  if (assistant.status === 'error') return 'Failed'

  const parts: string[] = []
  if (assistant.durationMs !== undefined) parts.push(formatDuration(assistant.durationMs))
  const total = assistant.usage?.total
  if (total !== undefined) parts.push(`${count(total)} tok`)
  /* A turn read back from storage carries neither reading. "Answered" is the
     whole of what is known about it. */
  return parts.length > 0 ? parts.join(' · ') : 'Answered'
}

const modelName = (id: string | undefined) =>
  MODELS.find((model) => model.id === id)?.name ?? id ?? '—'
