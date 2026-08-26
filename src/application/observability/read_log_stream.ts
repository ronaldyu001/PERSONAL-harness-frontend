import type { UserIdentityPort } from '../identity/user_identity_port'
import type { LogStreamPort } from './log_stream_port'
import type { LogStream, ReadLogStreamCommand } from './schemas'

/**
 * Reads one of Maia's trace streams back for inspection.
 *
 * Thin on purpose: the ordering and the record identity belong to whatever is
 * holding the traces, so this use case adds no policy of its own. Identity is
 * supplied here rather than by the components, the same way LoadConversations
 * supplies it — a trace read is scoped to its owner by the backend, and the
 * bench should not have to know whose records it is asking for.
 */
export class ReadLogStream {
  private readonly logs: LogStreamPort
  private readonly identity: UserIdentityPort

  constructor(logs: LogStreamPort, identity: UserIdentityPort) {
    this.logs = logs
    this.identity = identity
  }

  execute(command: ReadLogStreamCommand): Promise<LogStream> {
    return this.logs.read({
      stream: command.stream,
      userId: this.identity.getUserId(),
      sessionId: command.sessionId,
      limit: command.limit,
      signal: command.signal,
    })
  }
}
