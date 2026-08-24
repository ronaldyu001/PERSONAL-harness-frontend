import type { LogStream, ReadLogStreamRequest } from './schemas'

/**
 * One log stream, read back for inspection.
 *
 * The backend writes these files but does not serve them yet, so the adapter
 * behind this port is seeded today. The boundary is the point: when
 * `GET /api/logs/{stream}` exists, an HTTP adapter replaces the seed one and
 * nothing above this line changes.
 */
export interface LogStreamPort {
  read(request: ReadLogStreamRequest): Promise<LogStream>
}
