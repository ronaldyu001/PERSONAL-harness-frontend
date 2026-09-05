import { Braces, ScrollText, type LucideIcon } from 'lucide-react'
import type { LogEvent, LogStreamId } from '../application/observability/schemas'

/**
 * The trace registry.
 *
 * Adding a stream to Investigate means adding an entry here and a case in
 * `LogRecordView`. Everything else — the tabs, the filters, the ledger, the
 * counts — is driven off this list, the same way the dashboard's regions are
 * driven off the panel registry. Where the records were read from is not
 * here: the response names its own source, because the sink behind it is a
 * deployment choice rather than a property of the stream.
 */
export interface LogFacet {
  id: string
  label: string
  /** Absent on the leading facet, which is the unfiltered stream. */
  match?: (event: LogEvent) => boolean
}

export interface LogStreamDef {
  id: LogStreamId
  /** Tab label. Short: it sits in a segmented control. */
  label: string
  /** What this stream records, in the reader's terms. */
  summary: string
  icon: LucideIcon
  facets: LogFacet[]
}

export const LOG_STREAMS: LogStreamDef[] = [
  {
    id: 'model-context',
    label: 'Model context',
    summary: 'Requests and model responses.',
    icon: Braces,
    facets: [
      { id: 'all', label: 'All' },
      {
        id: 'tools',
        label: 'Tool rounds',
        match: (event) =>
          event.event === 'model_context' &&
          event.messages.some((message) => message.type === 'tool' || message.tool_calls?.length),
      },
      {
        id: 'error',
        label: 'Errors',
        match: (event) => event.event === 'model_context' && event.status === 'error',
      },
    ],
  },
  {
    id: 'response-gate',
    label: 'Response gate',
    summary: 'Answer evaluations and outcomes.',
    icon: ScrollText,
    facets: [
      { id: 'all', label: 'All' },
      {
        id: 'allow',
        label: 'Allowed',
        match: (event) => event.event === 'response_gate' && event.decision === 'allow',
      },
      {
        id: 'held',
        label: 'Held',
        match: (event) =>
          event.event === 'response_gate' &&
          (event.decision === 'retry' || event.decision === 'fallback'),
      },
      {
        id: 'error',
        label: 'Errors',
        match: (event) => event.event === 'response_gate' && event.decision === 'allow_on_error',
      },
    ],
  },
]

export const streamById = (id: LogStreamId): LogStreamDef =>
  LOG_STREAMS.find((stream) => stream.id === id) ?? LOG_STREAMS[0]
