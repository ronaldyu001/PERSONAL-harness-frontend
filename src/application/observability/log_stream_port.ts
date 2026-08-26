import type { LogStream, ReadLogStreamRequest } from './schemas'

/**
 * One trace stream, read back for inspection.
 *
 * The backend serves both streams from `GET /api/traces`, and which sink they
 * were recorded to — the `.logs` files or Postgres — is answered on the other
 * side of this line. The adapter behind the port is the only thing that knows
 * there is a network involved at all.
 */
export interface LogStreamPort {
  read(request: ReadLogStreamRequest): Promise<LogStream>
}
