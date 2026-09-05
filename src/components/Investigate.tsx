import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { RotateCw } from 'lucide-react'
import { OutcomeMark } from './OutcomeMark'
import { LogRecordView } from './LogRecordView'
import { LOG_STREAMS, streamById, type LogStreamDef } from './log-registry'
import { RESIZER_THICKNESS, Separator } from './Separator'
import { clamp, readStored, writeStored } from '../lib/panel_split'
import { useLogStream } from '../hooks/useLogStream'
import { readingSwap, viewSlide } from '../lib/motion'
import {
  formatClock,
  formatCount,
  formatDayLabel,
  outcomeOf,
  shortId,
} from '../lib/log_format'
import type { ReadLogStream } from '../application/observability/read_log_stream'
import type { LogEvent, LogRecord, LogStreamId } from '../application/observability/schemas'

/* Floored, never capped, the way both dashboard splits are: each side names
   the width below which it stops being readable and everything between those
   floors belongs to whoever is dragging.

   LEDGER_MIN is where a row's clock and outcome stop fitting on one line;
   RECORD_MIN is where a payload stops being worth reading in a column. */
const LEDGER_DEFAULT = 336
const LEDGER_MIN = 232
const RECORD_MIN = 380
const LEDGER_STEP = 16
const LEDGER_STORAGE_KEY = 'harness.investigate.ledgerWidth'
/* Matches the media query in investigate.css: below this the two panes stack
   and there is no vertical edge left to drag. */
const STACK_BELOW = 900

/* One window of records, asked for explicitly rather than left to the
   backend's default, so the ledger can say when it is showing a window and
   not the whole stream. Well under the API's own ceiling of 500. */
const TRACE_WINDOW = 200

/* One identity for "nothing read yet", so the ledger's own grouping is not
   rebuilt by a render that changed something else. */
const NO_RECORDS: LogRecord[] = []

export interface InvestigateProps {
  readLogStream: ReadLogStream
  onToast: (text: string) => void
  reduceMotion: boolean
  /** Opened from a conversation: its id is the session its turns were logged under. */
  session: string | null
  onClearSession: () => void
}

/**
 * Investigate — the service side of the instrument.
 *
 * Maia's dashboard is the face; this is the bench it is opened on. The
 * backend records its reasoning as two trace streams, one per concern, and
 * this surface reads them at the two speeds a log is read at: a dense ledger
 * to scan and one record opened in full. The channel selector in the head
 * picks the stream, exactly as the registry lists them.
 *
 * The bench is the same object in a cooler material — see investigate.css.
 * Every record here is one the backend actually recorded: nothing on this
 * surface is fabricated, and nothing needs disclaiming.
 */
