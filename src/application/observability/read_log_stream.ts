import type { LogStreamPort } from './log_stream_port'
import type { LogStream, ReadLogStreamCommand } from './schemas'

/**
 * Reads one of Maia's local log streams back for inspection.
 *
 * Thin on purpose: the ordering and the record identity belong to whatever is
 * holding the log, so this use case adds no policy of its own. It exists so
 * the components talk to a use case rather than to an adapter, the same way
 * the conversation surface does.
 */
export class ReadLogStream {
  private readonly logs: LogStreamPort

  constructor(logs: LogStreamPort) {
    this.logs = logs
  }

  execute(command: ReadLogStreamCommand): Promise<LogStream> {
    return this.logs.read({ stream: command.stream, signal: command.signal })
  }
}
