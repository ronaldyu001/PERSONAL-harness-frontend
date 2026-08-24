import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
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
  formatDay,
  outcomeOf,
  shortId,
  totalTokens,
} from '../lib/log_format'
import type { ReadLogStream } from '../application/observability/read_log_stream'
import type { LogRecord, LogStreamId } from '../application/observability/schemas'

/* Floored, never capped, the way both dashboard splits are: each side names
   the width below which it stops being readable and everything between those
   floors belongs to whoever is dragging.

   LEDGER_MIN is where a row's clock, outcome and seed mark stop fitting on one
   line; RECORD_MIN is where a payload stops being worth reading in a column. */
const LEDGER_DEFAULT = 336
const LEDGER_MIN = 232
const RECORD_MIN = 380
const LEDGER_STEP = 16
const LEDGER_STORAGE_KEY = 'harness.investigate.ledgerWidth'
/* Matches the media query in investigate.css: below this the two panes stack
   and there is no vertical edge left to drag. */
const STACK_BELOW = 900

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
 * backend already writes its reasoning to JSONL files, one per concern, and
 * this surface reads them at the two speeds a log is read at: a dense ledger
 * to scan and one record opened in full. The channel selector in the head
 * picks the log, exactly as the registry lists them.
 *
 * The bench is the same object in a cooler material — see investigate.css.
 * Nothing here reaches the network: the records come from the seed adapter
 * behind the log port until the backend serves the files it writes.
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
  const { data, error, loading, retry } = useLogStream(readLogStream, streamId)
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

  /* A session narrows the whole bench, filters and counts included: the
     reader arrived from one conversation and every reading should be about
     it until they say otherwise. */
  const records = useMemo(() => {
    const all = data?.records ?? []
    return session ? all.filter((record) => record.event.session_id === session) : all
  }, [data, session])
  const facet = stream.facets.find((item) => item.id === facetId) ?? stream.facets[0]
  const visible = useMemo(
    () => (facet.match ? records.filter((record) => facet.match!(record.event)) : records),
    [facet, records],
  )
  const seeded = visible.filter((record) => record.origin === 'synthesized').length

  /* The bench opens on a record rather than on an empty pane, and a filter
     that hides the open one moves the reading to the first row it kept. The
     fallback is derived rather than written back: the reader's choice is the
     only thing state holds, so nothing has to be re-synced when the list under
     it changes. */
  const selected = visible.find((record) => record.id === selectedId) ?? visible[0] ?? null

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
            <span className="region__flag">Seed data</span>
          </div>
        </header>

        {/* Each log is its own panel, so changing the channel changes the
            whole reading — ledger, filters, and record together. */}
        <AnimatePresence mode="wait" initial={false} custom={streamDirection}>
        <motion.div
          key={stream.id}
          ref={measureBody}
          className="region__body bench__body"
          role="tabpanel"
          id={`bench-panel-${stream.id}`}
          aria-labelledby={`bench-tab-${stream.id}`}
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
              <p className="bench__summary">{stream.summary}</p>
              {session && (
                <p className="bench__focus">
                  <span className="bench__focus-label">One conversation</span>
                  <span className="bench__mono">{session.slice(0, 8)}</span>
                  <button type="button" className="link-btn" onClick={onClearSession}>
                    Show every session
                  </button>
                </p>
              )}
              <p className="bench__source">
                <span className="bench__mono">{stream.file}</span>
                {seeded > 0 && (
                  <span className="bench__seed-note">
                    {formatCount(visible.length - seeded)} captured ·{' '}
                    {formatCount(seeded)} seeded
                  </span>
                )}
              </p>
              <Facets
                stream={stream}
                active={facet.id}
                counts={records}
                onChange={(next) => setFacetId(next)}
              />
            </div>

            {loading ? (
              <p className="bench__note" role="status">
                Reading {stream.file}&#8230;
              </p>
            ) : error ? (
              <p className="bench__note" role="status">
                {error}{' '}
                <button type="button" className="link-btn" onClick={retry}>
                  Try again
                </button>
              </p>
            ) : visible.length === 0 ? (
              <p className="bench__note">
                {session && facet.id === 'all' ? (
                  <>
                    Nothing was logged under this conversation. The files hold what the backend
                    has written since it last started.{' '}
                    <button type="button" className="link-btn" onClick={onClearSession}>
                      Show every session
                    </button>
                  </>
                ) : (
                  <>
                    No {stream.unit[1]} match this filter.{' '}
                    <button type="button" className="link-btn" onClick={() => setFacetId('all')}>
                      Show all
                    </button>
                  </>
                )}
              </p>
            ) : (
              <Ledger
                records={visible}
                selectedId={selected?.id ?? null}
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
              label="Resize the ledger"
              valueNow={ledgerWidth}
              valueMin={LEDGER_MIN}
              valueMax={ledgerMax}
              valueText={`Ledger ${ledgerWidth} pixels wide`}
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

          <div className="bench__inspector">
            {selected ? (
              /* No exit: the reader walking the ledger with the arrow keys is
                 moving on purpose, and an outgoing record would put a queue in
                 front of them. */
              <motion.div key={selected.id} {...readingSwap(reduceMotion)}>
                <LogRecordView record={selected} onToast={onToast} />
              </motion.div>
            ) : (
              <p className="bench__note">
                {loading ? 'Nothing open yet.' : 'Select a record to read it in full.'}
              </p>
            )}
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
 * Records are grouped by invocation because that is the unit a turn is
 * written in: one question can hold a tool round-trip and three gate passes,
 * and they only read correctly stacked together. Rules between rows are the
 * bench's own device — the face avoids them, a ledger is made of them.
 */
function Ledger({
  records,
  selectedId,
  onSelect,
}: {
  records: LogRecord[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const listRef = useRef<HTMLDivElement>(null)

  const groups = useMemo(() => {
    const order: string[] = []
    const byInvocation = new Map<string, LogRecord[]>()
    for (const record of records) {
      const key = record.event.invocation_id
      if (!byInvocation.has(key)) {
        byInvocation.set(key, [])
        order.push(key)
      }
      byInvocation.get(key)!.push(record)
    }
    return order.map((key) => ({ key, records: byInvocation.get(key)! }))
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
      {groups.map((group) => (
        <section
          key={group.key}
          className="ledger__group"
          aria-label={`Invocation ${shortId(group.key)}`}
        >
          <h3 className="ledger__group-label">
            <span>{formatDay(group.records[0].event.timestamp)}</span>
            <span className="bench__mono">{shortId(group.key)}</span>
          </h3>
          <ul className="ledger__list">
            {group.records.map((record) => (
              <li key={record.id}>
                <LedgerRow
                  record={record}
                  selected={record.id === selectedId}
                  onSelect={onSelect}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

function LedgerRow({
  record,
  selected,
  onSelect,
}: {
  record: LogRecord
  selected: boolean
  onSelect: (id: string) => void
}) {
  const { event } = record
  const tokens = totalTokens(event.usage)

  return (
    <button
      type="button"
      className={`ledger__row${selected ? ' ledger__row--on' : ''}`}
      aria-current={selected ? 'true' : undefined}
      onClick={() => onSelect(record.id)}
    >
      <span className="ledger__line">
        <span className="ledger__clock">{formatClock(event.timestamp)}</span>
        <OutcomeMark outcome={outcomeOf(event)} />
        {record.origin === 'synthesized' && (
          <span className="ledger__seed" title="Seed record, not captured traffic">
            seed
          </span>
        )}
      </span>
      <span className="ledger__detail">
        {event.event === 'response_gate'
          ? `eval ${event.evaluation_call} · repair ${event.repair_attempt} · ${formatCount(
              event.candidate_characters,
            )} ch`
          : `call ${event.model_call} · ${event.messages.length} messages`}
        {tokens !== null && ` · ${formatCount(tokens)} tok`}
      </span>
    </button>
  )
}