export function Investigate({
  readLogStream,
  onToast,
  reduceMotion,
  session,
  onClearSession,
}: InvestigateProps) {
  const [streamId, setStreamId] = useState<LogStreamId>('response-gate')
  const stream = streamById(streamId)
  const [facetId, setFacetId] = useState('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  /* Which way the reading travels when the channel changes: the logs sit in
     the order the registry lists them, and the swap follows the reader along
     that row. Set where both ends are known rather than inferred from the
     last render. */
  const [streamDirection, setStreamDirection] = useState<1 | -1>(1)
  const { data, error, loading, reload } = useLogStream(
    readLogStream,
    streamId,
    session,
    TRACE_WINDOW,
  )
  const {
    max: ledgerMax,
    measure: measureBody,
    reset: resetLedger,
    setWidth: setLedgerWidth,
    stacked,
    width: ledgerWidth,
  } = useLedgerSplit()
  const [dragging, setDragging] = useState(false)
  const dragStart = useRef(0)
  const inspector = useRef<HTMLDivElement>(null)

  /* A session narrows the whole bench, filters and counts included: the
     reader arrived from one conversation and every reading should be about
     it until they say otherwise. The narrowing is part of the read rather
     than a filter over it, so the counts describe the conversation and the
     window is spent on its records. */
  const records = data?.records ?? NO_RECORDS
  const facet = stream.facets.find((item) => item.id === facetId) ?? stream.facets[0]
  const visible = useMemo(
    () => (facet.match ? records.filter((record) => facet.match!(record.event)) : records),
    [facet, records],
  )
  /* A full window is the window, not the stream: what is older than the last
     row may or may not exist, and the head says so rather than implying the
     ledger is everything. */
  const windowed = records.length >= TRACE_WINDOW
  /* The first read has nothing to hold the ledger open, so it is the only one
     that replaces it. A re-read leaves the records up and reports itself on
     the control that asked for it. */
  const opening = loading && data === null

  /* The bench opens on a record rather than on an empty pane, and a filter
     that hides the open one moves the reading to the first row it kept. The
     fallback is derived rather than written back: the reader's choice is the
     only thing state holds, so nothing has to be re-synced when the list under
     it changes. */
  const selected = visible.find((record) => record.id === selectedId) ?? visible[0] ?? null

  /* A record is opened at its top. The pane is one scroller and the records
     in it are different heights, so keeping the offset across a selection
     drops the reader into the middle of a record they have not started —
     and the deeper they were in the last one, the further in they land. */
  useLayoutEffect(() => {
    if (inspector.current) inspector.current.scrollTop = 0
  }, [selected?.id])

  const changeStream = (next: LogStreamId) => {
    const from = LOG_STREAMS.findIndex((item) => item.id === streamId)
    const to = LOG_STREAMS.findIndex((item) => item.id === next)
    setStreamDirection(to >= from ? 1 : -1)
    setStreamId(next)
    setFacetId('all')
    setSelectedId(null)
  }

  return (
    <main className="bench">
      <section className="region region--bench" aria-labelledby="region-bench-legend">
        <header className="region__head">
          <h2 id="region-bench-legend" className="legend region__legend">
            Investigate
          </h2>
          <StreamTabs active={streamId} onChange={changeStream} />
          <div className="region__head-end">
            {/* The ledger is a read, not a feed: it is whatever was recorded
                when it was asked for, and this is how the reader asks again.
                Named by the words on it rather than by an aria-label that
                reads differently — those are the words that work it. */}
            <button
              type="button"
              className="ghost-btn ghost-btn--icon bench__reread"
              onClick={reload}
              disabled={loading}
              aria-busy={loading}
            >
              <RotateCw size={13} strokeWidth={1.8} aria-hidden="true" />
              {loading ? 'Refreshing' : 'Refresh'}
            </button>
          </div>
        </header>

        {/* Each log is its own panel, so changing the channel changes the
            whole reading — ledger, filters, and record together. */}
        <AnimatePresence mode="wait" initial={false} custom={streamDirection}>
        <motion.div
          key={stream.id}
          ref={measureBody}
          className={`region__body bench__body${stacked ? ' bench__body--stacked' : ''}`}
          role="tabpanel"
          id={`bench-panel-${stream.id}`}
          aria-labelledby={`bench-tab-${stream.id}`}
          aria-description={stream.summary}
          custom={streamDirection}
          variants={viewSlide(reduceMotion)}
          initial="initial"
          animate="animate"
          exit="exit"
        >
          <div
            className="bench__ledger"
            style={stacked ? undefined : { flex: `0 0 ${ledgerWidth}px` }}
          >
            <div className="bench__ledger-head">
              {session && (
                <p className="bench__focus">
                  <span className="bench__focus-label">Conversation</span>
                  <span className="bench__mono">{session.slice(0, 8)}</span>
                  <button type="button" className="link-btn" onClick={onClearSession}>
                    All conversations
                  </button>
                </p>
              )}
              <Facets
                stream={stream}
                active={facet.id}
                counts={records}
                onChange={(next) => setFacetId(next)}
              />
              {/* Provenance matters once there is something to inspect, but
                  it is reference detail rather than part of every scan. */}
              {data && records.length > 0 && (
                <details className="bench__source-disclosure">
                  <summary>Source</summary>
                  <p className="bench__source">
                    <span className="bench__mono">{data.source}</span>
                    {data.capturedAt && <span>Updated {formatClock(data.capturedAt)}</span>}
                    {windowed && <span>Latest {formatCount(TRACE_WINDOW)}</span>}
                  </p>
                </details>
              )}
              {/* A read that fails does not take the last one's records with
                  it: what is on the ledger was recorded and was read, and
                  hiding it would cost the reader more than the failure
                  did. */}
              {error && data && (
                <p className="bench__stale" role="status">
                  {error}
                </p>
              )}
            </div>

            {opening ? (
              <p className="bench__note" role="status">
                Loading&#8230;
              </p>
            ) : error && !data ? (
              <p className="bench__note" role="status">{error}</p>
            ) : visible.length === 0 ? (
              <p className="bench__note">
                {records.length > 0 ? (
                  <>No matches.</>
                ) : session ? (
                  <>Nothing recorded for this conversation.</>
                ) : (
                  <>Nothing recorded yet.</>
                )}
              </p>
            ) : (
              <Ledger
                records={visible}
                selectedId={selected?.id ?? null}
                showConversations={session === null}
                onSelect={setSelectedId}
              />
            )}
          </div>

          {/* The record takes whatever the ledger is not using, so the empty
              room on the right is the reader's to reclaim: drag the edge, or
              hold it and use the arrow keys. */}
          {!stacked && (
            <Separator
              orientation="vertical"
              style={{
                left: ledgerWidth - RESIZER_THICKNESS / 2,
                width: RESIZER_THICKNESS,
              }}
              label="Resize activity list"
              valueNow={ledgerWidth}
              valueMin={LEDGER_MIN}
              valueMax={ledgerMax}
              valueText={`Activity list ${ledgerWidth} pixels wide`}
              step={LEDGER_STEP}
              dragging={dragging}
              onDragStart={() => {
                dragStart.current = ledgerWidth
                setDragging(true)
              }}
              onDrag={(delta) => setLedgerWidth(dragStart.current + delta)}
              onDragEnd={() => setDragging(false)}
              onNudge={(delta) => setLedgerWidth(ledgerWidth + delta)}
              onExtreme={(edge) => setLedgerWidth(edge === 'start' ? LEDGER_MIN : ledgerMax)}
              onReset={resetLedger}
            />
          )}

          <div className="bench__inspector" ref={inspector}>
            {selected ? (
              /* No exit: the reader walking the ledger with the arrow keys is
                 moving on purpose, and an outgoing record would put a queue in
                 front of them. */
              <motion.div key={selected.id} {...readingSwap(reduceMotion)}>
                <LogRecordView record={selected} onToast={onToast} />
              </motion.div>
            ) : null}
          </div>
        </motion.div>
        </AnimatePresence>
      </section>
    </main>
  )
}

/**
 * The ledger's share of the panel, which is the reader's.
 *
 * Stored in pixels because the split is horizontal and the panel's width does
 * not follow the window the way its height does — the same reasoning the
 * dashboard's two splits are built on, and the same storage helpers. The
 * ceiling follows the room that is actually there, so a narrowed window
 * tightens the ledger and returns it when the room comes back.
 */
function useLedgerSplit() {
  /* A callback ref rather than a ref object: the element is measured, and a
     measurement the layout depends on is state, not a box to reach into
     during render. */
  const [bodyEl, setBodyEl] = useState<HTMLDivElement | null>(null)
  const [body, setBody] = useState(0)
  const [stored, setStored] = useState<number | null>(() => readStored(LEDGER_STORAGE_KEY))

  /* The panel is measured rather than derived: the column beside it expands
     without a window resize. */
  useLayoutEffect(() => {
    if (!bodyEl) return
    /* No opening measurement of its own: the observer delivers the current
       size the moment it starts, and the resting width covers the frame
       before it arrives. */
    const observer = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect
      if (box) setBody(box.width)
    })
    observer.observe(bodyEl)
    return () => observer.disconnect()
  }, [bodyEl])

  const stacked = body > 0 && body < STACK_BELOW
  const max = body > 0 ? Math.max(LEDGER_MIN, body - RECORD_MIN) : LEDGER_DEFAULT
  const width = clamp(stored ?? LEDGER_DEFAULT, LEDGER_MIN, max)

  const setWidth = useCallback(
    (next: number) => {
      const value = clamp(Math.round(next), LEDGER_MIN, max)
      setStored(value)
      writeStored(LEDGER_STORAGE_KEY, value)
    },
    [max],
  )

  const reset = useCallback(() => {
    setStored(null)
    writeStored(LEDGER_STORAGE_KEY, null)
  }, [])

  return { max, measure: setBodyEl, reset, setWidth, stacked, width }
}

