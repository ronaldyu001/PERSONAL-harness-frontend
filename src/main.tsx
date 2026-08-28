import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/archivo/index.css'
import '@fontsource-variable/jetbrains-mono/index.css'
import './styles/global.css'
import './styles/theme-dark.css'
import './styles/theme-light.css'
import './styles/shell.css'
import './styles/dashboard.css'
import './styles/investigate.css'
import './styles/chat.css'
import './styles/composer.css'
import './styles/overlays.css'
import './styles/startup.css'
import App from './App.tsx'
import { StartupGate } from './components/StartupGate'
import { SendChat } from './application/chat/send_chat'
import { LoadConversations } from './application/conversation/load_conversations'
import { ReadLogStream } from './application/observability/read_log_stream'
import { HttpChatAdapter } from './infrastructure/chat/http_chat_adapter'
import { HttpConversationHistoryAdapter } from './infrastructure/conversation/http_conversation_history_adapter'
import { LocalStorageUserIdentityAdapter } from './infrastructure/identity/local_storage_user_identity_adapter'
import { HttpLogStreamAdapter } from './infrastructure/observability/http_log_stream_adapter'
import { installExternalLinkHandler } from './lib/external_links'

const apiBaseUrl = import.meta.env.DEV
  ? ''
  : (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000')
const healthBaseUrl = import.meta.env.DEV
  ? (import.meta.env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:8000')
  : apiBaseUrl
const healthUrl = `${healthBaseUrl.replace(/\/$/, '')}/api/health`
const orchestratorStartUrl = import.meta.env.DEV ? '/orchestrator/start' : undefined
const orchestratorStatusUrl = import.meta.env.DEV ? '/orchestrator/status' : undefined
const orchestratorCancelUrl = import.meta.env.DEV ? '/orchestrator/cancel' : undefined
const orchestratorRetryUrl = import.meta.env.DEV ? '/orchestrator/retry' : undefined
const chatAdapter = new HttpChatAdapter(apiBaseUrl)
const historyAdapter = new HttpConversationHistoryAdapter(apiBaseUrl)
const traceAdapter = new HttpLogStreamAdapter(apiBaseUrl)
const identityAdapter = new LocalStorageUserIdentityAdapter()
const sendChat = new SendChat(chatAdapter, identityAdapter)
const loadConversations = new LoadConversations(historyAdapter, identityAdapter)
/* The same identity the chat turns were recorded under: a trace read is
   scoped to its owner, so the bench reads back exactly what this browser
   wrote. */
const readLogStream = new ReadLogStream(traceAdapter, identityAdapter)

installExternalLinkHandler()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StartupGate
      healthUrl={healthUrl}
      orchestratorStartUrl={orchestratorStartUrl}
      orchestratorStatusUrl={orchestratorStatusUrl}
      orchestratorCancelUrl={orchestratorCancelUrl}
      orchestratorRetryUrl={orchestratorRetryUrl}
    >
      <App
        sendChat={sendChat}
        loadConversations={loadConversations}
        readLogStream={readLogStream}
      />
    </StartupGate>
  </StrictMode>,
)
