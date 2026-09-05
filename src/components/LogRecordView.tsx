import { Check, ChevronRight, Copy } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { OutcomeMark } from './OutcomeMark'
import {
  formatCount,
  formatStamp,
  outcomeOf,
  roleLabel,
  shortId,
  turnsAgoLabel,
} from '../lib/log_format'
import type {
  ContextMessage,
  ContextTool,
  GateContext,
  LogRecord,
  ModelContextEvent,
  ResponseGateEvent,
  TokenUsage,
} from '../application/observability/schemas'

/** Announcing a copy to the reader; the toast says which one it was. */
export type Toast = (text: string) => void

/**
 * One record, read in full.
 *
 * The ledger is for scanning; this is the other speed. The order is the order
 * the question is asked — what happened, then what it happened to, then what
 * the decision was made on — and a field the log did not record says so
 * rather than rendering empty. Bulk is folded rather than dropped: a section
 * that would bury the answer under it opens on request and names what is
 * inside before it does.
 *
 * Every recorded payload lifts out on its own. A record is read here and used
 * somewhere else — pasted into a diff, into an issue, back into a prompt —
 * and the unit of that is the text itself, not the section around it, so the
 * control sits on the block and the whole record as JSON stays in the head.
 */
export function LogRecordView({
  record,
  onToast,
}: {
  record: LogRecord
  onToast: Toast
}) {
  const { event } = record
  const outcome = outcomeOf(event)

  return (
    <article className="record" aria-label={`${outcome.label} at ${formatStamp(event.timestamp)}`}>
      <header className="record__head">
        <div className="record__identity">
          <OutcomeMark outcome={outcome} size={15} className="record__outcome" />
          <span className="visually-hidden">{outcome.meaning}</span>
        </div>
        <CopyRecord record={record} onToast={onToast} />
      </header>

      {/* One line of provenance rather than a grid of it: these are the
          record's coordinates, and coordinates belong under the heading they
          locate, not between it and the reading. The ledger no longer spells
          any of this out on every row, so this is where it is read. */}
      <dl className="record__meta">
        <Meta label="Time">{formatStamp(event.timestamp)}</Meta>
        <Meta label="Model" mono>
          {event.model}
        </Meta>
        {event.event === 'response_gate' ? (
          <Meta label="Pass">
            {event.repair_attempt > 0
              ? `${event.evaluation_call} · repair ${event.repair_attempt}`
              : event.evaluation_call}
          </Meta>
        ) : (
          <Meta label="Call">{event.model_call}</Meta>
        )}
        <Meta label="Mode">{event.mode === 'full' ? 'Full' : 'Structure'}</Meta>
        <Meta label="Conversation" mono>
          {shortId(event.session_id)}
        </Meta>
        <Meta label="Turn" mono>
          {shortId(event.invocation_id)}
        </Meta>
      </dl>

      {event.event === 'response_gate' ? (
        <GateBody event={event} onToast={onToast} />
      ) : (
        <ContextBody event={event} onToast={onToast} />
      )}
    </article>
  )
}

function GateBody({ event, onToast }: { event: ResponseGateEvent; onToast: Toast }) {
  const hasVerdict = event.violations.length > 0 || event.error_type !== null || event.feedback

  return (
    <>
      {/* The verdict first, because it is short and it is the answer. The
          candidate it was passed on comes next, and the context it was
          reached from after that: each one explains the one above it. */}
      {hasVerdict && (
        <Section title="Verdict" open>
          {event.error_type && (
            <p className="record__error">
              <span className="record__error-type">{event.error_type}</span>
              {event.error_message ? ` — ${event.error_message}` : null}
            </p>
          )}

          {event.violations.length > 0 && (
            <ul className="record__violations">
              {event.violations.map((violation) => (
                <li key={violation}>{violation}</li>
              ))}
            </ul>
          )}

          {event.feedback && (
            <Field label="Feedback">
              <Payload text={event.feedback} label="the feedback" onToast={onToast} />
            </Field>
          )}

          {!event.feedback && event.mode === 'structure' && (
            <Absent reason="Feedback not recorded in structure mode." />
          )}
        </Section>
      )}

      <Section
        title="Answer"
        note={`${formatCount(event.candidate_characters)} characters`}
        open
      >
        {event.candidate ? (
          <Payload text={event.candidate} label="the answer" onToast={onToast} />
        ) : (
          <Absent reason="Text not recorded in structure mode." />
        )}
      </Section>

      <GateContextBody event={event} onToast={onToast} />

      <Section title="Tools">
        <dl className="record__meta">
          <Meta label="Available">{listOrDash(event.available_tools)}</Meta>
          <Meta label="Used">{listOrDash(event.tools_used)}</Meta>
          <Meta label="Message" mono>
            {shortId(event.candidate_message_id)}
          </Meta>
        </dl>
      </Section>

      <Usage usage={event.usage} />
    </>
  )
}