/** The channel selector: one log at a time, every log visible at once. */
function StreamTabs({
  active,
  onChange,
}: {
  active: LogStreamId
  onChange: (next: LogStreamId) => void
}) {
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (step === 0) return
    event.preventDefault()
    const index = LOG_STREAMS.findIndex((stream) => stream.id === active)
    const next = LOG_STREAMS[(index + step + LOG_STREAMS.length) % LOG_STREAMS.length]
    onChange(next.id)
    document.getElementById(`bench-tab-${next.id}`)?.focus()
  }

  return (
    <div className="segmented bench__tabs" role="tablist" aria-label="Log" onKeyDown={onKeyDown}>
      {LOG_STREAMS.map((stream) => {
        const on = stream.id === active
        return (
          <button
            key={stream.id}
            type="button"
            id={`bench-tab-${stream.id}`}
            className={`segmented__opt${on ? ' segmented__opt--on' : ''}`}
            role="tab"
            aria-selected={on}
            aria-controls={`bench-panel-${stream.id}`}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(stream.id)}
          >
            <stream.icon size={13} strokeWidth={1.8} aria-hidden="true" />
            {stream.label}
          </button>
        )
      })}
    </div>
  )
}

function Facets({
  stream,
  active,
  counts,
  onChange,
}: {
  stream: LogStreamDef
  active: string
  counts: LogRecord[]
  onChange: (next: string) => void
}) {
  return (
    <div className="bench__facets" role="group" aria-label={`Filter ${stream.label.toLowerCase()}`}>
      {stream.facets.map((item) => {
        const total = item.match
          ? counts.filter((record) => item.match!(record.event)).length
          : counts.length
        const on = item.id === active
        return (
          <button
            key={item.id}
            type="button"
            className={`bench__facet${on ? ' bench__facet--on' : ''}`}
            aria-pressed={on}
            onClick={() => onChange(item.id)}
          >
            {item.label}
            <span className="bench__facet-count">{total}</span>
          </button>
        )
      })}
    </div>
  )
}

