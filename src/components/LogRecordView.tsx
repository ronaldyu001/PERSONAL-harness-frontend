import { Check, Copy } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { OutcomeMark } from './OutcomeMark'
import {
  formatCount,
  formatStamp,
  outcomeOf,
  roleLabel,
  shortId,
} from '../lib/log_format'
import type {
  ContextMessage,
  ContextTool,
  LogRecord,
  ModelContextEvent,
  ResponseGateEvent,
  TokenUsage,
} from '../application/observability/schemas'

/**
 * One record, read in full.
 *
 * The ledger is for scanning; this is the other speed. Everything the line
 * holds is shown, in the order the question is usually asked — what happened,
 * to which turn, on what text — and a field the log did not record says so
 * rather than rendering empty. The record's own JSON is one control away,
 * because the answer to "what exactly was written" is the line itself.
 */
export function LogRecordView({
  record,
  onToast,
}: {
  record: LogRecord
  onToast: (text: string) => void
}) {
  const { event } = record
  const outcome = outcomeOf(event)

  return (
    <article className="record" aria-label={`${outcome.label} at ${formatStamp(event.timestamp)}`}>
      <header className="record__head">
        <div className="record__identity">
          <OutcomeMark outcome={outcome} size={15} className="record__outcome" />
          <p className="record__meaning">{outcome.meaning}</p>
        </div>
        <CopyRecord record={record} onToast={onToast} />
      </header>

      <dl className="record__facts">
        <Fact label="Logged">{formatStamp(event.timestamp)}</Fact>
        <Fact label="Model">{event.model}</Fact>
        <Fact label="Log mode">{event.mode}</Fact>
        {event.event === 'model_context' ? (
          <Fact label="Model call">{event.model_call}</Fact>
        ) : (
          <>
            <Fact label="Evaluation">{event.evaluation_call}</Fact>
            <Fact label="Repair attempt">{event.repair_attempt}</Fact>
          </>
        )}
        <Fact label="Session" mono>
          {shortId(event.session_id)}
        </Fact>
        <Fact label="Invocation" mono>
          {shortId(event.invocation_id)}
        </Fact>
      </dl>

      {event.event === 'response_gate' ? (
        <GateBody event={event} />
      ) : (
        <ContextBody event={event} />
      )}
    </article>
  )
}

function GateBody({ event }: { event: ResponseGateEvent }) {
  return (
    <>
      {event.violations.length > 0 && (
        <Section title={`Violations (${event.violations.length})`}>
          <ul className="record__violations">
            {event.violations.map((violation) => (
              <li key={violation}>{violation}</li>
            ))}
          </ul>
        </Section>
      )}

      {event.error_type && (
        <Section title="Gate error">
          <p className="record__error">
            <span className="record__error-type">{event.error_type}</span>
            {event.error_message ? ` — ${event.error_message}` : null}
          </p>
        </Section>
      )}

      <Section title="Feedback to the model">
        {event.feedback ? (
          <Payload text={event.feedback} />
        ) : (
          <Absent
            reason={
              event.mode === 'structure'
                ? 'Not recorded: structure mode keeps decisions and drops text.'
                : 'No feedback was returned for this evaluation.'
            }
          />
        )}
      </Section>

      <Section title={`Candidate (${formatCount(event.candidate_characters)} characters)`}>
        {event.candidate ? (
          <Payload text={event.candidate} />
        ) : (
          <Absent reason="Not recorded: structure mode keeps the length and drops the text." />
        )}
      </Section>

      <Section title="Tools">
        <dl className="record__facts">
          <Fact label="Available">{listOrDash(event.available_tools)}</Fact>
          <Fact label="Used">{listOrDash(event.tools_used)}</Fact>
          <Fact label="Candidate message" mono>
            {shortId(event.candidate_message_id)}
          </Fact>
        </dl>
      </Section>

      <Usage usage={event.usage} />
    </>
  )
}