/**
 * What the gate read.
 *
 * The evaluator is a second model with a context of its own, assembled for it
 * and thrown away afterwards — the model-context stream holds the request
 * Maia was given, not this. A verdict is only readable against it, so it is
 * recorded with the verdict and shown beside it: the rubric that judged, the
 * standing instructions and memories in force, the window of conversation,
 * and the tool evidence as it was budgeted for the evaluator rather than for
 * the model.
 */
function GateContextBody({ event, onToast }: { event: ResponseGateEvent; onToast: Toast }) {
  const context = event.gate_context

  if (!context) {
    return (
      <Section title="Context">
        <Absent
          reason={
            event.mode === 'structure'
              ? 'Not recorded in structure mode.'
              : 'Not recorded for this evaluation.'
          }
        />
      </Section>
    )
  }

  const memories = context.user_memories ?? []
  const conversation = context.conversation ?? []
  const traces = context.tool_traces ?? []

  return (
    <Section title="Context" note={windowNote(context)}>
      <Fold
        title="Conversation"
        note={countNote(conversation.length, 'message', 'messages')}
      >
        {conversation.length > 0 ? (
          <ol className="record__turns">
            {conversation.map((turn, index) => {
              const role = roleLabel(turn.role ?? 'unknown')
              return (
                <li key={index} className="record__turn">
                  <span className="record__role">{role}</span>
                  {turn.content ? (
                    <Payload
                      text={turn.content}
                      label={`the ${role.toLowerCase()} message`}
                      onToast={onToast}
                    />
                  ) : (
                    <Absent reason="No text." />
                  )}
                </li>
              )
            })}
          </ol>
        ) : (
          <Absent reason="No preceding messages." />
        )}
      </Fold>

      <Fold
        title="Evidence"
        note={countNote(traces.length, 'lookup', 'lookups')}
      >
        {traces.length > 0 ? (
          <ul className="record__traces">
            {traces.map((trace, index) => (
              <li key={trace.tool_call_id ?? index} className="record__trace">
                <div className="record__trace-head">
                  <span className="record__mono">{trace.name ?? 'unnamed tool'}</span>
                  <span className="record__note">{turnsAgoLabel(trace.turns_ago ?? 0)}</span>
                </div>
                {trace.evidence ? (
                  <Payload
                    text={trace.evidence}
                    label={`the ${trace.name ?? 'tool'} result`}
                    onToast={onToast}
                  />
                ) : (
                  <Absent reason="No result." />
                )}
              </li>
            ))}
          </ul>
        ) : (
          <Absent reason="No tool evidence." />
        )}
      </Fold>

      <Fold
        title="Memories"
        note={countNote(memories.length, 'memory', 'memories')}
      >
        {memories.length > 0 ? (
          memories.map((memory, index) => (
            <Payload key={index} text={memory} label="the memories" onToast={onToast} />
          ))
        ) : (
          <Absent reason="No memories." />
        )}
      </Fold>

      {/* Both of these are long and rarely the thing being checked, so they
          rest closed. The rubric is here at all because it is edited between
          runs, and a verdict read against the wrong one explains nothing. */}
      <Fold title="System prompt">
        {context.system_prompt ? (
          <Payload text={context.system_prompt} label="the system prompt" onToast={onToast} />
        ) : (
          <Absent reason="Not recorded." />
        )}
      </Fold>

      <Fold title="Rubric">
        {context.evaluator_prompt ? (
          <Payload text={context.evaluator_prompt} label="the rubric" onToast={onToast} />
        ) : (
          <Absent reason="Not recorded." />
        )}
      </Fold>

      {context.time_context && (
        <dl className="record__meta">
          <Meta label="Clock" mono>
            {context.time_context.current_time ?? '—'}
          </Meta>
          <Meta label="Zone" mono>
            {context.time_context.timezone ?? '—'}
          </Meta>
        </dl>
      )}
    </Section>
  )
}