/**
 * The ledger.
 *
 * Three levels, and only the ones that carry information are drawn.
 *
 * A **conversation** is the band: it is what a reader actually came looking
 * for, and it is the one grouping the records could not show before. It is
 * cut where the session changes rather than by collecting every record of a
 * session together, so the ledger stays in the order it was read — a
 * conversation returned to after another one opens a second band, which is
 * what happened.
 *
 * A **turn** is a rule, not a heading. One question can hold a tool
 * round-trip and three gate passes, and those only read stacked together, so
 * they sit unruled inside their turn and the rule falls between turns. A turn
 * that holds one record needs no label at all — the row is the turn — so only
 * a chain announces itself.
 *
 * A **record** is one line: when it happened, what happened, and a note only
 * when there is something the outcome does not already say. Everything else
 * about it — the pass number, the repair count, the characters, the tokens —
 * is in the record itself, one click away, where it can be read rather than
 * scanned past on every row.
 */
function Ledger({
  records,
  selectedId,
  showConversations,
  onSelect,
}: {
  records: LogRecord[]
  selectedId: string | null
  /* Suppressed when the bench is already narrowed to one conversation: the
     head says which one, and a band per turn repeating it is the clutter
     this grouping exists to remove. */
  showConversations: boolean
  onSelect: (id: string) => void
}) {
  const listRef = useRef<HTMLDivElement>(null)

  const bands = useMemo(() => {
    const bands: LedgerBand[] = []

    for (const record of records) {
      const { invocation_id: invocation, session_id: session } = record.event
      let band = bands[bands.length - 1]
      if (!band || band.session !== session) {
        band = {
          key: `${session ?? 'temporary'}-${bands.length}`,
          session,
          /* Taken from the band's newest record. A conversation carried
             across midnight is labelled by the day it was last active, which
             is the day the reader is looking for it under. */
          day: formatDayLabel(record.event.timestamp),
          turns: [],
          total: 0,
        }
        bands.push(band)
      }

      let turn = band.turns[band.turns.length - 1]
      if (!turn || turn.key !== invocation) {
        turn = { key: invocation, records: [] }
        band.turns.push(turn)
      }
      turn.records.push(record)
      band.total += 1
    }

    /* The read arrives newest first, which is right for conversations and
       for turns — the reader came looking for the last one — and wrong
       inside a turn, where a repair chain is a sequence and a sequence read
       backwards is not the same story. */
    for (const band of bands) {
      for (const turn of band.turns) turn.records.reverse()
    }
    return bands
  }, [records])

  /* Arrows walk the ledger the way they walk any list of rows; Tab still
     reaches every row, this only makes the walk quicker. */
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0
    const rows = Array.from(
      listRef.current?.querySelectorAll<HTMLButtonElement>('.ledger__row') ?? [],
    )
    if (rows.length === 0) return

    if (step !== 0) {
      event.preventDefault()
      const index = rows.indexOf(document.activeElement as HTMLButtonElement)
      rows[Math.min(Math.max(index + step, 0), rows.length - 1)]?.focus()
      return
    }
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      ;(event.key === 'Home' ? rows[0] : rows[rows.length - 1])?.focus()
    }
  }

  return (
    <div className="ledger" ref={listRef} onKeyDown={onKeyDown}>
      {bands.map((band) => (
        <div
          key={band.key}
          className="ledger__band"
        >
          {showConversations && (
            <h3 className="ledger__band-head">
              <span className={band.session ? 'bench__mono' : undefined}>
                {band.session ? shortId(band.session) : 'Temporary chat'}
              </span>
              <span className="ledger__band-note">
                {band.day} · {countOf(band.turns.length, 'turn', 'turns')}
              </span>
            </h3>
          )}
          {band.turns.map((turn) => {
            /* A turn holding more than one record is a chain: the passes ran
               in order and only read as one thing if they are drawn as one.
               A turn holding a single record is just a row. */
            const chain = turn.records.length > 1
            const List = chain ? 'ol' : 'ul'
            return (
              <div
                key={turn.key}
                className={`ledger__turn${chain ? ' ledger__turn--chain' : ''}`}
              >
                {/* Only a chain announces itself. A single-record turn is its
                    own row, and labelling it would put a heading above every
                    line in the column. */}
                {chain && (
                  <p className="ledger__turn-label">
                    {turnShape(turn)}
                  </p>
                )}
                <List className="ledger__list">
                  {turn.records.map((record) => (
                    <li key={record.id}>
                      <LedgerRow
                        record={record}
                        selected={record.id === selectedId}
                        step={chain ? passNumber(record.event) : undefined}
                        onSelect={onSelect}
                      />
                    </li>
                  ))}
                </List>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

interface LedgerTurn {
  key: string
  records: LogRecord[]
}

interface LedgerBand {
  key: string
  /** Absent on a temporary turn, which writes no conversation to belong to. */
  session: string | null
  day: string
  turns: LedgerTurn[]
  total: number
}

const countOf = (total: number, one: string, many: string) =>
  `${formatCount(total)} ${total === 1 ? one : many}`

/* The pass the agent recorded, not this row's position: a window that clips
   the front of a long chain should still say which pass each row was. */
const passNumber = (event: LogEvent) =>
  event.event === 'response_gate' ? event.evaluation_call : event.model_call

/** How long a chain ran, in the word its stream counts in. */
function turnShape(turn: LedgerTurn): string {
  const gate = turn.records[0].event.event === 'response_gate'
  return countOf(turn.records.length, gate ? 'pass' : 'call', gate ? 'passes' : 'calls')
}

function LedgerRow({
  record,
  selected,
  step,
  onSelect,
}: {
  record: LogRecord
  selected: boolean
  /** Its place in the chain, on the rows that are part of one. */
  step?: number
  onSelect: (id: string) => void
}) {
  const { event } = record
  const note = rowNote(event)

  return (
    <button
      type="button"
      className={`ledger__row${selected ? ' ledger__row--on' : ''}`}
      aria-current={selected ? 'true' : undefined}
      tabIndex={selected ? 0 : -1}
      onClick={() => onSelect(record.id)}
    >
      {step !== undefined && <span className="ledger__step">{step}</span>}
      <span className="ledger__clock">{formatClock(event.timestamp)}</span>
      <OutcomeMark outcome={outcomeOf(event)} />
      {note && <span className="ledger__note">{note}</span>}
    </button>
  )
}

/**
 * The one thing a row adds to its outcome, or nothing.
 *
 * The routine row carries no text at all: `eval 1 · repair 0` on every
 * allowed pass is a column to look past rather than read, and a count that is
 * the same on every line is not a reading. What is left is the exception —
 * how many violations the gate named, and whether a call came back through a
 * tool — which is the only part a scan is actually looking for.
 */
function rowNote(event: LogEvent): string | null {
  if (event.event === 'response_gate') {
    return event.violations.length > 0
      ? countOf(event.violations.length, 'violation', 'violations')
      : null
  }
  const results = event.messages.filter((message) => message.type === 'tool').length
  return results > 0 ? countOf(results, 'tool result', 'tool results') : null
}