function ContextBody({ event }: { event: ModelContextEvent }) {
  return (
    <>
      <Section
        title={
          event.system_message
            ? `System message (${formatCount(event.system_message.content_characters)} characters)`
            : 'System message'
        }
      >
        {event.system_message ? (
          <MessageContent message={event.system_message} />
        ) : (
          <Absent reason="No system message was attached to this request." />
        )}
      </Section>

      <Section title={`Messages (${event.messages.length})`}>
        <ol className="record__messages">
          {event.messages.map((message, index) => (
            <li key={`${message.id ?? 'message'}-${index}`} className="record__message">
              <div className="record__message-head">
                <span className="record__role">{roleLabel(message.type)}</span>
                <span className="record__chars">
                  {formatCount(message.content_characters)} characters
                </span>
                {message.name && <span className="record__chars">{message.name}</span>}
                {message.status && <span className="record__chars">{message.status}</span>}
              </div>
              {message.tool_calls?.length ? (
                <ul className="record__tool-calls">
                  {message.tool_calls.map((call, callIndex) => (
                    <li key={call.id ?? callIndex}>
                      <span className="record__mono">{call.name ?? 'unnamed tool'}</span>
                      {call.args !== undefined && (
                        <Payload text={stringify(call.args)} tone="quiet" />
                      )}
                    </li>
                  ))}
                </ul>
              ) : null}
              <MessageContent message={message} />
              {message.artifact_excluded && (
                <p className="record__aside">
                  An artifact was attached to this tool result and withheld from the model.
                </p>
              )}
            </li>
          ))}
        </ol>
      </Section>

      <Section title={`Tools offered (${event.tools.length})`}>
        {event.tools.length > 0 ? (
          <ul className="record__tools">
            {event.tools.map((tool, index) => (
              <li key={tool.name ?? index}>
                <span className="record__mono">{tool.name ?? 'unnamed tool'}</span>
                {toolDescription(tool) && (
                  <span className="record__tool-note">{toolDescription(tool)}</span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <Absent reason="No tools were offered on this call." />
        )}
      </Section>

      <Usage usage={event.usage} />
    </>
  )
}

function MessageContent({ message }: { message: ContextMessage }) {
  if (message.content === undefined || message.content === null) {
    return <Absent reason="Content not recorded: this call was logged in structure mode." />
  }
  const text = typeof message.content === 'string' ? message.content : stringify(message.content)
  if (text.length === 0) {
    return <Absent reason="The message carried no text — only its tool calls." />
  }
  return <Payload text={text} />
}

function Usage({ usage }: { usage: TokenUsage | null }) {
  return (
    <Section title="Tokens">
      {usage ? (
        <dl className="record__facts">
          <Fact label="Input">{formatCount(usage.input_tokens ?? 0)}</Fact>
          <Fact label="Output">{formatCount(usage.output_tokens ?? 0)}</Fact>
          <Fact label="Total">{formatCount(usage.total_tokens ?? 0)}</Fact>
        </dl>
      ) : (
        <Absent reason="The provider reported no usage for this call." />
      )}
    </Section>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="record__section">
      <h3 className="record__section-title">{title}</h3>
      {children}
    </section>
  )
}

function Fact({
  label,
  mono,
  children,
}: {
  label: string
  mono?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="record__fact">
      <dt>{label}</dt>
      <dd className={mono ? 'record__mono' : undefined}>{children}</dd>
    </div>
  )
}

/* The payload field is recessed rather than raised: it is the text the record
   carries, pressed into the panel the way a code block is. */
function Payload({ text, tone }: { text: string; tone?: 'quiet' }) {
  return (
    <pre className={`record__payload${tone === 'quiet' ? ' record__payload--quiet' : ''}`}>
      {text}
    </pre>
  )
}

/* An unrecorded field is a reading, not a blank: the log says why it is not
   there, and structure mode not carrying text is the log working correctly. */
function Absent({ reason }: { reason: string }) {
  return <p className="record__absent">{reason}</p>
}

function CopyRecord({ record, onToast }: { record: LogRecord; onToast: (text: string) => void }) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const copy = useCallback(() => {
    navigator.clipboard.writeText(JSON.stringify(record.event, null, 2)).catch(() => {})
    setCopied(true)
    onToast('Record copied as JSON')
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setCopied(false), 1800)
  }, [onToast, record.event])

  return (
    <button type="button" className="ghost-btn ghost-btn--icon" onClick={copy}>
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

function toolDescription(tool: ContextTool): string | null {
  if (!tool.description) return null
  const firstLine = tool.description.split('\n')[0]
  return firstLine.length > 96 ? `${firstLine.slice(0, 96).replace(/\s+\S*$/, '')}…` : firstLine
}