function ContextBody({ event, onToast }: { event: ModelContextEvent; onToast: Toast }) {
  return (
    <>
      <Section title="Messages" note={countNote(event.messages.length, 'message', 'messages')} open>
        <ol className="record__messages">
          {event.messages.map((message, index) => {
            const role = roleLabel(message.type)
            return (
              <li key={`${message.id ?? 'message'}-${index}`} className="record__message">
                <div className="record__message-head">
                  <span className="record__role">{role}</span>
                  <span className="record__note">
                    {formatCount(message.content_characters)} characters
                  </span>
                  {message.name && <span className="record__note">{message.name}</span>}
                  {message.status && <span className="record__note">{message.status}</span>}
                </div>
                {message.tool_calls?.length ? (
                  <ul className="record__tool-calls">
                    {message.tool_calls.map((call, callIndex) => (
                      <li key={call.id ?? callIndex}>
                        <span className="record__mono">{call.name ?? 'unnamed tool'}</span>
                        {call.args !== undefined && (
                          <Payload
                            text={stringify(call.args)}
                            label={`the ${call.name ?? 'tool'} arguments`}
                            onToast={onToast}
                            tone="quiet"
                          />
                        )}
                      </li>
                    ))}
                  </ul>
                ) : null}
                <MessageContent
                  message={message}
                  label={`the ${role.toLowerCase()} message`}
                  onToast={onToast}
                />
                {message.artifact_excluded && (
                  <p className="record__note">Artifact withheld from the model.</p>
                )}
              </li>
            )
          })}
        </ol>
      </Section>

      {/* Both of these are standing context rather than this call's news, so
          they sit below the messages and rest closed. */}
      <Section
        title="System message"
        note={
          event.system_message
            ? `${formatCount(event.system_message.content_characters)} characters`
            : undefined
        }
      >
        {event.system_message ? (
          <MessageContent
            message={event.system_message}
            label="the system message"
            onToast={onToast}
          />
        ) : (
          <Absent reason="No system message." />
        )}
      </Section>

      <Section title="Tools" note={countNote(event.tools.length, 'tool', 'tools')}>
        {event.tools.length > 0 ? (
          <ul className="record__tools">
            {event.tools.map((tool, index) => (
              <li key={tool.name ?? index}>
                <span className="record__mono">{tool.name ?? 'unnamed tool'}</span>
                {toolDescription(tool) && (
                  <span className="record__note">{toolDescription(tool)}</span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <Absent reason="No tools." />
        )}
      </Section>

      <Usage usage={event.usage} />
    </>
  )
}

function MessageContent({
  message,
  label,
  onToast,
}: {
  message: ContextMessage
  label: string
  onToast: Toast
}) {
  if (message.content === undefined || message.content === null) {
    return <Absent reason="Content not recorded in structure mode." />
  }
  const text = typeof message.content === 'string' ? message.content : stringify(message.content)
  if (text.length === 0) {
    return <Absent reason="Tool calls only." />
  }
  return <Payload text={text} label={label} onToast={onToast} />
}

function Usage({ usage }: { usage: TokenUsage | null }) {
  return (
    <Section title="Tokens">
      {usage ? (
        <dl className="record__meta">
          <Meta label="Input" mono>
            {formatCount(usage.input_tokens ?? 0)}
          </Meta>
          <Meta label="Output" mono>
            {formatCount(usage.output_tokens ?? 0)}
          </Meta>
          <Meta label="Total" mono>
            {formatCount(usage.total_tokens ?? 0)}
          </Meta>
        </dl>
      ) : (
        <Absent reason="Usage unavailable." />
      )}
    </Section>
  )
}

/**
 * A section of the record, folded or open.
 *
 * `<details>` rather than a state hook: the disclosure is the browser's, so
 * it arrives with its keyboard behaviour and its accessible name already
 * right, and Ctrl+F reaches a closed section's text on the platform that
 * supports it. The `open` prop is a starting position, not a controlled
 * value — the record remounts per selection, so each one opens as it should
 * and stays wherever the reader left it.
 */
function Section({
  title,
  note,
  open = false,
  children,
}: {
  title: string
  note?: string
  open?: boolean
  children: React.ReactNode
}) {
  return (
    <details className="record__section" open={open}>
      <summary className="record__section-head">
        <ChevronRight className="record__chevron" size={13} strokeWidth={1.8} aria-hidden="true" />
        <h3 className="record__section-title">{title}</h3>
        {note && <span className="record__note">{note}</span>}
      </summary>
      <div className="record__section-body">{children}</div>
    </details>
  )
}

/** A section inside a section. Same mechanic, one step quieter. */
function Fold({
  title,
  note,
  open = false,
  children,
}: {
  title: string
  note?: string
  open?: boolean
  children: React.ReactNode
}) {
  return (
    <details className="record__fold" open={open}>
      <summary className="record__fold-head">
        <ChevronRight className="record__chevron" size={12} strokeWidth={1.8} aria-hidden="true" />
        <span className="record__fold-title">{title}</span>
        {note && <span className="record__note">{note}</span>}
      </summary>
      <div className="record__fold-body">{children}</div>
    </details>
  )
}

/** A labelled payload inside a section that already has a title of its own. */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="record__field">
      <span className="record__field-label">{label}</span>
      {children}
    </div>
  )
}

function Meta({
  label,
  mono,
  children,
}: {
  label: string
  mono?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="record__meta-pair">
      <dt>{label}</dt>
      <dd className={mono ? 'record__mono' : undefined}>{children}</dd>
    </div>
  )
}

/**
 * The record's own text, pressed into the panel the way a code block is.
 *
 * A long one keeps its own scroll, so the section stays the height of its
 * heading and the reader chooses which payload to travel through. Each block
 * carries the control for its own text in the corner: this is the grain the
 * text is actually wanted at, and it names what it takes so ten of them in a
 * record do not all report the same thing.
 */
function Payload({
  text,
  label,
  onToast,
  tone,
}: {
  text: string
  /** Reads after "Copy" and after "Copied", so it names the block in place. */
  label: string
  onToast: Toast
  tone?: 'quiet'
}) {
  return (
    <div className="record__payload-block">
      <pre className={`record__payload${tone === 'quiet' ? ' record__payload--quiet' : ''}`}>
        {text}
      </pre>
      <CopyControl text={text} what={label} onToast={onToast} />
    </div>
  )
}

/* An unrecorded field is a reading, not a blank: the log says why it is not
   there, and structure mode not carrying text is the log working correctly. */
function Absent({ reason }: { reason: string }) {
  return <p className="record__absent">{reason}</p>
}

/**
 * Copying, and saying so.
 *
 * The confirmation is on the control the reader pressed and in a toast, the
 * same pair the thread's Copy uses. The timer is cleared on unmount because a
 * record is replaced the moment another row is chosen, and a copy near that
 * moment would otherwise set state on a component that is gone.
 */
function useCopy(onToast: Toast) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const copy = useCallback(
    (text: string, announcement: string) => {
      navigator.clipboard.writeText(text).catch(() => {})
      setCopied(true)
      onToast(announcement)
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setCopied(false), 1800)
    },
    [onToast],
  )

  return { copied, copy }
}

/** One block's text, lifted out from the corner of the block itself. */
function CopyControl({ text, what, onToast }: { text: string; what: string; onToast: Toast }) {
  const { copied, copy } = useCopy(onToast)

  return (
    <button
      type="button"
      className="record__copy"
      aria-label={`Copy ${what}`}
      onClick={() => copy(text, `Copied ${what}`)}
    >
      {copied ? (
        <Check size={12} strokeWidth={1.8} aria-hidden="true" />
      ) : (
        <Copy size={12} strokeWidth={1.8} aria-hidden="true" />
      )}
    </button>
  )
}

function CopyRecord({ record, onToast }: { record: LogRecord; onToast: Toast }) {
  const { copied, copy } = useCopy(onToast)

  return (
    <button
      type="button"
      className="ghost-btn ghost-btn--icon"
      onClick={() => copy(JSON.stringify(record.event, null, 2), 'Record copied as JSON')}
    >
      {copied ? (
        <Check size={13} strokeWidth={1.8} aria-hidden="true" />
      ) : (
        <Copy size={13} strokeWidth={1.8} aria-hidden="true" />
      )}
      {copied ? 'Copied' : 'Copy JSON'}
    </button>
  )
}

const stringify = (value: unknown) => JSON.stringify(value, null, 2)

const listOrDash = (values: string[]) => (values.length > 0 ? values.join(', ') : '—')

const countNote = (total: number, one: string, many: string) =>
  `${formatCount(total)} ${total === 1 ? one : many}`

/* How far back the window was allowed to reach, which is the bound on
   everything inside this section and therefore belongs on its head. */
function windowNote(context: GateContext): string | undefined {
  const turns = context.evidence_turns
  if (typeof turns !== 'number' || turns < 1) return undefined
  return turns === 1 ? 'the current turn' : `the last ${formatCount(turns)} turns`
}

function toolDescription(tool: ContextTool): string | null {
  if (!tool.description) return null
  const firstLine = tool.description.split('\n')[0]
  return firstLine.length > 96 ? `${firstLine.slice(0, 96).replace(/\s+\S*$/, '')}…` : firstLine
}
